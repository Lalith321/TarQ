import pytest

from app import llm_config


def test_create_google_model_uses_selected_model_and_key(monkeypatch):
    captured = {}

    def fake_model(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(llm_config, "ChatGoogleGenerativeAI", fake_model)

    result = llm_config.create_chat_model({
        "provider": "google",
        "model": "gemini-2.5-pro",
        "api_key": "user-key",
    })

    assert result is not None
    assert captured == {"model": "gemini-2.5-pro", "google_api_key": "user-key"}


def test_create_chat_model_requires_selected_provider_key():
    with pytest.raises(ValueError, match="Add and save an API key"):
        llm_config.create_chat_model({
            "provider": "google",
            "model": "gemini-2.5-pro",
            "api_key": "",
        })
