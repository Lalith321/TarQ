import base64
import io
import json
import wave

from app.agent.sandbox import ExecutionResult
from app.tools import narrator_tool
from app.tools.narrator_tool import create_narrator_tools


class FakeSandbox:
    def __init__(self):
        self.uploads = []
        self.files = {}
        self.executed = []

    def upload_file(self, path, content):
        self.uploads.append((path, content))
        return ExecutionResult(f"Uploaded: {path}", "", 0)

    def read_file(self, path):
        if path in self.files:
            return ExecutionResult(self.files[path], "", 0)
        return ExecutionResult("", f"File not found: {path}", 1)

    def write_file(self, path, content):
        self.files[path] = content
        return ExecutionResult(f"Written: {path}", "", 0)

    def execute_session(self, code):
        self.executed.append(code)
        return ExecutionResult('{"status":"success","artifact_path":"/workspace/artifacts/video.mp4","filename":"video.mp4","size":128}', "", 0)


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self):
        return self.body


def make_wav_bytes():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(24_000)
        wav_file.writeframes(b"\0\0" * 2_400)
    return buffer.getvalue()


def get_voiceover_tool(sandbox):
    tools = create_narrator_tools(
        backend=sandbox,
        remotion_dir="/workspace/remotion_app",
        artifact_dir="/workspace/artifacts",
    )
    return next(tool for tool in tools if tool.name == "generate_voiceover")


def test_generate_voiceover_uploads_wav_for_remotion(monkeypatch):
    audio = make_wav_bytes()
    response_body = json.dumps({
        "steps": [{
            "content": [{
                "type": "audio",
                "data": base64.b64encode(audio).decode("ascii"),
            }],
        }],
    }).encode("utf-8")
    captured = {}

    def fake_urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return FakeResponse(response_body)

    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    monkeypatch.setattr(narrator_tool.urllib.request, "urlopen", fake_urlopen)
    sandbox = FakeSandbox()

    result = json.loads(get_voiceover_tool(sandbox).invoke({
        "script": "Revenue rose steadily.",
        "voice_name": "Charon",
        "style": "calm and informative",
    }))

    assert result["status"] == "success"
    assert result["duration_seconds"] == 0.1
    assert result["remotion_public_path"].startswith("audio/voiceover_")
    assert sandbox.uploads == [(
        f"/workspace/remotion_app/public/{result['remotion_public_path']}",
        audio,
    )]
    request_body = json.loads(captured["request"].data)
    assert request_body["model"] == "gemini-3.8-flash-tts"
    assert request_body["generation_config"]["speech_config"] == [{"voice": "Charon"}]
    assert request_body["input"][0]["content"][0]["annotations"][0]["style"] == "calm and informative"
    assert captured["timeout"] == 180


def test_generate_voiceover_requires_google_api_key(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    sandbox = FakeSandbox()

    result = json.loads(get_voiceover_tool(sandbox).invoke({"script": "Hello."}))

    assert result["status"] == "error"
    assert "GOOGLE_API_KEY" in result["error"]
    assert sandbox.uploads == []


def test_google_cloud_voice_alias_maps_to_gemini_voice():
    assert narrator_tool._normalize_gemini_voice("en-US-Standard-D") == "Charon"
    assert narrator_tool._normalize_gemini_voice("Charon") == "Charon"
    assert narrator_tool._normalize_gemini_voice("unknown-provider-voice") == "Kore"


def test_read_video_file_bootstraps_remotion_entrypoint():
    sandbox = FakeSandbox()
    tools = create_narrator_tools(backend=sandbox)
    read_tool = next(tool for tool in tools if tool.name == "read_video_file")

    source = read_tool.invoke({"path": "src/index.tsx"})

    assert "registerRoot(Root)" in source
    assert "/workspace/remotion_app/package.json" in sandbox.files
    assert "/workspace/remotion_app/src/index.tsx" in sandbox.files


def test_read_video_file_does_not_shadow_existing_typescript_entrypoint():
    sandbox = FakeSandbox()
    sandbox.files["/workspace/remotion_app/src/index.ts"] = "registerRoot(Root);"
    tools = create_narrator_tools(backend=sandbox)
    read_tool = next(tool for tool in tools if tool.name == "read_video_file")

    assert read_tool.invoke({"path": "src/index.ts"}) == "registerRoot(Root);"
    assert "/workspace/remotion_app/src/index.tsx" not in sandbox.files


def test_write_video_file_rejects_jsx_in_typescript_file():
    sandbox = FakeSandbox()
    tools = create_narrator_tools(backend=sandbox)
    write_tool = next(tool for tool in tools if tool.name == "write_video_file")

    result = write_tool.invoke({
        "path": "src/index.ts",
        "content": "const Root = () => <Composition id='Main' />;",
    })

    assert "Rejected JSX in .ts source" in result
    assert "src/index.tsx" in result
    assert "src/indextsx" not in result
    assert sandbox.uploads == []
    assert "/workspace/remotion_app/src/index.ts" not in sandbox.files


def test_write_video_file_accepts_tsx_source():
    sandbox = FakeSandbox()
    tools = create_narrator_tools(backend=sandbox)
    write_tool = next(tool for tool in tools if tool.name == "write_video_file")

    result = write_tool.invoke({
        "path": "src/index.tsx",
        "content": "const Root = () => <Composition id='Main' />;",
    })

    assert "Successfully wrote file" in result
    assert sandbox.files["/workspace/remotion_app/src/index.tsx"] == (
        "const Root = () => <Composition id='Main' />;"
    )


def test_render_video_uses_npx_and_registers_shared_output():
    sandbox = FakeSandbox()
    tools = create_narrator_tools(backend=sandbox)
    render_tool = next(tool for tool in tools if tool.name == "render_video")

    result = json.loads(render_tool.invoke({"composition_id": "Main", "output_path": "comparison.mp4"}))

    assert result["status"] == "success"
    assert '"npx", "remotion", "render"' in sandbox.executed[0]
    assert "--concurrency=1" in sandbox.executed[0]
    assert "--max-old-space-size=1024" in sandbox.executed[0]
    assert "/workspace/artifacts" in sandbox.executed[0]
    assert '"src/index.tsx", "src/index.jsx", "src/index.ts"' in sandbox.executed[0]
    assert "MANIFEST.json" in sandbox.executed[0]


def test_narrator_instructions_require_mapped_animated_widgets_and_complete_audio():
    from app.agent.narrator import NARRATOR_PROMPT

    assert "Map each selected dashboard widget's data fields explicitly" in NARRATOR_PROMPT
    assert "Build animated chart elements" in NARRATOR_PROMPT
    assert "complete narration" in NARRATOR_PROMPT
    assert "short titles, labels, and key figures" in NARRATOR_PROMPT
    assert "calculateMetadata" in NARRATOR_PROMPT
    assert "stale audio filename" in NARRATOR_PROMPT