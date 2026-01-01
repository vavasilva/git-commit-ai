"""Ollama backend implementation."""

import httpx

from .base import Backend


class OllamaBackend(Backend):
    """Backend for generating commit messages using Ollama."""

    def __init__(
        self,
        model: str = "llama3.1:8b",
        base_url: str = "http://localhost:11434",
    ):
        self.model = model
        self.base_url = base_url

    def generate(self, prompt: str, temperature: float = 0.7) -> str:
        """Generate a commit message using Ollama API."""
        response = httpx.post(
            f"{self.base_url}/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "temperature": temperature,
                "stream": False,
            },
            timeout=60.0,
        )
        response.raise_for_status()

        data = response.json()
        return data.get("response", "")

    def is_available(self) -> bool:
        """Check if Ollama is running."""
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5.0)
            return response.status_code == 200
        except httpx.RequestError:
            return False

    def has_model(self, model: str | None = None) -> bool:
        """Check if the specified model is available.

        Args:
            model: Model name to check. Uses self.model if None.

        Returns:
            True if the model is available.
        """
        model = model or self.model
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5.0)
            if response.status_code != 200:
                return False
            data = response.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            return any(model in m for m in models)
        except httpx.RequestError:
            return False
