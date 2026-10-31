import base64
import hashlib
import io
import json
import logging
import os
import re
import textwrap
import threading
import time
import urllib.error
import urllib.request
import wave
from typing import Annotated, Any, Callable, List, Union
from langchain_core.tools import tool

from app.agent.sandbox import ExecutionResult, SandboxBackend, SandboxBackendFactory

GEMINI_TTS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_TTS_MODEL = "gemini-3.8-flash-tts"
MAX_VOICEOVER_CHARACTERS = 10_000
GEMINI_TTS_VOICES = {
    "Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede", "Autonoe",
    "Callirrhoe", "Charon", "Despina", "Enceladus", "Erinome", "Fenrir", "Gacrux",
    "Iapetus", "Kore", "Laomedeia", "Leda", "Orus", "Puck", "Pulcherrima",
    "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Sulafat", "Umbriel",
    "Vindemiatrix", "Zephyr", "Zubenelgenubi",
}
GEMINI_VOICE_ALIASES = {
    "en-us-standard-d": "Charon",
    "en-us-standard-c": "Kore",
    "en-us-standard-a": "Puck",
    "en-us-standard-b": "Aoede",
}
logger = logging.getLogger(__name__)


def _normalize_gemini_voice(voice_name: str) -> str:
    requested = voice_name.strip()
    if requested in GEMINI_TTS_VOICES:
        return requested
    alias = GEMINI_VOICE_ALIASES.get(requested.lower())
    if alias:
        return alias
    return "Kore"


def _extract_tts_audio(response: dict[str, Any]) -> bytes:
    output_audio = response.get("output_audio")
    if isinstance(output_audio, dict) and isinstance(output_audio.get("data"), str):
        return base64.b64decode(output_audio["data"], validate=True)

    for step in response.get("steps", []):
        for content in step.get("content", []):
            if content.get("type") == "audio" and isinstance(content.get("data"), str):
                return base64.b64decode(content["data"], validate=True)

    raise ValueError("Gemini TTS response did not contain audio data")


def _request_tts_audio(script: str, voice_name: str, style: str, api_key: str) -> bytes:
    text_part: dict[str, Any] = {"type": "text", "text": script}
    if style.strip():
        text_part["annotations"] = [{"type": "speech_metadata", "style": style.strip()}]

    body = {
        "model": GEMINI_TTS_MODEL,
        "input": [{"type": "user_input", "content": [text_part]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": voice_name}]},
    }
    request = urllib.request.Request(
        GEMINI_TTS_ENDPOINT,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=180) as result:
            return _extract_tts_audio(json.loads(result.read()))
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"Gemini TTS request failed (HTTP {error.code}): {details}") from None
    except urllib.error.URLError as error:
        raise RuntimeError(f"Gemini TTS request failed: {error.reason}") from None


def _get_result_content(result: ExecutionResult) -> str:
    """Extract string output from ExecutionResult, trying stdout, content, or output fields."""
    if hasattr(result, "stdout") and result.stdout:
        return result.stdout
    if hasattr(result, "content") and result.content:
        return str(result.content)
    if hasattr(result, "output") and result.output:
        return str(result.output)
    return ""


def _is_success(result: ExecutionResult) -> bool:
    """Check if ExecutionResult indicates success."""
    if hasattr(result, "success"):
        return bool(result.success)
    if hasattr(result, "returncode"):
        return result.returncode == 0
    if hasattr(result, "exit_code"):
        return result.exit_code == 0
    return True




def create_narrator_tools(
    backend: Union[str, SandboxBackend] = "docker",
    remotion_dir: str = "/workspace/remotion_app",
    artifact_dir: str = "/workspace/artifacts",
    artifact_registry: dict[str, str] | None = None,
    artifact_reader: Callable[[str], Any] | None = None,
    dashboard_id: str | None = None,
    **backend_kwargs: Any,
) -> List[Any]:
    """Factory creating Narrator tools bound to a specific SandboxBackend instance.

    Args:
        backend: Either a registered backend name ("docker", "cloud_run", "subprocess")
                 or an instantiated SandboxBackend instance.
        remotion_dir: Path to the Remotion project root inside the sandbox.
        artifact_dir: Path to the shared artifacts directory inside the sandbox.
        dashboard_id: Optional active dashboard ID used to isolate artifacts per dashboard.
        **backend_kwargs: Arguments passed to SandboxBackendFactory.create() if a backend name is supplied.
    """
    if isinstance(backend, str):
        sandbox = SandboxBackendFactory.create(backend, **backend_kwargs).start()
    else:
        sandbox = backend
    artifact_registry = artifact_registry or {}

    def _filter_manifest_for_dashboard(raw_manifest: str | None) -> Any:
        if not raw_manifest:
            return None
        if not dashboard_id:
            return raw_manifest
        try:
            parsed = json.loads(raw_manifest)
        except (json.JSONDecodeError, TypeError):
            return {}
        if not isinstance(parsed, dict):
            return {}
        return {
            key: meta
            for key, meta in parsed.items()
            if isinstance(meta, dict) and meta.get("dashboard_id") == dashboard_id
        }

    def ensure_remotion_project() -> None:
        package_path = f"{remotion_dir.rstrip('/')}/package.json"
        package_result = sandbox.read_file(package_path)
        if _is_success(package_result):
            try:
                package = json.loads(_get_result_content(package_result))
            except json.JSONDecodeError:
                package = {}
        else:
            package = {}
        dependencies = package.setdefault("dependencies", {})
        required_dependencies = {
            "@remotion/cli": "^4.0.0",
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "remotion": "^4.0.0",
        }
        needs_manifest_update = any(
            dependencies.get(name) != version
            for name, version in required_dependencies.items()
        )
        dependencies.update(required_dependencies)
        if not _is_success(package_result) or needs_manifest_update:
            package.setdefault("name", "tarq-generated-video")
            package.setdefault("private", True)
            package.setdefault("scripts", {"render": "remotion render"})
            sandbox.write_file(package_path, json.dumps(package, indent=2))

        entry_names = ("index.tsx", "index.jsx", "index.ts", "index.js")
        has_entrypoint = any(
            _is_success(sandbox.read_file(f"{remotion_dir.rstrip('/')}/src/{name}"))
            for name in entry_names
        )
        if not has_entrypoint:
            entry_path = f"{remotion_dir.rstrip('/')}/src/index.tsx"
            sandbox.write_file(entry_path, """import React from 'react';
import { Composition, registerRoot } from 'remotion';

const Placeholder: React.FC = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#10131a', color: '#f4f5f7', fontSize: 64 }}>
    Replace this scene with the requested video.
  </div>
);

const Root: React.FC = () => (
  <Composition id="Main" component={Placeholder} durationInFrames={150} fps={30} width={1920} height={1080} />
);

registerRoot(Root);
""")

    @tool
    def list_artifacts() -> str:
        """List all artifacts currently available to the Narrator.

        Returns artifact names, paths, types, and brief metadata so the Narrator
        can determine which artifacts are relevant to the current presentation.
        """
        manifest_path = f"{artifact_dir.rstrip('/')}/MANIFEST.json"

        if artifact_registry:
            manifest_res = sandbox.read_file(manifest_path)
            raw_manifest = _get_result_content(manifest_res) if _is_success(manifest_res) else None
            manifest = _filter_manifest_for_dashboard(raw_manifest)
            return json.dumps({"analysis_artifacts": artifact_registry, "sandbox_manifest": manifest})
        
        # Try reading MANIFEST.json first
        manifest_res = sandbox.read_file(manifest_path)
        if _is_success(manifest_res):
            raw_manifest = _get_result_content(manifest_res)
            if dashboard_id:
                return json.dumps(_filter_manifest_for_dashboard(raw_manifest) or {})
            return raw_manifest
        
        if dashboard_id:
            return json.dumps({})

        # Fallback to directory listing if no manifest exists
        list_res = sandbox.list_dir(artifact_dir)
        if _is_success(list_res):
            return _get_result_content(list_res)
            
        err = getattr(list_res, "stderr", None) or getattr(list_res, "error", "Failed to list directory")
        return json.dumps({"error": f"Failed to retrieve artifacts: {err}"})

    @tool
    def read_artifact(
        path: Annotated[str, "Path of the shared artifact to read."]
    ) -> str:
        """Read the contents of an analysis artifact.

        Artifacts may contain widget definitions, materialized data, analysis
        results, narrative information, or other presentation inputs.
        """
        if path in artifact_registry.values():
            if os.path.isfile(path):
                try:
                    with open(path, "r", encoding="utf-8") as artifact_file:
                        return artifact_file.read()
                except (OSError, UnicodeError) as error:
                    return json.dumps({"error": f"Failed to read {path}: {error}"})
            if artifact_reader is not None:
                try:
                    source_result = artifact_reader(path)
                    if _is_success(source_result):
                        return _get_result_content(source_result)
                except Exception as error:
                    return json.dumps({"error": f"Failed to read {path}: {error}"})

        res = sandbox.read_file(path)
        if _is_success(res):
            return _get_result_content(res)
        
        err = getattr(res, "stderr", None) or getattr(res, "error", f"Failed to read {path}")
        return json.dumps({"error": str(err)})

    @tool
    def generate_voiceover(
        script: Annotated[str, "The exact spoken narration to synthesize."],
        voice_name: Annotated[str, "Gemini TTS prebuilt voice name."] = "Kore",
        style: Annotated[str, "Short delivery direction, such as calm and informative."] = "",
    ) -> str:
        """Generate narration audio and save it where the Remotion composition can load it."""
        clean_script = script.strip()
        if not clean_script:
            return json.dumps({"status": "error", "error": "The narration script cannot be empty."})
        if len(clean_script) > MAX_VOICEOVER_CHARACTERS:
            return json.dumps({
                "status": "error",
                "error": f"Narration exceeds the {MAX_VOICEOVER_CHARACTERS}-character limit.",
            })

        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return json.dumps({
                "status": "error",
                "error": "Set GOOGLE_API_KEY to enable Gemini voiceover generation.",
            })

        try:
            provider_voice = _normalize_gemini_voice(voice_name)
            audio = _request_tts_audio(clean_script, provider_voice, style, api_key)
            with wave.open(io.BytesIO(audio), "rb") as wav_file:
                duration_seconds = wav_file.getnframes() / wav_file.getframerate()
        except (RuntimeError, ValueError, wave.Error, ZeroDivisionError) as error:
            return json.dumps({"status": "error", "error": str(error)})

        digest = hashlib.sha256(
            f"{clean_script}\0{provider_voice}\0{style}".encode("utf-8")
        ).hexdigest()[:16]
        relative_path = f"audio/voiceover_{digest}.wav"
        full_path = f"{remotion_dir.rstrip('/')}/public/{relative_path}"
        upload_result = sandbox.upload_file(full_path, audio)
        if not _is_success(upload_result):
            error = getattr(upload_result, "stderr", None) or getattr(upload_result, "error", "Upload failed")
            return json.dumps({"status": "error", "error": str(error)})

        return json.dumps({
            "status": "success",
            "remotion_public_path": relative_path,
            "duration_seconds": round(duration_seconds, 2),
            "voice_name": provider_voice,
        })

    @tool
    def execute_readonly_sql(
        connection: Annotated[
            str,
            "Allowlisted read-only database connection name (e.g., 'financials', 'default').",
        ],
        query: Annotated[str, "Read-only SQL query to execute."],
    ) -> str:
        """Execute a read-only SQL query inside the sandbox and return structured results.

        Use this when a visualization contains a SQL source instead of
        materialized data. Only SELECT-style read-only queries against
        allowlisted connections are permitted.
        """
        clean_query = query.strip().lower()
        if not (clean_query.startswith("select") or clean_query.startswith("with")):
            return json.dumps({
                "status": "error",
                "error": "Security Violation: Only SELECT and WITH (CTE) queries are permitted.",
            })

        script = textwrap.dedent(f"""\
            import sqlite3, json, pandas as pd

            connections = {{
                "financials": "/workspace/data/financials.db",
                "default": "/workspace/data/app.db"
            }}
            db_path = connections.get({connection!r})
            if not db_path:
                print(json.dumps({{"status": "error", "error": f"Unknown connection {connection!r}"}}))
            else:
                try:
                    conn = sqlite3.connect(f"file:{{db_path}}?mode=ro", uri=True)
                    df = pd.read_sql_query({query!r}, conn)
                    conn.close()
                    print(json.dumps({{
                        "status": "success",
                        "row_count": len(df),
                        "columns": list(df.columns),
                        "data": df.to_dict(orient="records")
                    }}))
                except Exception as e:
                    print(json.dumps({{"status": "error", "error": str(e)}}))
        """)

        res = sandbox.execute_session(script)
        if _is_success(res):
            return _get_result_content(res)
        
        err = getattr(res, "stderr", None) or getattr(res, "error", "Execution failed")
        return json.dumps({"status": "error", "error": str(err)})

    @tool
    def write_video_file(
        path: Annotated[
            str,
            "Path inside the Remotion workspace (e.g., 'src/Composition.tsx').",
        ],
        content: Annotated[
            str, "Complete TypeScript or TSX source code to write."
        ],
    ) -> str:
        """Create or replace a Remotion TypeScript/TSX source file.

        Use the existing Remotion component library, animation primitives, and
        design system whenever possible. Use `.tsx` for source containing JSX
        and `.ts` only for TypeScript without JSX.
        """
        suffix = os.path.splitext(path)[1].lower()
        if suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            return "Rejected source path: use a .ts, .tsx, .js, or .jsx extension."
        jsx_opening_tag = re.search(
            r"</[A-Za-z][\w.:-]*\s*>|<[A-Za-z][\w.:-]*\s+[^<>]*?/?>|<[A-Za-z][\w.:-]*\s*/>|<>|</>",
            content,
        )
        if suffix in {".ts", ".js"} and jsx_opening_tag:
            jsx_extension = ".tsx" if suffix == ".ts" else ".jsx"
            return (
                f"Rejected JSX in {suffix} source. Rename this file to "
                f"{os.path.splitext(path)[0]}{jsx_extension} "
                "and write it again. Use .tsx/.jsx whenever the source contains JSX."
            )
        ensure_remotion_project()
        full_path = (
            path
            if path.startswith(remotion_dir)
            else f"{remotion_dir.rstrip('/')}/{path.lstrip('/')}"
        )
        
        res = sandbox.write_file(full_path, content)
        if _is_success(res):
            return f"Successfully wrote file to {full_path}"
        
        err = getattr(res, "stderr", None) or getattr(res, "error", "Write failed")
        return f"Failed to write file at {full_path}: {err}"

    @tool
    def read_video_file(
        path: Annotated[
            str, "Path of an existing file inside the Remotion workspace."
        ]
    ) -> str:
        """Read an existing Remotion source file.

        Use this before modifying existing compositions or reusable components.
        """
        ensure_remotion_project()
        full_path = (
            path
            if path.startswith(remotion_dir)
            else f"{remotion_dir.rstrip('/')}/{path.lstrip('/')}"
        )
        
        res = sandbox.read_file(full_path)
        if _is_success(res):
            return _get_result_content(res)
            
        err = getattr(res, "stderr", None) or getattr(res, "error", "Read failed")
        return f"Failed to read file at {full_path}: {err}"

    @tool
    def render_video(
        composition_id: Annotated[
            str, "Remotion composition identifier to render."
        ],
        output_path: Annotated[
            str, "Output MP4 path inside the shared artifact directory."
        ],
    ) -> str:
        """Render a Remotion composition to an MP4 file.

        Returns the final artifact path and render status.
        """
        display_name = os.path.basename(output_path)
        if dashboard_id and not display_name.startswith(f"{dashboard_id}_"):
            filename = f"{dashboard_id}_{display_name}"
        else:
            filename = display_name
        target_path = (
            output_path
            if (output_path.startswith(artifact_dir) and not dashboard_id)
            else f"{artifact_dir.rstrip('/')}/{filename}"
        )
        started_at = time.monotonic()
        logger.info(
            "Starting video render: composition=%s output=%s dashboard_id=%s",
            composition_id,
            filename,
            dashboard_id,
        )
        ensure_remotion_project()
        logger.info("Remotion project prepared for composition=%s", composition_id)

        script = textwrap.dedent(f"""\
            import json, os, subprocess
            from pathlib import Path

            project = Path({remotion_dir!r})
            output_path = Path({target_path!r})
            output_path.parent.mkdir(parents=True, exist_ok=True)
            if not (project / "node_modules" / ".bin" / "remotion").exists():
                install = subprocess.run(["npm", "install", "--no-audit", "--no-fund"], cwd=project, capture_output=True, text=True)
                if install.returncode != 0:
                    print(json.dumps({{"status": "error", "logs": install.stderr or install.stdout}}))
                    raise SystemExit(0)

            entry = next((name for name in ("src/index.tsx", "src/index.jsx", "src/index.ts", "src/index.js") if (project / name).is_file()), None)
            if entry is None:
                print(json.dumps({{"status": "error", "error": "Remotion entrypoint missing; create src/index.ts with registerRoot and a Composition."}}))
                raise SystemExit(0)

            cmd = ["npx", "remotion", "render", entry, {composition_id!r}, str(output_path), "--concurrency=1"]
            render_env = os.environ.copy()
            render_env["NODE_OPTIONS"] = "--max-old-space-size=1024"
            res = subprocess.run(cmd, cwd=project, capture_output=True, text=True, env=render_env)
            if res.returncode == 0:
                manifest_path = Path({artifact_dir!r}) / "MANIFEST.json"
                manifest_path.parent.mkdir(parents=True, exist_ok=True)
                try:
                    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    manifest = {{}}
                entry_meta = {{"type": "video/mp4", "path": str(output_path), "composition_id": {composition_id!r}, "size": output_path.stat().st_size}}
                if {dashboard_id!r}:
                    entry_meta["dashboard_id"] = {dashboard_id!r}
                    entry_meta["name"] = {display_name!r}
                manifest[output_path.name] = entry_meta
                manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
                print(json.dumps({{
                    "status": "success",
                    "composition_id": {composition_id!r},
                    "artifact_path": str(output_path),
                    "filename": output_path.name,
                    "dashboard_id": {dashboard_id!r},
                    "size": output_path.stat().st_size
                }}))
            else:
                print(json.dumps({{
                    "status": "error",
                    "logs": res.stderr or res.stdout
                }}))
        """)

        stop_heartbeat = threading.Event()

        def log_render_heartbeat() -> None:
            while not stop_heartbeat.wait(30):
                logger.info(
                    "Video render still running: composition=%s elapsed_seconds=%.0f",
                    composition_id,
                    time.monotonic() - started_at,
                )

        heartbeat = threading.Thread(target=log_render_heartbeat, daemon=True)
        heartbeat.start()
        try:
            res = sandbox.execute_session(script)
        except Exception:
            logger.exception(
                "Video render execution failed: composition=%s elapsed_seconds=%.1f",
                composition_id,
                time.monotonic() - started_at,
            )
            raise
        finally:
            stop_heartbeat.set()
            heartbeat.join()

        if _is_success(res):
            result_content = _get_result_content(res)
            try:
                result_payload = json.loads(result_content)
            except (json.JSONDecodeError, TypeError):
                result_payload = {}
            if result_payload.get("status") == "success":
                logger.info(
                    "Video render completed: composition=%s output=%s elapsed_seconds=%.1f size_bytes=%s",
                    composition_id,
                    filename,
                    time.monotonic() - started_at,
                    result_payload.get("size"),
                )
            else:
                logger.error(
                    "Video render returned an error: composition=%s output=%s elapsed_seconds=%.1f details=%s",
                    composition_id,
                    filename,
                    time.monotonic() - started_at,
                    result_payload.get("error") or result_payload.get("logs") or result_content,
                )
            return result_content

        err = getattr(res, "stderr", None) or getattr(res, "error", "Render session execution failed")
        logger.error(
            "Video render failed: composition=%s output=%s elapsed_seconds=%.1f error=%s",
            composition_id,
            filename,
            time.monotonic() - started_at,
            err,
        )
        return json.dumps({"status": "error", "error": str(err)})

    return [
        list_artifacts,
        read_artifact,
        generate_voiceover,
        execute_readonly_sql,
        write_video_file,
        read_video_file,
        render_video,
    ]
