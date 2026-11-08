"""تحميل قوالب الـ Prompts من ملفات منفصلة مع رقم الإصدار وبصمة SHA256."""
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict

from .config import PROMPTS_DIR


@dataclass(frozen=True)
class PromptTemplate:
    id: str
    version: str
    enable_thinking: bool
    max_tokens: int
    temperature: float
    system: str
    user_template: str
    sha256: str

    def render_messages(self, **kwargs) -> list[dict[str, str]]:
        safe_kwargs = {k: ("" if v is None else str(v)) for k, v in kwargs.items()}
        user_content = self.user_template.format(**safe_kwargs)
        return [
            {"role": "system", "content": self.system},
            {"role": "user", "content": user_content},
        ]


class PromptRegistry:
    def __init__(self, prompts_dir: Path | None = None):
        self.prompts_dir = prompts_dir or PROMPTS_DIR
        self._templates: Dict[str, PromptTemplate] = {}
        self.reload()

    def reload(self) -> None:
        self._templates.clear()
        if not self.prompts_dir.exists():
            return
        for path in sorted(self.prompts_dir.glob("*.json")):
            raw = path.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()[:12]
            data = json.loads(raw.decode("utf-8"))
            tpl = PromptTemplate(
                id=data["id"],
                version=data["version"],
                enable_thinking=bool(data.get("enable_thinking", False)),
                max_tokens=int(data.get("max_tokens", 384)),
                temperature=float(data.get("temperature", 0.2)),
                system=data["system"],
                user_template=data["user_template"],
                sha256=digest,
            )
            self._templates[tpl.id] = tpl

    def get(self, prompt_id: str) -> PromptTemplate:
        if prompt_id not in self._templates:
            self.reload()
        if prompt_id not in self._templates:
            raise KeyError(f"Prompt template '{prompt_id}' not found")
        return self._templates[prompt_id]

    def list_versions(self) -> dict[str, dict[str, str]]:
        return {
            k: {"version": v.version, "sha256": v.sha256, "enable_thinking": v.enable_thinking}
            for k, v in self._templates.items()
        }


registry = PromptRegistry()

