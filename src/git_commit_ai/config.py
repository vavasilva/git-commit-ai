"""Configuration management for git-commit-ai."""

import tomllib
from pathlib import Path
from dataclasses import dataclass, field


@dataclass
class Config:
    """Configuration settings for git-commit-ai."""

    model: str = "llama3.1:8b"
    ollama_url: str = "http://localhost:11434"
    temperature: float = 0.7
    retry_temperatures: list[float] = field(default_factory=lambda: [0.5, 0.3, 0.2])

    @classmethod
    def get_config_path(cls) -> Path:
        """Get the path to the config file."""
        return Path.home() / ".config" / "git-commit-ai" / "config.toml"

    @classmethod
    def load(cls) -> "Config":
        """Load configuration from file or return defaults."""
        config_path = cls.get_config_path()

        if not config_path.exists():
            return cls()

        with open(config_path, "rb") as f:
            data = tomllib.load(f)

        return cls(
            model=data.get("model", cls.model),
            ollama_url=data.get("ollama_url", cls.ollama_url),
            temperature=data.get("temperature", cls.temperature),
            retry_temperatures=data.get(
                "retry_temperatures", cls().retry_temperatures
            ),
        )

    def save(self) -> None:
        """Save configuration to file."""
        config_path = self.get_config_path()
        config_path.parent.mkdir(parents=True, exist_ok=True)

        content = f'''# git-commit-ai configuration
model = "{self.model}"
ollama_url = "{self.ollama_url}"
temperature = {self.temperature}
retry_temperatures = {self.retry_temperatures}
'''
        config_path.write_text(content)

    def show(self) -> str:
        """Return a formatted string of the current configuration."""
        return f"""Configuration:
  Model: {self.model}
  Ollama URL: {self.ollama_url}
  Temperature: {self.temperature}
  Retry temperatures: {self.retry_temperatures}
  Config file: {self.get_config_path()}"""
