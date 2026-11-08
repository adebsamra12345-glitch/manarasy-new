"""طبقتان خلف واجهة واحدة للأدوات: Mock للاختبار، وDjango الحقيقي (يمرّر توكن المستخدم نفسه)."""
import copy
import os
from dataclasses import dataclass, field

import httpx

_SEED = {
    "t1": {
        "halaqat": {"h1": {"name": "حلقة الفاتحة"}, "h2": {"name": "حلقة البقرة"}},
        "students": {
            "s1": {"full_name": "أحمد محمد", "halaqa_id": "h1", "points": 40, "reached_page": 15, "rating": 4.8},
            "s2": {"full_name": "أحمد علي", "halaqa_id": "h1", "points": 25, "reached_page": 10, "rating": 4.2},
            "s3": {"full_name": "خالد يوسف", "halaqa_id": "h1", "points": 10, "reached_page": 5, "rating": 3.9},
            "s4": {"full_name": "عمر سالم", "halaqa_id": "h2", "points": 55, "reached_page": 30, "rating": 4.9},
        },
        "attendance": [],
        "evals": [],
        "pending_requests": [{"id": "r1", "name": "طالب جديد"}],
    }
}


@dataclass
class Principal:
    user_id: str
    role: str
    tenant_id: str
    halaqat_ids: list = field(default_factory=list)
    forward_headers: dict = field(default_factory=dict)


class BackendError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message


class MockBackend:
    def __init__(self):
        self.reset()

    def reset(self):
        self.db = copy.deepcopy(_SEED)

    def _t(self, p: Principal):
        return self.db.setdefault(
            p.tenant_id or "t1",
            copy.deepcopy(_SEED["t1"]),
        )

    def students(self, p: Principal):
        return [
            {"id": i, **s}
            for i, s in self._t(p)["students"].items()
            if p.role == "manager" or not p.halaqat_ids or s["halaqa_id"] in p.halaqat_ids
        ]

    def halaqat(self, p: Principal):
        return [
            {"id": i, **h}
            for i, h in self._t(p)["halaqat"].items()
            if p.role == "manager" or not p.halaqat_ids or i in p.halaqat_ids
        ]

    def mark_attendance(self, p: Principal, student: dict, status: str):
        rec = {"student": student["id"], "status": status}
        self._t(p)["attendance"].append(rec)
        return rec

    def record_eval(self, p: Principal, student: dict, fields: dict):
        rec = {"student": student["id"], **fields}
        self._t(p)["evals"].append(rec)
        return rec

    def bonus(self, p: Principal, student: dict, reason: str):
        s = self._t(p)["students"][student["id"]]
        s["points"] += 1
        return {"points": s["points"]}

    def pending(self, p: Principal):
        return self._t(p)["pending_requests"]

    def approve(self, p: Principal, request_id: str):
        reqs = self._t(p)["pending_requests"]
        hit = next((r for r in reqs if r["id"] == request_id), None)
        if not hit:
            raise BackendError(404, "not found")
        reqs.remove(hit)
        return {"approved": hit["name"]}

    def overview(self, p: Principal):
        st = self._t(p)["students"].values()
        return [
            {"halaqa": h["name"], "students": sum(1 for s in st if s["halaqa_id"] == i)}
            for i, h in self._t(p)["halaqat"].items()
        ]


class DjangoBackend:
    """كل الصلاحيات والنطاق (معلم/مدير/مسجد) تفرضها Django من توكن المستخدم نفسه."""
    STATUS = {"present": "PRESENT", "absent": "ABSENT", "late": "LATE", "excused": "EXCUSED"}

    def __init__(self):
        self.base = os.getenv("DJANGO_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
        self.http = httpx.Client(timeout=10)

    def _req(self, p: Principal, method: str, path: str, **kw):
        try:
            r = self.http.request(method, f"{self.base}{path}", headers=p.forward_headers, **kw)
        except httpx.HTTPError:
            raise BackendError(502, "تعذّر الاتصال بالمنصة")
        try:
            body = r.json()
        except ValueError:
            body = {}
        if r.status_code >= 400:
            raise BackendError(r.status_code, body.get("message", "فشل الطلب"))
        return body

    def students(self, p: Principal):
        return self._req(p, "GET", "/api/students-and-parents/students/").get("data", [])

    def halaqat(self, p: Principal):
        return self._req(p, "GET", "/api/halaqat/").get("data", [])

    def mark_attendance(self, p: Principal, student: dict, status: str):
        if not student.get("halaqa_id"):
            raise BackendError(400, "الطالب غير مسجّل في حلقة")
        body = {
            "student_id": student["id"],
            "halaqa_id": student["halaqa_id"],
            "status": self.STATUS[status],
            "is_late": status == "late",
        }
        return self._req(p, "POST", "/api/attendance/", json=body).get("data", {})

    def record_eval(self, p: Principal, student: dict, fields: dict):
        body = {"student_id": student["id"], **{k: v for k, v in fields.items() if v is not None}}
        return self._req(p, "POST", "/api/recitation/evaluate/", json=body).get("data", {})

    def bonus(self, p: Principal, student: dict, reason: str):
        return self._req(
            p,
            "POST",
            "/api/points-and-rewards/points/bonus/",
            json={"student_id": student["id"], "reason": reason},
        ).get("data", {})

    def pending(self, p: Principal):
        return self._req(p, "GET", "/api/students-and-parents/students/registration-requests/").get("data", [])

    def approve(self, p: Principal, request_id: str):
        return self._req(
            p, "POST", f"/api/students-and-parents/students/registration-requests/{request_id}/approve/"
        ).get("data", {})

    def overview(self, p: Principal):
        return [{"halaqa": h.get("name"), "students": h.get("students_count")} for h in self.halaqat(p)]


_backend = None


def get_backend():
    global _backend
    if _backend is None:
        _backend = DjangoBackend() if os.getenv("AGENT_BACKEND", "mock") == "django" else MockBackend()
    return _backend


def reset_mock_backend():
    global _backend
    _backend = MockBackend()
    return _backend

