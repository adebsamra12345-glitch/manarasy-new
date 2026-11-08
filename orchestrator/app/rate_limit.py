"""Rate Limiting لكل مستخدم/دور بنافذة منزلقة (Sliding Window)."""
import threading
import time
from collections import deque

from fastapi import HTTPException

from .config import get_settings
from .security import ServiceCaller


class SlidingWindowRateLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = {}

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def limit_for_role(self, role: str) -> int:
        s = get_settings()
        r = (role or "").upper()
        if r in ("PLATFORM_ADMIN", "TENANT_ADMIN", "ADMIN"):
            return s.rate_limit_admin_per_min
        if r in ("CENTER_MANAGER", "MANAGER"):
            return s.rate_limit_manager_per_min
        if r in ("TEACHER",):
            return s.rate_limit_teacher_per_min
        return s.rate_limit_student_per_min

    def check(self, caller: ServiceCaller) -> dict[str, int]:
        s = get_settings()
        window = float(s.rate_limit_window_seconds)
        max_reqs = self.limit_for_role(caller.role)
        key = f"{caller.tenant_id}:{caller.role}:{caller.user_id}"
        now = time.monotonic()

        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and (now - q[0]) >= window:
                q.popleft()
            if len(q) >= max_reqs:
                retry_after = max(1, int(window - (now - q[0])))
                raise HTTPException(
                    status_code=429,
                    detail="تم تجاوز الحد المسموح من الطلبات لدورك، يرجى الانتظار قليلاً.",
                    headers={"Retry-After": str(retry_after)},
                )
            q.append(now)
            remaining = max(0, max_reqs - len(q))
            return {"limit": max_reqs, "remaining": remaining}


rate_limiter = SlidingWindowRateLimiter()

