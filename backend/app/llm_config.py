from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI


def create_chat_model(settings: dict[str, Any] | None = None):
    """Create a model for one request without persisting user credentials."""
    if settings is None:
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash")

    provider = settings.get("provider")
    model = settings.get("model")
    api_key = settings.get("api_key")
    if provider not in {"google", "anthropic", "openai", "openrouter"}:
        raise ValueError("Unsupported model provider")
    if not isinstance(model, str) or not model.strip() or len(model) > 200:
        raise ValueError("A valid model name is required")
    if not isinstance(api_key, str) or not api_key.strip():
        raise ValueError(f"Add and save an API key for the selected {provider} provider")

    if provider == "google":
        return ChatGoogleGenerativeAI(model=model.strip(), google_api_key=api_key.strip())
    if provider == "anthropic":
        return ChatAnthropic(model=model.strip(), api_key=api_key.strip())
    if provider == "openai":
        return ChatOpenAI(model=model.strip(), api_key=api_key.strip())
    return ChatOpenAI(
        model=model.strip(),
        api_key=api_key.strip(),
        base_url="https://openrouter.ai/api/v1",
    )