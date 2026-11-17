"""نشر تدريجي (Canary) لمحوّل الوكيل مع سقوط تلقائي إلى المستقر.

- AGENT_CANARY_PERCENT (0-100، الافتراضي 0 = مغلق): نسبة المستخدمين الموجَّهين للنموذج التجريبي، ثابتة لكل مستخدم
  (هاش tenant:user) كي لا تتبدل تجربته بين رسالة وأخرى.
- VLLM_MODEL_AGENT_CANARY: اسم المحوّل التجريبي (مثل manarasy_v3). فارغ = لا canary مهما كانت النسبة.
- AGENT_CANARY_TENANTS: قائمة مساجد (مفصولة بفواصل) مسموح لها فقط بالتجربة؛ فارغ = الكل.
- AGENT_CANARY_UI_TOOL (الافتراضي 1): تفعيل أداة open_screen للمجموعة التجريبية فقط.
المستقر يستخدم VLLM_MODEL_AGENT وعلم AGENT_UI_TOOL العام (يبقى 0 ما دام المستقر v2).
الرجوع الفوري: AGENT_CANARY_PERCENT=0 (أو تفريغ VLLM_MODEL_AGENT_CANARY) ثم إعادة تشغيل الخدمة.
"""
import hashlib
import os
from dataclasses import dataclass

from .agent_tools import ui_tool_enabled
from .config import get_settings


@dataclass(frozen=True)
class Variant:
    name: str  # stable | canary
    model: str
    ui_tool: bool

    @property
    def canary(self) -> bool:
        return self.name == "canary"


def stable_variant() -> Variant:
    return Variant("stable", get_settings().vllm_model_agent, ui_tool_enabled())


def canary_percent() -> int:
    try:
        return max(0, min(100, int(os.getenv("AGENT_CANARY_PERCENT", "0"))))
    except ValueError:
        return 0


def bucket(tenant_id: str, user_id: str) -> int:
    return int(hashlib.sha256(f"{tenant_id}:{user_id}".encode("utf-8")).hexdigest()[:8], 16) % 100


def agent_variant(tenant_id: str, user_id: str) -> Variant:
    model = os.getenv("VLLM_MODEL_AGENT_CANARY", "").strip()
    pct = canary_percent()
    if not model or pct <= 0:
        return stable_variant()
    allow = {t.strip() for t in os.getenv("AGENT_CANARY_TENANTS", "").split(",") if t.strip()}
    if allow and tenant_id not in allow:
        return stable_variant()
    if bucket(tenant_id, user_id) < pct:
        return Variant("canary", model, os.getenv("AGENT_CANARY_UI_TOOL", "1") == "1")
    return stable_variant()


def describe() -> dict:
    return {
        "canary_percent": canary_percent(),
        "canary_model": os.getenv("VLLM_MODEL_AGENT_CANARY", "") or None,
        "canary_tenants": [t for t in os.getenv("AGENT_CANARY_TENANTS", "").split(",") if t.strip()],
        "stable_model": get_settings().vllm_model_agent,
        "stable_ui_tool": ui_tool_enabled(),
    }
