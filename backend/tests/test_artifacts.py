import json

from app.routers import artifacts


def test_list_artifacts_returns_manifest_files(tmp_path, monkeypatch):
    (tmp_path / "video.mp4").write_bytes(b"video")
    (tmp_path / "MANIFEST.json").write_text(
        json.dumps({"video.mp4": {"type": "video/mp4"}}),
        encoding="utf-8",
    )
    monkeypatch.setattr(artifacts, "ARTIFACT_DIR", tmp_path)

    result = artifacts.list_artifacts()

    assert result == [{
        "id": "video.mp4",
        "name": "video.mp4",
        "type": "video/mp4",
        "size": 5,
        "url": "/artifacts/video.mp4",
    }]


def test_download_artifact_rejects_path_traversal():
    from fastapi import HTTPException

    try:
        artifacts.download_artifact("../secret")
    except HTTPException as error:
        assert error.status_code == 400
    else:
        raise AssertionError("path traversal should be rejected")