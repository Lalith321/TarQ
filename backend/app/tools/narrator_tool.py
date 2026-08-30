from typing import Annotated, Any, List, Union
from langchain_core.tools import tool

from app.agent.sandbox import ExecutionResult, SandboxBackend, SandboxBackendFactory


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
    **backend_kwargs: Any,
) -> List[Any]:
    """Factory creating Narrator tools bound to a specific SandboxBackend instance.

    Args:
        backend: Either a registered backend name ("docker", "cloud_run", "subprocess")
                 or an instantiated SandboxBackend instance.
        remotion_dir: Path to the Remotion project root inside the sandbox.
        artifact_dir: Path to the shared artifacts directory inside the sandbox.
        **backend_kwargs: Arguments passed to SandboxBackendFactory.create() if a backend name is supplied.
    """
    if isinstance(backend, str):
        sandbox = SandboxBackendFactory.create(backend, **backend_kwargs).start()
    else:
        sandbox = backend

    @tool
    def list_artifacts() -> str:
        """List all artifacts currently available to the Narrator.

        Returns artifact names, paths, types, and brief metadata so the Narrator
        can determine which artifacts are relevant to the current presentation.
        """
        manifest_path = f"{artifact_dir.rstrip('/')}/MANIFEST.json"
        
        # Try reading MANIFEST.json first
        manifest_res = sandbox.read_file(manifest_path)
        if _is_success(manifest_res):
            return _get_result_content(manifest_res)
        
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
        res = sandbox.read_file(path)
        if _is_success(res):
            return _get_result_content(res)
        
        err = getattr(res, "stderr", None) or getattr(res, "error", f"Failed to read {path}")
        return json.dumps({"error": str(err)})

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
        design system whenever possible.
        """
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
        filename = os.path.basename(output_path)
        target_path = (
            output_path
            if output_path.startswith(artifact_dir)
            else f"{artifact_dir.rstrip('/')}/{filename}"
        )

        script = textwrap.dedent(f"""\
            import subprocess, json
            cmd = f"npx remotion render src/index.ts {composition_id!r} {target_path!r} --gl=angle"
            res = subprocess.run(cmd, shell=True, cwd={remotion_dir!r}, capture_output=True, text=True)
            if res.returncode == 0:
                print(json.dumps({{
                    "status": "success",
                    "composition_id": {composition_id!r},
                    "artifact_path": {target_path!r}
                }}))
            else:
                print(json.dumps({{
                    "status": "error",
                    "logs": res.stderr or res.stdout
                }}))
        """)

        res = sandbox.execute_session(script)
        if _is_success(res):
            return _get_result_content(res)

        err = getattr(res, "stderr", None) or getattr(res, "error", "Render session execution failed")
        return json.dumps({"status": "error", "error": str(err)})

    return [
        list_artifacts,
        read_artifact,
        execute_readonly_sql,
        write_video_file,
        read_video_file,
        render_video,
    ]
