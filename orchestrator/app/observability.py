"""
المراقبة والتسجيل المنظم (Observability & Structured JSON Logging):
- تسجيل JSON لكل طلب: الزمن، عدد الـ tokens، الحالة، الدور، معرّف القالب وإصداره.
- عدم تخزين نص المحادثات الحساسة أو أي بيانات شخصية (PII) في السجلات إطلاقاً.
- توليد مقاييس بصيغة Prometheus نصية معيارية على /metrics.
"""
import hashlib
import json
import logging
import sys
import threading
from datetime import datetime, timezone

from .resilience import canary_circuit, llm_circuit, stt_circuit, tts_circuit

logger = logging.getLogger("manarasy.orchestrator")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def _hash_id(raw_id: str) -> str:
    if not raw_id or raw_id == "anonymous":
        return "anon"
    return hashlib.sha256(raw_id.encode("utf-8")).hexdigest()[:12]


class MetricsRegistry:
    def __init__(self):
        self._lock = threading.Lock()
        self.requests_total: dict[tuple[str, str, int], int] = {}
        self.tokens_total: dict[str, int] = {"prompt": 0, "completion": 0}
        self.injection_flags_total: int = 0
        self.rate_limited_total: int = 0
        self.latency_sum_ms: dict[str, float] = {}
        self.latency_count: dict[str, int] = {}
        self.cjk_guard_total: dict[tuple[str, str], int] = {}
        self.variant_total: dict[tuple[str, str], int] = {}
        self.variant_latency_sum_ms: dict[str, float] = {}
        self.variant_latency_count: dict[str, int] = {}
        self.ui_action_total: dict[str, int] = {}

    def inc_variant(self, variant: str, event: str) -> None:
        """event: request | canary_fallback | error"""
        with self._lock:
            self.variant_total[(variant, event)] = self.variant_total.get((variant, event), 0) + 1

    def observe_variant_latency(self, variant: str, latency_ms: float) -> None:
        with self._lock:
            self.variant_latency_sum_ms[variant] = self.variant_latency_sum_ms.get(variant, 0.0) + latency_ms
            self.variant_latency_count[variant] = self.variant_latency_count.get(variant, 0) + 1

    def inc_ui_action(self, via: str) -> None:
        """via: router | llm"""
        with self._lock:
            self.ui_action_total[via] = self.ui_action_total.get(via, 0) + 1

    def inc_cjk_guard(self, action: str, endpoint: str) -> None:
        with self._lock:
            key = (action, endpoint or "unknown")
            self.cjk_guard_total[key] = self.cjk_guard_total.get(key, 0) + 1

    def reset(self) -> None:
        with self._lock:
            self.requests_total.clear()
            self.tokens_total = {"prompt": 0, "completion": 0}
            self.injection_flags_total = 0
            self.rate_limited_total = 0
            self.latency_sum_ms.clear()
            self.latency_count.clear()
            self.cjk_guard_total.clear()
            self.variant_total.clear()
            self.variant_latency_sum_ms.clear()
            self.variant_latency_count.clear()
            self.ui_action_total.clear()

    def observe(
        self,
        endpoint: str,
        role: str,
        status_code: int,
        latency_ms: float,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        injection_flagged: bool = False,
    ) -> None:
        with self._lock:
            key = (endpoint, role, status_code)
            self.requests_total[key] = self.requests_total.get(key, 0) + 1
            self.tokens_total["prompt"] += max(0, int(prompt_tokens))
            self.tokens_total["completion"] += max(0, int(completion_tokens))
            if injection_flagged:
                self.injection_flags_total += 1
            if status_code == 429:
                self.rate_limited_total += 1
            self.latency_sum_ms[endpoint] = self.latency_sum_ms.get(endpoint, 0.0) + latency_ms
            self.latency_count[endpoint] = self.latency_count.get(endpoint, 0) + 1

    def render_prometheus(self) -> str:
        lines = [
            "# HELP orchestrator_requests_total Total requests processed by orchestrator",
            "# TYPE orchestrator_requests_total counter",
        ]
        with self._lock:
            for (endpoint, role, status), count in sorted(self.requests_total.items()):
                lines.append(
                    f'orchestrator_requests_total{{endpoint="{endpoint}",role="{role}",status="{status}"}} {count}'
                )

            lines.extend([
                "# HELP orchestrator_tokens_total Total LLM tokens processed",
                "# TYPE orchestrator_tokens_total counter",
                f'orchestrator_tokens_total{{type="prompt"}} {self.tokens_total["prompt"]}',
                f'orchestrator_tokens_total{{type="completion"}} {self.tokens_total["completion"]}',
                "# HELP orchestrator_prompt_injection_flags_total Total flagged prompt injection attempts",
                "# TYPE orchestrator_prompt_injection_flags_total counter",
                f"orchestrator_prompt_injection_flags_total {self.injection_flags_total}",
                "# HELP orchestrator_rate_limited_total Total rate-limited requests",
                "# TYPE orchestrator_rate_limited_total counter",
                f"orchestrator_rate_limited_total {self.rate_limited_total}",
                "# HELP orchestrator_latency_ms_sum Total latency in milliseconds per endpoint",
                "# TYPE orchestrator_latency_ms_sum counter",
            ])
            for ep, total_ms in sorted(self.latency_sum_ms.items()):
                lines.append(f'orchestrator_latency_ms_sum{{endpoint="{ep}"}} {total_ms:.2f}')
            lines.extend([
                "# HELP orchestrator_latency_ms_count Total latency observations per endpoint",
                "# TYPE orchestrator_latency_ms_count counter",
            ])
            for ep, cnt in sorted(self.latency_count.items()):
                lines.append(f'orchestrator_latency_ms_count{{endpoint="{ep}"}} {cnt}')

        lines.extend([
            "# HELP cjk_guard_total CJK stray-character guard actions (retry with fallback model / strip)",
            "# TYPE cjk_guard_total counter",
        ])
        with self._lock:
            for (action, endpoint), count in sorted(self.cjk_guard_total.items()):
                lines.append(f'cjk_guard_total{{action="{action}",endpoint="{endpoint}"}} {count}')

        lines.extend([
            "# HELP agent_variant_total Agent requests per rollout variant and event",
            "# TYPE agent_variant_total counter",
        ])
        with self._lock:
            for (variant, event), count in sorted(self.variant_total.items()):
                lines.append(f'agent_variant_total{{variant="{variant}",event="{event}"}} {count}')
            lines.extend([
                "# HELP agent_variant_latency_ms_sum Agent latency per variant",
                "# TYPE agent_variant_latency_ms_sum counter",
            ])
            for v, total in sorted(self.variant_latency_sum_ms.items()):
                lines.append(f'agent_variant_latency_ms_sum{{variant="{v}"}} {total:.2f}')
            lines.extend([
                "# HELP agent_variant_latency_ms_count Agent latency observations per variant",
                "# TYPE agent_variant_latency_ms_count counter",
            ])
            for v, cnt in sorted(self.variant_latency_count.items()):
                lines.append(f'agent_variant_latency_ms_count{{variant="{v}"}} {cnt}')
            lines.extend([
                "# HELP agent_ui_action_total UI actions produced, by source (router=deterministic, llm=open_screen tool)",
                "# TYPE agent_ui_action_total counter",
            ])
            for via, cnt in sorted(self.ui_action_total.items()):
                lines.append(f'agent_ui_action_total{{via="{via}"}} {cnt}')

        lines.extend([
            "# HELP orchestrator_circuit_breaker_state Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)",
            "# TYPE orchestrator_circuit_breaker_state gauge",
            f'orchestrator_circuit_breaker_state{{service="vllm"}} {llm_circuit.state_numeric}',
            f'orchestrator_circuit_breaker_state{{service="stt"}} {stt_circuit.state_numeric}',
            f'orchestrator_circuit_breaker_state{{service="vllm_canary"}} {canary_circuit.state_numeric}',
            f'orchestrator_circuit_breaker_state{{service="tts"}} {tts_circuit.state_numeric}',
        ])
        return "\n".join(lines) + "\n"


metrics = MetricsRegistry()


def log_structured_event(
    *,
    endpoint: str,
    status_code: int,
    latency_ms: float,
    role: str,
    user_id: str,
    tenant_id: str,
    prompt_id: str = "",
    prompt_version: str = "",
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    injection_flagged: bool = False,
    outcome: str = "ok",
    variant: str = "",
) -> None:
    """
    يسجّل سطراً بصيغة JSON منظمة.
    الأمان: لا يُخزّن نص المحادثة ولا اسم المستخدم ولا معرّفه الصريح (يُشفّر بـ SHA256 قصير).
    """
    metrics.observe(
        endpoint=endpoint,
        role=role,
        status_code=status_code,
        latency_ms=latency_ms,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        injection_flagged=injection_flagged,
    )
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "manarasy-orchestrator",
        "endpoint": endpoint,
        "status_code": status_code,
        "outcome": outcome,
        "latency_ms": round(latency_ms, 2),
        "role": role,
        "user_hash": _hash_id(user_id),
        "tenant_hash": _hash_id(tenant_id),
        "prompt_id": prompt_id,
        "prompt_version": prompt_version,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "injection_flagged": injection_flagged,
        "circuit_vllm": llm_circuit.state,
    }
    if variant:
        record["variant"] = variant
    logger.info(json.dumps(record, ensure_ascii=False))

