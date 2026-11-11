"""طبقتان خلف واجهة واحدة: Mock للاختبار، وDjango الحقيقي (يمرّر توكن المستخدم نفسه)."""
import copy
import os

import httpx

_SEED = {
    "t1": {
        "halaqat": {"h1": {"name": "حلقة الفاتحة"}, "h2": {"name": "حلقة البقرة"}},
        "students": {
            "s1": {"full_name": "أحمد محمد", "halaqa_id": "h1", "points": 40},
            "s2": {"full_name": "أحمد علي", "halaqa_id": "h1", "points": 25},
            "s3": {"full_name": "خالد يوسف", "halaqa_id": "h1", "points": 10},
            "s4": {"full_name": "عمر سالم", "halaqa_id": "h2", "points": 55},
        },
        "attendance": [], "evals": [], "pending_requests": [{"id": "r1", "name": "طالب جديد"}],
    }
}


class BackendError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message


class MockBackend:
    def __init__(self):
        self.reset()

    def reset(self):
        self.db = copy.deepcopy(_SEED)

    def _t(self, p):
        return self.db[p.tenant_id]

    def students(self, p):
        return [{"id": i, **s} for i, s in self._t(p)["students"].items()
                if p.role == "manager" or s["halaqa_id"] in p.halaqat_ids]

    def halaqat(self, p):
        return [{"id": i, **h} for i, h in self._t(p)["halaqat"].items()
                if p.role == "manager" or i in p.halaqat_ids]

    def mark_attendance(self, p, student, status):
        rec = {"student": student["id"], "status": status}
        self._t(p)["attendance"].append(rec)
        return rec

    def record_eval(self, p, student, fields):
        rec = {"student": student["id"], **fields}
        self._t(p)["evals"].append(rec)
        return rec

    def bonus(self, p, student, reason):
        s = self._t(p)["students"][student["id"]]
        s["points"] += 1
        return {"points": s["points"]}

    def pending(self, p):
        return self._t(p)["pending_requests"]

    def approve(self, p, request_id):
        reqs = self._t(p)["pending_requests"]
        hit = next((r for r in reqs if r["id"] == request_id), None)
        if not hit:
            raise BackendError(404, "not found")
        reqs.remove(hit)
        return {"approved": hit["name"]}

    def overview(self, p):
        st = self._t(p)["students"].values()
        return [{"halaqa": h["name"], "students": sum(1 for s in st if s["halaqa_id"] == i)}
                for i, h in self._t(p)["halaqat"].items()]


class DjangoBackend:
    """كل الصلاحيات والنطاق (معلم/مدير/مسجد) تفرضها Django من توكن المستخدم نفسه."""
    STATUS = {"present": "PRESENT", "absent": "ABSENT", "late": "LATE", "excused": "EXCUSED"}

    def __init__(self):
        self.base = os.getenv("DJANGO_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
        self.http = httpx.Client(timeout=10)

    def _req(self, p, method, path, **kw):
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

    def me(self, headers):
        class _P: forward_headers = headers
        return self._req(_P, "GET", "/api/users/me/").get("data", {})

    def students(self, p):
        return self._req(p, "GET", "/api/students-and-parents/students/").get("data", [])

    def halaqat(self, p):
        return self._req(p, "GET", "/api/halaqat/").get("data", [])

    def mark_attendance(self, p, student, status):
        if not student.get("halaqa_id"):
            raise BackendError(400, "الطالب غير مسجّل في حلقة")
        body = {"student_id": student["id"], "halaqa_id": student["halaqa_id"],
                "status": self.STATUS[status], "is_late": status == "late"}
        return self._req(p, "POST", "/api/attendance/", json=body).get("data", {})

    def record_eval(self, p, student, fields):
        body = {"student_id": student["id"], **{k: v for k, v in fields.items() if v is not None}}
        return self._req(p, "POST", "/api/recitation/evaluate/", json=body).get("data", {})

    def bonus(self, p, student, reason):
        return self._req(p, "POST", "/api/points-and-rewards/points/bonus/",
                         json={"student_id": student["id"], "reason": reason}).get("data", {})

    def pending(self, p):
        return self._req(p, "GET", "/api/students-and-parents/students/registration-requests/").get("data", [])

    def approve(self, p, request_id):
        return self._req(p, "POST", f"/api/students-and-parents/students/registration-requests/{request_id}/approve/").get("data", {})

    def overview(self, p):
        return [{"halaqa": h.get("name"), "students": h.get("students_count")} for h in self.halaqat(p)]


_backend = None


def get_backend():
    global _backend
    if _backend is None:
        _backend = DjangoBackend() if os.getenv("AGENT_BACKEND", "mock") == "django" else MockBackend()
    return _backend
