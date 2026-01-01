"""Abstract base class for LLM backends."""

from abc import ABC, abstractmethod


class Backend(ABC):
    """Abstract base class for commit message generation backends."""

    @abstractmethod
    def generate(self, prompt: str, temperature: float = 0.7) -> str:
        """Generate a response from the LLM.

        Args:
            prompt: The prompt to send to the LLM.
            temperature: Sampling temperature (0.0-1.0).

        Returns:
            The generated text response.
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the backend is available and ready to use.

        Returns:
            True if the backend is available, False otherwise.
        """
        pass
