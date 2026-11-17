"""مخزن حالة قصيرة العمر (جلسات المحادثة، الحوار المعلّق، التأكيدات، مفاتيح idempotency).

- الافتراضي: ذاكرة العملية (للتطوير والاختبار) مع تنظيف الصلاحية.
- REDIS_URL مضبوط: Redis ليبقى الحال عند إعادة التشغيل وبين عدة workers.
- إن تعطّل Redis أثناء التشغيل يسقط تلقائياً إلى الذاكرة مع تسجيل تحذير (الخدمة لا تتعطل).
الأمان: لا تُخزَّن هنا رموز JWT للمستخدمين ولا PII؛ القيم JSON بصلاحية TTL إلزامية.
"""
import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger("manarasy.orchestrator.state")

_PREFIX = "mnr:agent:"


class MemoryStore:
    def __init__(self):
        self._d: dict[str, tuple[float, str]] = {}

    def _purge(self) -> None:
        now = time.time()
        for k in [k for k, (exp, _) in self._d.items() if exp < now]:
            self._d.pop(k, None)

    def get(self, key: str) -> str | None:
        self._purge()
        hit = self._d.get(key)
        return hit[1] if hit else None

    def set(self, key: str, value: str, ttl: int) -> None:
        self._purge()
        self._d[key] = (time.time() + ttl, value)

    def delete(self, key: str) -> None:
        self._d.pop(key, None)

    def clear(self) -> None:
        self._d.clear()


class RedisStore:
    def __init__(self, client):
        self.client = client

    def get(self, key: str) -> str | None:
        v = self.client.get(key)
        return v.decode("utf-8") if isinstance(v, bytes) else v

    def set(self, key: str, value: str, ttl: int) -> None:
        self.client.set(key, value, ex=ttl)

    def delete(self, key: str) -> None:
        self.client.delete(key)

    def clear(self) -> None:
        for k in self.client.scan_iter(match=f"{_PREFIX}*"):
            self.client.delete(k)


class StateStore:
    """واجهة JSON فوق مخزن أساسي مع سقوط آمن إلى الذاكرة."""

    def __init__(self, primary=None):
        self._memory = MemoryStore()
        self._primary = primary or self._memory

    def _call(self, op: str, *args):
        try:
            return getattr(self._primary, op)(*args)
        except Exception:
            if self._primary is self._memory:
                raise
            logger.warning("state store backend failed on %s; falling back to memory", op)
            return getattr(self._memory, op)(*args)

    def get(self, key: str) -> Any | None:
        raw = self._call("get", _PREFIX + key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            return None

    def set(self, key: str, value: Any, ttl: int) -> None:
        self._call("set", _PREFIX + key, json.dumps(value, ensure_ascii=False), int(ttl))

    def delete(self, key: str) -> None:
        self._call("delete", _PREFIX + key)

    def clear(self) -> None:
        self._call("clear")
        if self._primary is not self._memory:
            self._memory.clear()


def _build_default() -> StateStore:
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        return StateStore()
    try:
        import redis  # type: ignore

        client = redis.Redis.from_url(url, socket_timeout=1.0, socket_connect_timeout=1.0)
        return StateStore(RedisStore(client))
    except Exception:
        logger.warning("REDIS_URL set but redis client unavailable; using in-memory state")
        return StateStore()


store = _build_default()
