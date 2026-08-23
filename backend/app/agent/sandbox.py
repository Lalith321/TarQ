"""
Sandbox backends for agent code execution.

Three implementations behind one SandboxBackend interface, chosen by
SandboxBackendFactory:

  - DockerBackend      real OS-level isolation (cgroups, dropped caps,
                        no-new-privileges). execute_session is backed by a
                        persistent worker process living INSIDE the
                        container, reached over a Unix socket per call —
                        objects stay alive in the worker's own memory
                        across calls, no pickling, no picklability
                        requirement. execute_code stays stateless (fresh
                        process each call) via the existing tar-based exec.

  - CloudRunSandboxBackend   same idea as DockerBackend but for Cloud Run's
                        native sandbox CLI; execute_session still uses the
                        pickle-per-call approach (unchanged from before).

  - SubprocessBackend  temporary, no container, no VM — a plain
                        subprocess.run on the host for execute_code, and
                        the in-process multiprocessing worker (Sandbox,
                        below) for execute_session. There is no OS-level
                        isolation here at all: no cgroups, no dropped
                        capabilities, no network namespace. The AST
                        denylist + CPU rlimit are the only real guardrail,
                        so treat this as "quick local iteration", not as a
                        boundary against untrusted code — use DockerBackend
                        for that.
"""
import ast
import contextlib
import io
import json
import multiprocessing as mp
import os
import queue
import resource
import subprocess
import tarfile
import textwrap
import time
import traceback
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import docker


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool = False
    files_created: list[str] = field(default_factory=list)

    @property
    def success(self) -> bool:
        return self.exit_code == 0 and not self.timed_out

    def to_agent_string(self) -> str:
        parts = []
        if self.timed_out:
            parts.append("[TIMEOUT] Execution exceeded time limit.")
        if self.stdout:
            parts.append(f"[stdout]\n{self.stdout.strip()}")
        if self.stderr:
            parts.append(f"[stderr]\n{self.stderr.strip()}")
        if self.files_created:
            parts.append(f"[files created] {', '.join(self.files_created)}")
        if not parts:
            parts.append("[no output]")
        return "\n".join(parts)


class SandboxBackend(ABC):
    """
    Common interface every sandbox backend implements. Agent tools code
    against this, not against DockerBackend/CloudRunSandboxBackend/
    SubprocessBackend directly, so the active implementation can be swapped
    via SandboxBackendFactory.
    """

    workspace_root: str = "/workspace"

    @abstractmethod
    def start(self) -> "SandboxBackend": ...

    @abstractmethod
    def stop(self) -> None: ...

    @abstractmethod
    def execute_code(self, code: str) -> ExecutionResult: ...

    @abstractmethod
    def execute_session(self, code: str) -> ExecutionResult: ...

    @abstractmethod
    def install_package(self, package: str) -> ExecutionResult: ...

    @abstractmethod
    def reset_session(self) -> None: ...

    @abstractmethod
    def write_file(self, path: str, content: str) -> ExecutionResult: ...

    @abstractmethod
    def read_file(self, path: str) -> ExecutionResult: ...

    @abstractmethod
    def list_dir(self, path: str = "/workspace") -> ExecutionResult: ...

    @abstractmethod
    def upload_file(self, path: str, content: bytes) -> ExecutionResult: ...

    def __enter__(self) -> "SandboxBackend":
        return self.start()

    def __exit__(self, *_):
        self.stop()


class DockerBackend(SandboxBackend):
    def __init__(
        self,
        image: str = "python:3.12-slim",
        volume: str = "./sandbox",
        memory: str = "512m",
        cpus: float = 1.0,
        timeout: int = 30,
    ):
        self.image = image
        self.volume = os.path.abspath(volume)
        self.workspace_root = "/workspace"
        self.memory = memory
        self.cpus = cpus
        self.timeout = timeout
        self._client = docker.from_env()
        self._container = None

        # execute_session state — a persistent worker inside the container,
        # not a pickle file. Socket/pidfile live in the container's own
        # overlay (/tmp), not the bind-mounted volume: unix sockets on a
        # bind mount are flaky on some Docker Desktop setups.
        self._session_sock = "/tmp/.worker.sock"
        self._session_pid_file = "/tmp/.worker.pid"
        self._worker_script_path = f"{self.workspace_root}/_session_daemon.py"
        self._session_started = False

        os.makedirs(self.volume, exist_ok=True)

    # ------------------------------------------------------------------ #
    #  Lifecycle                                                           #
    # ------------------------------------------------------------------ #

    def start(self) -> "DockerBackend":
        self._container = self._client.containers.run(
            self.image,
            command="sleep infinity",
            detach=True,
            remove=True,
            network_mode="bridge",
            mem_limit=self.memory,
            nano_cpus=int(self.cpus * 1e9),
            cap_drop=["ALL"],
            cap_add=["DAC_OVERRIDE"],
            security_opt=["no-new-privileges"],
            pids_limit=64,
            volumes={self.volume: {"bind": self.workspace_root, "mode": "rw"}},
            working_dir=self.workspace_root,
        )
        return self

    def stop(self):
        if self._container:
            self._container.stop()
            self._container = None
        self._session_started = False

    def _ensure_running(self):
        if not self._container:
            raise RuntimeError("DockerBackend not started. Use .start() or `with` block.")

    # ------------------------------------------------------------------ #
    #  Core executor                                                       #
    # ------------------------------------------------------------------ #

    def _exec(self, code: str) -> ExecutionResult:
        """
        Write code as an in-memory tar into the container, run it, clean up.
        No stdin wiring, no string interpolation — injection-safe.
        """
        self._ensure_running()

        script_name = f"_script_{os.getpid()}.py"
        script_path = f"{self.workspace_root}/{script_name}"

        buf = io.BytesIO()
        code_bytes = code.encode("utf-8")
        with tarfile.open(fileobj=buf, mode="w") as tar:
            info = tarfile.TarInfo(name=script_name)
            info.size = len(code_bytes)
            tar.addfile(info, io.BytesIO(code_bytes))
        buf.seek(0)
        self._container.put_archive(self.workspace_root, buf)

        try:
            exit_code, output = self._container.exec_run(
                cmd=["python", script_path],
                demux=True,
                workdir=self.workspace_root,
            )
            stdout = ((output[0] or b"").decode("utf-8", errors="replace"))[:50_000]
            stderr = (output[1] or b"").decode("utf-8", errors="replace")
            return ExecutionResult(stdout, stderr, exit_code or 0)

        except Exception as e:
            return ExecutionResult("", str(e), -1)

        finally:
            self._container.exec_run(["rm", "-f", script_path])

    # ------------------------------------------------------------------ #
    #  Path validation                                                     #
    # ------------------------------------------------------------------ #

    def _validate_path(self, path: str) -> str:
        if not path.startswith("/workspace"):
            path = os.path.join(self.workspace_root, path.lstrip("/"))
        relative = os.path.relpath(path, self.workspace_root)
        if relative.startswith(".."):
            raise ValueError(f"Path escape attempt blocked: {path}")
        return path

    # ------------------------------------------------------------------ #
    #  File operations                                                     #
    # ------------------------------------------------------------------ #

    def write_file(self, path: str, content: str) -> ExecutionResult:
        """Write file using put_archive — pure SDK, no subprocess."""
        self._ensure_running()
        path = self._validate_path(path)

        dirpath = os.path.dirname(path)
        filename = os.path.basename(path)

        self._container.exec_run(["mkdir", "-p", dirpath])

        buf = io.BytesIO()
        content_bytes = content.encode("utf-8")
        with tarfile.open(fileobj=buf, mode="w") as tar:
            info = tarfile.TarInfo(name=filename)
            info.size = len(content_bytes)
            tar.addfile(info, io.BytesIO(content_bytes))
        buf.seek(0)

        success = self._container.put_archive(dirpath, buf)
        if success:
            return ExecutionResult(f"Written: {path}", "", 0)
        return ExecutionResult("", f"Failed to write {path}", 1)

    def read_file(self, path: str) -> ExecutionResult:
        """Read file using get_archive — pure SDK, no subprocess."""
        self._ensure_running()
        path = self._validate_path(path)

        try:
            stream, _ = self._container.get_archive(path)

            buf = io.BytesIO()
            for chunk in stream:
                buf.write(chunk)
            buf.seek(0)

            with tarfile.open(fileobj=buf) as tar:
                member = tar.getmembers()[0]
                content = tar.extractfile(member).read().decode("utf-8", errors="replace")

            return ExecutionResult(content, "", 0)

        except docker.errors.NotFound:
            return ExecutionResult("", f"File not found: {path}", 1)

    def list_dir(self, path: str = "/workspace") -> ExecutionResult:
        path = self._validate_path(path)
        exit_code, output = self._container.exec_run(
            ["python", "-c", f"import os,json; print(json.dumps(sorted(os.listdir({path!r}))))"],
            demux=False,
        )
        stdout = (output or b"").decode("utf-8", errors="replace")
        return ExecutionResult(stdout, "", exit_code or 0)

    # ------------------------------------------------------------------ #
    #  Public execution API                                                #
    # ------------------------------------------------------------------ #

    def execute_code(self, code: str) -> ExecutionResult:
        """Stateless execution — no state persists between calls."""
        return self._exec(code)

    def _start_session_daemon(self) -> None:
        """
        Write and launch a persistent worker process inside the container.
        It holds a real Python namespace and serves it over a Unix socket —
        state lives in that process's own memory, not on disk.
        """
        daemon_script = textwrap.dedent(f"""\
            import socket, os, io, contextlib, traceback, json

            SOCK_PATH = {self._session_sock!r}
            PID_FILE = {self._session_pid_file!r}
            if os.path.exists(SOCK_PATH):
                os.remove(SOCK_PATH)

            namespace = {{}}
            srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            srv.bind(SOCK_PATH)
            srv.listen(1)
            with open(PID_FILE, "w") as _f:
                _f.write(str(os.getpid()))

            def _recv_framed(conn):
                length = int.from_bytes(conn.recv(8), "big")
                data = b""
                while len(data) < length:
                    chunk = conn.recv(min(65536, length - len(data)))
                    if not chunk:
                        break
                    data += chunk
                return data.decode("utf-8")

            def _send_framed(conn, payload):
                conn.sendall(len(payload).to_bytes(8, "big") + payload)

            while True:
                conn, _addr = srv.accept()
                try:
                    code = _recv_framed(conn)
                    out, err = io.StringIO(), io.StringIO()
                    result = {{"stdout": "", "stderr": "", "error": None}}
                    try:
                        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                            exec(compile(code, "<session>", "exec"), namespace)
                    except Exception:
                        result["error"] = traceback.format_exc(limit=5)
                    result["stdout"] = out.getvalue()[-40_000:]
                    result["stderr"] = err.getvalue()[-8_000:]
                    _send_framed(conn, json.dumps(result).encode("utf-8"))
                except Exception:
                    pass
                finally:
                    conn.close()
        """)
        write_res = self.write_file(self._worker_script_path, daemon_script)
        if not write_res.success:
            raise RuntimeError(f"failed to write session daemon: {write_res.stderr}")

        self._container.exec_run(["python", self._worker_script_path], detach=True)

        # give the daemon a moment to bind its socket before first use
        for _ in range(20):
            exit_code, _ = self._container.exec_run(["test", "-S", self._session_sock])
            if exit_code == 0:
                break
            time.sleep(0.1)
        self._session_started = True

    def execute_session(self, code: str) -> ExecutionResult:
        """
        Stateful execution via a persistent worker living inside the
        container. Each call still costs one `docker exec` round trip to
        relay code to the worker over its Unix socket, but the worker and
        its namespace never restart between calls — real object
        persistence, no pickling, no picklability requirement.
        """
        self._ensure_running()
        if not self._session_started:
            self._start_session_daemon()

        client_script = textwrap.dedent(f"""\
            import socket

            conn = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            conn.connect({self._session_sock!r})
            payload = {code!r}.encode("utf-8")
            conn.sendall(len(payload).to_bytes(8, "big") + payload)

            length = int.from_bytes(conn.recv(8), "big")
            data = b""
            while len(data) < length:
                chunk = conn.recv(min(65536, length - len(data)))
                if not chunk:
                    break
                data += chunk
            print(data.decode("utf-8"))
        """)
        result = self._exec(client_script)
        if not result.success:
            return result  # couldn't reach the daemon (e.g. it died/OOM'd)

        try:
            payload = json.loads(result.stdout.strip())
        except ValueError:
            return ExecutionResult("", f"malformed session response: {result.stdout[:500]}", 1)

        error = payload.get("error")
        stderr = payload.get("stderr", "")
        if error:
            stderr = (stderr + "\n" + error).strip()
        return ExecutionResult(payload.get("stdout", ""), stderr, 1 if error else 0)

    def install_package(self, package: str) -> ExecutionResult:
        """Install a pip package into the running container."""
        self._ensure_running()
        exit_code, output = self._container.exec_run(
            ["pip", "install", "--quiet", package],
            demux=False,
        )
        stdout = (output or b"").decode("utf-8", errors="replace")
        return ExecutionResult(stdout, "", exit_code or 0)

    def reset_session(self):
        """Kill the in-container worker and drop its socket/pidfile; the
        next execute_session call lazily starts a fresh one from scratch."""
        self._ensure_running()
        self._container.exec_run([
            "sh", "-c",
            f"kill -9 $(cat {self._session_pid_file} 2>/dev/null) 2>/dev/null; "
            f"rm -f {self._session_sock} {self._session_pid_file}"
        ])
        self._session_started = False

    def upload_file(self, path: str, content: bytes) -> ExecutionResult:
        """
        Upload a single file into the container.
        content is raw bytes — caller handles encoding (csv, pickle, binary, etc.)
        """
        self._ensure_running()
        path = self._validate_path(path)
        dirpath = os.path.dirname(path)
        filename = os.path.basename(path)

        self._container.exec_run(["mkdir", "-p", dirpath])

        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w") as tar:
            info = tarfile.TarInfo(name=filename)
            info.size = len(content)
            tar.addfile(info, io.BytesIO(content))
        buf.seek(0)

        success = self._container.put_archive(dirpath, buf)
        if success:
            return ExecutionResult(f"Uploaded: {path}", "", 0)
        return ExecutionResult("", f"Upload failed: {path}", 1)


class CloudRunSandboxBackend(SandboxBackend):
    """
    Backend for Google Cloud Run's native sandbox feature (public preview,
    https://docs.cloud.google.com/run/docs/code-execution).

    Unlike DockerBackend, this doesn't manage a separate container from the
    outside — it shells out to the `sandbox` CLI binary that Cloud Run mounts
    into your OWN running instance once the service/job/worker pool is
    deployed with `--sandbox-launcher`. It only works inside such a deployed
    resource; the `sandbox` binary won't exist in local dev.

    One persistent, named sandbox is launched with an idle entrypoint
    (`sandbox run --write --detach ... sleep <idle_seconds>`); its filesystem
    overlay survives across `sandbox exec` calls until stop() deletes it —
    same mental model as DockerBackend keeping one container alive. File I/O
    goes through a bind mount between host_workspace (real path in this
    container) and workspace_root (its path as seen inside the sandbox), so
    write_file/read_file/list_dir/upload_file are plain local file I/O with
    no subprocess call needed.

    execute_session still uses pickle-per-call here (unchanged) — the same
    persistent-worker-over-a-socket trick DockerBackend now uses would work
    just as well, since `sandbox exec` is a fresh process per call same as
    `docker exec`, but that swap hasn't been made yet.

    NOTE: --mount is only documented for `sandbox do`; applying it to
    `sandbox run` here is a reasonable extrapolation (run is the launch phase
    `do` wraps) but worth confirming against `sandbox run -h` on your image
    if the mount doesn't show up as expected.
    """

    SANDBOX_BIN = "/usr/local/gcp/bin/sandbox"

    def __init__(
        self,
        session_name: str = "agent-sandbox",
        host_workspace: str = "/tmp/sandbox_workspace",
        sandbox_workspace: str = "/workspace",
        python_bin: str = "/usr/bin/python3",
        timeout: int = 30,
        allow_egress: bool = False,
        env: dict | None = None,
        idle_seconds: int = 12 * 60 * 60,
    ):
        self.session_name = session_name
        self.host_workspace = os.path.abspath(host_workspace)
        self.workspace_root = sandbox_workspace
        self.python_bin = python_bin
        self.timeout = timeout
        self.allow_egress = allow_egress
        self.env = env or {}
        self.idle_seconds = idle_seconds
        self._started = False

        os.makedirs(self.host_workspace, exist_ok=True)

    # ------------------------------------------------------------------ #
    #  Lifecycle                                                           #
    # ------------------------------------------------------------------ #

    def start(self) -> "CloudRunSandboxBackend":
        if not os.path.exists(self.SANDBOX_BIN):
            raise RuntimeError(
                f"{self.SANDBOX_BIN} not found. CloudRunSandboxBackend only works "
                "inside a Cloud Run resource deployed with --sandbox-launcher."
            )

        args = [
            self.SANDBOX_BIN, "run", "--write",
            "--mount", f"type=bind,source={self.host_workspace},destination={self.workspace_root}",
            self.session_name, "--detach",
            "--", "/bin/sleep", str(self.idle_seconds),
        ]
        proc = subprocess.run(args, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"Failed to start sandbox '{self.session_name}': {proc.stderr}")

        self._started = True
        return self

    def stop(self) -> None:
        if self._started:
            subprocess.run([self.SANDBOX_BIN, "delete", self.session_name], capture_output=True, text=True)
            self._started = False

    def _ensure_running(self):
        if not self._started:
            raise RuntimeError("CloudRunSandboxBackend not started. Use .start() or `with` block.")

    # ------------------------------------------------------------------ #
    #  Core executor                                                       #
    # ------------------------------------------------------------------ #

    def _sandbox_exec(
        self, cmd: list[str], allow_egress: bool | None = None, timeout: int | None = None
    ) -> ExecutionResult:
        self._ensure_running()

        args = [self.SANDBOX_BIN, "exec", self.session_name]
        if self.allow_egress if allow_egress is None else allow_egress:
            args.append("--allow-egress")
        for key, value in self.env.items():
            args += ["--env", f"{key}={value}"]
        args += ["--"] + cmd

        try:
            proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout or self.timeout)
            return ExecutionResult(proc.stdout[:50_000], proc.stderr, proc.returncode)
        except subprocess.TimeoutExpired as e:
            stdout = e.stdout if isinstance(e.stdout, str) else (e.stdout or b"").decode("utf-8", errors="replace")
            stderr = e.stderr if isinstance(e.stderr, str) else (e.stderr or b"").decode("utf-8", errors="replace")
            return ExecutionResult(stdout, stderr, -1, timed_out=True)
        except Exception as e:
            return ExecutionResult("", str(e), -1)

    # ------------------------------------------------------------------ #
    #  Path validation                                                     #
    # ------------------------------------------------------------------ #

    def _validate_path(self, path: str) -> tuple[str, str]:
        """Returns (host_path, sandbox_path) for a path given relative to workspace_root."""
        if not path.startswith(self.workspace_root):
            path = os.path.join(self.workspace_root, path.lstrip("/"))
        relative = os.path.relpath(path, self.workspace_root)
        if relative.startswith(".."):
            raise ValueError(f"Path escape attempt blocked: {path}")
        host_path = self.host_workspace if relative == "." else os.path.join(self.host_workspace, relative)
        return host_path, path

    # ------------------------------------------------------------------ #
    #  File operations — direct host I/O via the bind mount                #
    # ------------------------------------------------------------------ #

    def write_file(self, path: str, content: str) -> ExecutionResult:
        host_path, sandbox_path = self._validate_path(path)
        os.makedirs(os.path.dirname(host_path), exist_ok=True)
        with open(host_path, "w") as f:
            f.write(content)
        return ExecutionResult(f"Written: {sandbox_path}", "", 0)

    def read_file(self, path: str) -> ExecutionResult:
        host_path, sandbox_path = self._validate_path(path)
        try:
            with open(host_path, "r") as f:
                return ExecutionResult(f.read(), "", 0)
        except FileNotFoundError:
            return ExecutionResult("", f"File not found: {sandbox_path}", 1)

    def list_dir(self, path: str = "/workspace") -> ExecutionResult:
        host_path, _ = self._validate_path(path)
        try:
            return ExecutionResult(json.dumps(sorted(os.listdir(host_path))), "", 0)
        except FileNotFoundError as e:
            return ExecutionResult("", str(e), 1)

    def upload_file(self, path: str, content: bytes) -> ExecutionResult:
        host_path, sandbox_path = self._validate_path(path)
        os.makedirs(os.path.dirname(host_path), exist_ok=True)
        with open(host_path, "wb") as f:
            f.write(content)
        return ExecutionResult(f"Uploaded: {sandbox_path}", "", 0)

    # ------------------------------------------------------------------ #
    #  Public execution API                                                #
    # ------------------------------------------------------------------ #

    def execute_code(self, code: str) -> ExecutionResult:
        """Stateless execution — no state persists between calls."""
        script_name = f"_script_{uuid.uuid4().hex}.py"
        host_path, sandbox_path = self._validate_path(script_name)
        with open(host_path, "w") as f:
            f.write(code)
        try:
            return self._sandbox_exec([self.python_bin, sandbox_path])
        finally:
            try:
                os.remove(host_path)
            except OSError:
                pass

    def execute_session(self, code: str) -> ExecutionResult:
        """
        Stateful execution — variables persist between calls via pickle.
        `sandbox exec` still spawns a fresh process each call (only the named
        sandbox's filesystem overlay is long-lived), so state is threaded
        through a pickle file exactly like DockerBackend used to do it. The
        pickle lives at /tmp inside the sandbox's own overlay, not the bind
        mount.
        """
        session_file = "/tmp/.session_state.pkl"
        wrapper = textwrap.dedent(f"""\
            import pickle, os, sys

            SESSION_FILE = {session_file!r}
            _globals = {{}}

            if os.path.exists(SESSION_FILE):
                try:
                    with open(SESSION_FILE, "rb") as _f:
                        _globals = pickle.load(_f)
                except Exception:
                    pass

            def _is_picklable(obj):
                try:
                    pickle.dumps(obj)
                    return True
                except Exception:
                    return False

            try:
                exec(compile({code!r}, "<agent>", "exec"), _globals)
            except Exception as _e:
                print(f"Error: {{_e}}", file=sys.stderr)
                sys.exit(1)
            finally:
                _saveable = {{
                    k: v for k, v in _globals.items()
                    if not k.startswith("_") and _is_picklable(v)
                }}
                with open(SESSION_FILE, "wb") as _f:
                    pickle.dump(_saveable, _f)
        """)
        script_name = f"_session_{uuid.uuid4().hex}.py"
        host_path, sandbox_path = self._validate_path(script_name)
        with open(host_path, "w") as f:
            f.write(wrapper)
        try:
            return self._sandbox_exec([self.python_bin, sandbox_path])
        finally:
            try:
                os.remove(host_path)
            except OSError:
                pass

    def install_package(self, package: str) -> ExecutionResult:
        """
        Installs into the sandbox's own overlay via `python -m pip` — needs
        egress to reach PyPI, and persists only as long as this named
        sandbox lives (i.e. until stop() or process exit).
        """
        return self._sandbox_exec([self.python_bin, "-m", "pip", "install", "--quiet", package], allow_egress=True)

    def reset_session(self) -> None:
        """Clear session state — start fresh analysis."""
        self._sandbox_exec(["rm", "-f", "/tmp/.session_state.pkl"])


# ---------------------------------------------------------------------- #
#  In-process sandbox — used by SubprocessBackend.execute_session          #
# ---------------------------------------------------------------------- #
#
# No container, no VM: isolation here is a denylist (blocked imports and
# builtins) plus a CPU-time rlimit, not a real jail — no seccomp, no
# namespaces, no memory cgroup. A memory rlimit is deliberately left out:
# numpy/BLAS reserve large virtual address ranges on import regardless of
# actual usage, so RLIMIT_AS kills legitimate code.

DENIED_IMPORTS = {
    "os", "sys", "subprocess", "socket", "shutil", "ctypes",
    "multiprocessing", "threading", "importlib", "ftplib", "ssl", "pty",
}
DENIED_CALLS = {"eval", "exec", "__import__", "compile", "open"}


class SandboxSecurityError(Exception):
    pass


def _check_ast(code: str) -> None:
    tree = ast.parse(code)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root in DENIED_IMPORTS:
                    raise SandboxSecurityError(f"import of '{root}' is not allowed in the sandbox")
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root in DENIED_IMPORTS:
                raise SandboxSecurityError(f"import of '{root}' is not allowed in the sandbox")
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in DENIED_CALLS:
                raise SandboxSecurityError(f"call to '{node.func.id}' is not allowed in the sandbox")


def _worker(inbox: mp.Queue, outbox: mp.Queue, cpu_seconds: int) -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
    namespace: dict[str, Any] = {}
    while True:
        msg = inbox.get()
        if msg is None:
            return
        if isinstance(msg, tuple) and msg[0] == "__export_csv__":
            _, varname = msg
            try:
                obj = namespace[varname]
                outbox.put({"csv": obj.to_csv(index=False), "error": None})
            except Exception:
                outbox.put({"csv": None, "error": traceback.format_exc(limit=3)})
            continue

        code = msg
        out, err = io.StringIO(), io.StringIO()
        payload = {"stdout": "", "stderr": "", "error": None, "vars": []}
        try:
            _check_ast(code)
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                exec(compile(code, "<sandbox>", "exec"), namespace)
            payload["vars"] = sorted(k for k in namespace if not k.startswith("_"))
        except Exception:
            payload["error"] = traceback.format_exc(limit=3)
        payload["stdout"] = out.getvalue()[-4000:]
        payload["stderr"] = err.getvalue()[-2000:]
        outbox.put(payload)


@dataclass
class SandboxResult:
    stdout: str
    stderr: str
    error: str | None
    duration_s: float
    variables: list[str] = field(default_factory=list)
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        return self.error is None and not self.timed_out


class Sandbox:
    def __init__(self, timeout_s: float = 15.0, cpu_seconds: int = 10):
        self.timeout_s = timeout_s
        self.cpu_seconds = cpu_seconds
        self._start_worker()

    def _start_worker(self) -> None:
        self._inbox: mp.Queue = mp.Queue()
        self._outbox: mp.Queue = mp.Queue()
        self._proc = mp.Process(target=_worker, args=(self._inbox, self._outbox, self.cpu_seconds), daemon=True)
        self._proc.start()

    def run(self, code: str) -> SandboxResult:
        start = time.time()
        try:
            _check_ast(code)
        except SandboxSecurityError as exc:
            return SandboxResult(stdout="", stderr="", error=str(exc), duration_s=0.0)
        except SyntaxError as exc:
            return SandboxResult(stdout="", stderr="", error=f"SyntaxError: {exc}", duration_s=0.0)

        self._inbox.put(code)
        try:
            result = self._outbox.get(timeout=self.timeout_s)
        except queue.Empty:
            self._proc.terminate()
            self._start_worker()  # fresh worker; prior namespace is lost, by design
            return SandboxResult(
                stdout="", stderr="", error="execution timed out; sandbox state was reset",
                duration_s=self.timeout_s, timed_out=True,
            )
        return SandboxResult(
            stdout=result["stdout"], stderr=result["stderr"], error=result["error"],
            duration_s=time.time() - start, variables=result["vars"],
        )

    def export_dataframe_csv(self, varname: str) -> str:
        """Pulls a full dataframe out as CSV text via a dedicated protocol
        message — not through run()'s stdout channel, which is capped at
        4000 chars for chat-sized output. Used by the train_ml_model tool to
        hand real data to OptunaTrainer without a truncation bug."""
        self._inbox.put(("__export_csv__", varname))
        result = self._outbox.get(timeout=self.timeout_s)
        if result.get("error"):
            raise RuntimeError(result["error"])
        return result["csv"]

    def shutdown(self) -> None:
        try:
            self._inbox.put(None)
        except Exception:
            pass
        self._proc.terminate()


class SubprocessBackend(SandboxBackend):
    """
    Temporary local backend — no container, no VM. execute_code runs as a
    plain subprocess on the host; execute_session delegates to Sandbox
    above (a persistent in-process worker), so state is a real live Python
    namespace, not a pickle file. There is no OS-level isolation here at
    all — no cgroups, no dropped capabilities, no network namespace — so
    the AST denylist + CPU rlimit are the only guardrail. Meant for quick
    local iteration, not untrusted code; use DockerBackend for that.
    """

    def __init__(
        self,
        workspace: str = "./sandbox_subprocess",
        python_bin: str | None = None,
        timeout: int = 30,
        cpu_seconds: int = 20,
    ):
        import sys
        self.workspace_root = os.path.abspath(workspace)
        self.python_bin = python_bin or sys.executable
        self.timeout = timeout
        self.cpu_seconds = cpu_seconds
        self._packages_dir = os.path.join(self.workspace_root, ".packages")
        self._session: Sandbox | None = None  # lazy — only spawned if execute_session is used

        os.makedirs(self.workspace_root, exist_ok=True)
        os.makedirs(self._packages_dir, exist_ok=True)

    # ------------------------------------------------------------------ #
    #  Lifecycle                                                           #
    # ------------------------------------------------------------------ #

    def start(self) -> "SubprocessBackend":
        return self  # nothing to provision — workspace dir already exists

    def stop(self) -> None:
        if self._session:
            self._session.shutdown()
            self._session = None

    # ------------------------------------------------------------------ #
    #  Path validation                                                     #
    # ------------------------------------------------------------------ #

    def _validate_path(self, path: str) -> str:
        if path in ("/workspace", self.workspace_root):
            return self.workspace_root
        if not path.startswith(self.workspace_root):
            path = os.path.join(self.workspace_root, path.lstrip("/"))
        relative = os.path.relpath(path, self.workspace_root)
        if relative.startswith(".."):
            raise ValueError(f"Path escape attempt blocked: {path}")
        return path

    # ------------------------------------------------------------------ #
    #  Core executor                                                       #
    # ------------------------------------------------------------------ #

    def _spawn(self, code: str) -> ExecutionResult:
        try:
            _check_ast(code)
        except SandboxSecurityError as exc:
            return ExecutionResult("", str(exc), 1)
        except SyntaxError as exc:
            return ExecutionResult("", f"SyntaxError: {exc}", 1)

        script_path = os.path.join(self.workspace_root, f"_script_{uuid.uuid4().hex}.py")
        with open(script_path, "w") as f:
            f.write(code)

        env = dict(os.environ)
        env["PYTHONPATH"] = self._packages_dir + os.pathsep + env.get("PYTHONPATH", "")

        def _limit_cpu():
            resource.setrlimit(resource.RLIMIT_CPU, (self.cpu_seconds, self.cpu_seconds))

        try:
            proc = subprocess.run(
                [self.python_bin, script_path],
                cwd=self.workspace_root,
                env=env,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                preexec_fn=_limit_cpu,
            )
            return ExecutionResult(proc.stdout[-50_000:], proc.stderr[-10_000:], proc.returncode)
        except subprocess.TimeoutExpired as e:
            return ExecutionResult(e.stdout or "", e.stderr or "", -1, timed_out=True)
        finally:
            try:
                os.remove(script_path)
            except OSError:
                pass

    # ------------------------------------------------------------------ #
    #  Public execution API                                                #
    # ------------------------------------------------------------------ #

    def execute_code(self, code: str) -> ExecutionResult:
        """Stateless execution — fresh subprocess each call."""
        return self._spawn(code)

    def execute_session(self, code: str) -> ExecutionResult:
        """
        Stateful execution via the in-process persistent worker (Sandbox).
        Real object persistence, no pickling — but note it only gains the
        AST denylist + CPU rlimit, same as execute_code; 'session' mode
        doesn't add extra isolation here.
        """
        if self._session is None:
            self._session = Sandbox(timeout_s=self.timeout, cpu_seconds=self.cpu_seconds)
        result = self._session.run(code)
        stderr = result.stderr
        if result.error:
            stderr = (stderr + "\n" + result.error).strip()
        return ExecutionResult(result.stdout, stderr, 0 if result.ok else 1, timed_out=result.timed_out)

    def install_package(self, package: str) -> ExecutionResult:
        """
        Installs into an isolated --target dir under the workspace (added to
        PYTHONPATH for subsequent execute_code calls) rather than the host's
        global site-packages, so a temporary backend doesn't leave packages
        behind in the orchestrator's own environment.
        """
        proc = subprocess.run(
            [self.python_bin, "-m", "pip", "install", "--quiet", "--target", self._packages_dir, package],
            capture_output=True, text=True,
        )
        return ExecutionResult(proc.stdout, proc.stderr, proc.returncode)

    def reset_session(self) -> None:
        if self._session:
            self._session.shutdown()
            self._session = None

    # ------------------------------------------------------------------ #
    #  File operations — plain local I/O, same shape as CloudRunSandboxBackend #
    # ------------------------------------------------------------------ #

    def write_file(self, path: str, content: str) -> ExecutionResult:
        path = self._validate_path(path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
        return ExecutionResult(f"Written: {path}", "", 0)

    def read_file(self, path: str) -> ExecutionResult:
        path = self._validate_path(path)
        try:
            with open(path, "r") as f:
                return ExecutionResult(f.read(), "", 0)
        except FileNotFoundError:
            return ExecutionResult("", f"File not found: {path}", 1)

    def list_dir(self, path: str = "/workspace") -> ExecutionResult:
        path = self._validate_path(path)
        try:
            return ExecutionResult(json.dumps(sorted(os.listdir(path))), "", 0)
        except FileNotFoundError as e:
            return ExecutionResult("", str(e), 1)

    def upload_file(self, path: str, content: bytes) -> ExecutionResult:
        """Fully applicable here — a local file write, not a dummy."""
        path = self._validate_path(path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(content)
        return ExecutionResult(f"Uploaded: {path}", "", 0)


class SandboxBackendFactory:
    """
    Builds the active SandboxBackend without callers needing to know which
    implementation is in play. Selection order: explicit `backend` arg >
    SANDBOX_BACKEND env var > "docker" default.

        backend = SandboxBackendFactory.create().start()
        backend = SandboxBackendFactory.create("cloud_run", session_name="agent-1").start()
        backend = SandboxBackendFactory.create("subprocess").start()

    Register additional backends without touching this class:
        SandboxBackendFactory.register("my_backend", MyBackendClass)
    """

    _registry: dict[str, type[SandboxBackend]] = {
        "docker": DockerBackend,
        "cloud_run": CloudRunSandboxBackend,
        "subprocess": SubprocessBackend,
    }

    @classmethod
    def create(cls, backend: str | None = None, **kwargs) -> SandboxBackend:
        name = (backend or os.getenv("SANDBOX_BACKEND", "docker")).strip().lower()
        try:
            backend_cls = cls._registry[name]
        except KeyError:
            raise ValueError(f"Unknown sandbox backend '{name}'. Available: {sorted(cls._registry)}")
        return backend_cls(**kwargs)

    @classmethod
    def register(cls, name: str, backend_cls: type[SandboxBackend]) -> None:
        cls._registry[name.strip().lower()] = backend_cls