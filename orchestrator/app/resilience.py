"""
الاعتمادية والمرونة (Resilience):
- Circuit Breaker (CLOSED -> OPEN -> HALF_OPEN) لمنع إغراق vLLM أو STT عند التعطل.
- Retries محدودة مع Exponential Backoff.
"""
import asyncio
import threading
import time
from typing import Callable, TypeVar

from .config import get_settings

T = TypeVar("T")


class CircuitBreakerOpenError(Exception):
    def __init__(self, service_name: str, retry_after: float):
        self.service_name = service_name
        self.retry_after = retry_after
        super().__init__(f"Circuit breaker OPEN for {service_name} (retry after {retry_after:.1f}s)")


class CircuitBreaker:
    def __init__(self, name: str):
        self.name = name
        self._lock = threading.Lock()
        self._failures = 0
        self._state = "CLOSED"  # CLOSED | OPEN | HALF_OPEN
        self._opened_at = 0.0

    @property
    def state(self) -> str:
        s = get_settings()
        with self._lock:
            if self._state == "OPEN":
                if (time.monotonic() - self._opened_at) >= s.cb_recovery_timeout_seconds:
                    self._state = "HALF_OPEN"
            return self._state

    @property
    def state_numeric(self) -> int:
        st = self.state
        return 0 if st == "CLOSED" else (1 if st == "HALF_OPEN" else 2)

    def reset(self) -> None:
        with self._lock:
            self._failures = 0
            self._state = "CLOSED"
            self._opened_at = 0.0

    def allow_request(self) -> None:
        s = get_settings()
        with self._lock:
            if self._state == "OPEN":
                elapsed = time.monotonic() - self._opened_at
                if elapsed >= s.cb_recovery_timeout_seconds:
                    self._state = "HALF_OPEN"
                else:
                    raise CircuitBreakerOpenError(self.name, s.cb_recovery_timeout_seconds - elapsed)

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._state = "CLOSED"
            self._opened_at = 0.0

    def record_failure(self) -> None:
        s = get_settings()
        with self._lock:
            self._failures += 1
            if self._state == "HALF_OPEN" or self._failures >= s.cb_failure_threshold:
                self._state = "OPEN"
                self._opened_at = time.monotonic()


llm_circuit = CircuitBreaker("vllm")
stt_circuit = CircuitBreaker("stt")
tts_circuit = CircuitBreaker("tts")
canary_circuit = CircuitBreaker("vllm_canary")  # منفصل: فشل المحوّل التجريبي لا يفتح قاطع المستقر


async def retry_with_backoff(
    coro_factory: Callable[[], T],
    circuit: CircuitBreaker,
    max_retries: int | None = None,
    base_backoff: float | None = None,
) -> T:
    s = get_settings()
    retries = s.llm_max_retries if max_retries is None else max_retries
    backoff = s.llm_retry_backoff_seconds if base_backoff is None else base_backoff

    circuit.allow_request()
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            result = await coro_factory()
            circuit.record_success()
            return result
        except Exception as exc:
            last_exc = exc
            if attempt < retries:
                await asyncio.sleep(backoff * (2 ** attempt))
            else:
                circuit.record_failure()
    assert last_exc is not None
    raise last_exc

