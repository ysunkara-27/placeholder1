import os
import json
import time
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMAdapter(ABC):
    """Abstract base class for LLM adapters"""
    
    @abstractmethod
    def generate_content(self, prompt: str, response_format: str = "text") -> str:
        """Generate content from prompt"""
        pass
    
    @abstractmethod
    def get_cost_per_1m_tokens(self) -> float:
        """Get cost per 1M tokens in USD"""
        pass
    
    @abstractmethod
    def get_model_name(self) -> str:
        """Get the model name"""
        pass

class OllamaAdapter(LLMAdapter):
    """Free local LLM using Ollama"""
    
    def __init__(self, model_name: str = "llama3.1:8b", base_url: str = "http://localhost:11434"):
        self.model_name = model_name
        self.base_url = base_url
        self.session = None
        try:
            import requests
            self.session = requests.Session()
        except ImportError:
            raise ImportError("requests library required for Ollama. Install with: pip install requests")
    
    def generate_content(self, prompt: str, response_format: str = "text") -> str:
        """Generate content using Ollama"""
        if not self.session:
            raise RuntimeError("Ollama session not initialized")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Low temperature for consistent extraction
                        "top_p": 0.9,
                        "num_predict": 2048
                    }
                },
                timeout=120
            )
            response.raise_for_status()
            return response.json()["response"]
        except Exception as e:
            logger.error(f"Ollama API error: {e}")
            return ""
    
    def get_cost_per_1m_tokens(self) -> float:
        return 0.0  # Completely free
    
    def get_model_name(self) -> str:
        return f"Ollama-{self.model_name}"

class TogetherAIAdapter(LLMAdapter):
    """Together AI - Most cost-effective cloud option"""
    
    def __init__(self, model_name: str = "meta-llama/Llama-3.1-8B-Instruct"):
        self.model_name = model_name
        self.api_key = os.getenv("TOGETHER_API_KEY")
        if not self.api_key:
            raise ValueError("TOGETHER_API_KEY not found in environment variables")
        
        try:
            import requests
            self.session = requests.Session()
            self.session.headers.update({
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            })
        except ImportError:
            raise ImportError("requests library required for Together AI")
    
    def generate_content(self, prompt: str, response_format: str = "text") -> str:
        """Generate content using Together AI"""
        try:
            response = self.session.post(
                "https://api.together.xyz/v1/completions",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "max_tokens": 2048,
                    "temperature": 0.1,
                    "top_p": 0.9,
                    "stream": False
                },
                timeout=60
            )
            response.raise_for_status()
            return response.json()["choices"][0]["text"]
        except Exception as e:
            logger.error(f"Together AI API error: {e}")
            return ""
    
    def get_cost_per_1m_tokens(self) -> float:
        return 0.20  # $0.20 per 1M tokens
    
    def get_model_name(self) -> str:
        return f"Together-{self.model_name}"

class GroqAdapter(LLMAdapter):
    """Groq - Fastest and very cheap"""
    
    def __init__(self, model_name: str = "llama3.1-8b-8192"):
        self.model_name = model_name
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        try:
            import requests
            self.session = requests.Session()
            self.session.headers.update({
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            })
        except ImportError:
            raise ImportError("requests library required for Groq")
    
    def generate_content(self, prompt: str, response_format: str = "text") -> str:
        """Generate content using Groq"""
        try:
            response = self.session.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json={
                    "model": self.model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2048,
                    "temperature": 0.1,
                    "stream": False
                },
                timeout=30
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            return ""
    
    def get_cost_per_1m_tokens(self) -> float:
        return 0.10  # $0.10 per 1M tokens
    
    def get_model_name(self) -> str:
        return f"Groq-{self.model_name}"

class AnthropicAdapter(LLMAdapter):
    """Anthropic Claude Haiku - Reliable and good at extraction"""
    
    def __init__(self, model_name: str = "claude-3-haiku-20240307"):
        self.model_name = model_name
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")
        
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=self.api_key)
        except ImportError:
            raise ImportError("anthropic library required. Install with: pip install anthropic")
    
    def generate_content(self, prompt: str, response_format: str = "text") -> str:
        """Generate content using Anthropic Claude"""
        try:
            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=2048,
                temperature=0.1,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            return ""
    
    def get_cost_per_1m_tokens(self) -> float:
        return 0.25  # $0.25 per 1M tokens
    
    def get_model_name(self) -> str:
        return f"Anthropic-{self.model_name}"

class GeminiAdapter(LLMAdapter):
    """Google Gemini - Your current provider"""
    
    def __init__(self, model_name: str = "gemini-1.5-flash-latest"):
        self.model_name = model_name
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        try:
            import google.generativeai as genai
            self.genai = genai  # Store genai module as instance attribute
            genai.configure(api_key=self.api_key)
            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]
            self.model = genai.GenerativeModel(model_name, safety_settings=safety_settings)
        except ImportError:
            raise ImportError("google-generativeai library required for Gemini")
    
    def generate_content(self, prompt: str, response_format: str = "text") -> str:
        """Generate content using Gemini"""
        try:
            if response_format == "application/json":
                # Try the new response_mime_type parameter first
                try:
                    response = self.model.generate_content(
                        prompt, 
                        generation_config=self.genai.types.GenerationConfig(response_mime_type="application/json")
                    )
                except TypeError:
                    # Fallback for older versions that don't support response_mime_type
                    logger.warning("response_mime_type not supported, using fallback")
                    response = self.model.generate_content(prompt)
            else:
                response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return ""
    
    def get_cost_per_1m_tokens(self) -> float:
        return 0.50  # $0.50 per 1M tokens (approximate)
    
    def get_model_name(self) -> str:
        return f"Gemini-{self.model_name}"

class LLMFactory:
    """Factory for creating LLM adapters"""
    
    @staticmethod
    def create_adapter(provider: str, **kwargs) -> LLMAdapter:
        """Create an LLM adapter based on provider name"""
        providers = {
            "ollama": OllamaAdapter,
            "together": TogetherAIAdapter,
            "groq": GroqAdapter,
            "anthropic": AnthropicAdapter,
            "gemini": GeminiAdapter
        }
        
        if provider not in providers:
            raise ValueError(f"Unknown provider: {provider}. Available: {list(providers.keys())}")
        
        return providers[provider](**kwargs)
    
    @staticmethod
    def get_provider_info() -> Dict[str, Dict[str, Any]]:
        """Get information about all available providers"""
        return {
            "ollama": {
                "name": "Ollama (Local)",
                "cost_per_1m": 0.0,
                "setup_required": "Local Ollama installation",
                "api_key_required": False,
                "recommendation": "Best for privacy and zero cost"
            },
            "together": {
                "name": "Together AI",
                "cost_per_1m": 0.20,
                "setup_required": "API key",
                "api_key_required": True,
                "recommendation": "Most cost-effective cloud option"
            },
            "groq": {
                "name": "Groq",
                "cost_per_1m": 0.10,
                "setup_required": "API key",
                "api_key_required": True,
                "recommendation": "Fastest and cheapest cloud option"
            },
            "anthropic": {
                "name": "Anthropic Claude",
                "cost_per_1m": 0.25,
                "setup_required": "API key",
                "api_key_required": True,
                "recommendation": "Most reliable for structured extraction"
            },
            "gemini": {
                "name": "Google Gemini",
                "cost_per_1m": 0.50,
                "setup_required": "API key",
                "api_key_required": True,
                "recommendation": "Your current provider"
            }
        }

# Rate limiter for all adapters
class UniversalRateLimiter:
    """Universal rate limiter that works with any LLM adapter"""
    
    def __init__(self, adapter: LLMAdapter, requests_per_minute: int = 60):
        self.adapter = adapter
        self.rpm_limit = requests_per_minute
        self.requests = []
    
    def generate_content(self, prompt: str, response_format: str = "text") -> str:
        """Generate content with rate limiting"""
        current_time = time.time()
        
        # Clean old requests (older than 1 minute)
        self.requests = [t for t in self.requests if current_time - t < 60]
        
        # Check rate limit
        if len(self.requests) >= self.rpm_limit:
            wait_time = 60 - (current_time - self.requests[0])
            if wait_time > 0:
                logger.warning(f"Rate limit reached. Waiting {wait_time:.1f} seconds...")
                time.sleep(wait_time)
                self.requests = []  # Reset after waiting
        
        # Record this request
        self.requests.append(current_time)
        
        # Generate content
        return self.adapter.generate_content(prompt, response_format)
    
    def get_cost_per_1m_tokens(self) -> float:
        return self.adapter.get_cost_per_1m_tokens()
    
    def get_model_name(self) -> str:
        return self.adapter.get_model_name()
