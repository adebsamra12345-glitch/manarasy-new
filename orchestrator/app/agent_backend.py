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
        "attendance": [
            {"student": "s1", "halaqa_id": "h1", "status": "present", "date": "2026-11-15"},
            {"student": "s1", "halaqa_id": "h1", "status": "present", "date": "2026-11-14"},
            {"student": "s1", "halaqa_id": "h1", "status": "absent", "date": "2026-11-13"},
            {"student": "s4", "halaqa_id": "h2", "status": "present", "date": "2026-11-15"},
        ],
        "evals": [
            {"student": "s1", "grade": "ممتاز", "page_number": 15, "date": "2026-11-15", "surah_number": 2},
            {"student": "s1", "grade": "جيد جداً", "page_number": 14, "date": "2026-11-14", "surah_number": 2},
            {"student": "s4", "grade": "ممتاز", "page_number": 30, "date": "2026-11-15", "surah_number": 2},
        ],
        "points_transactions": [
            {"student": "s1", "points": 1, "reason": "حفظ متقن ومواظبة", "date": "2026-11-15"},
            {"student": "s1", "points": 1, "reason": "مساعدة الزملاء", "date": "2026-11-12"},
            {"student": "s4", "points": 1, "reason": "تفوق في التسميع", "date": "2026-11-15"},
        ],
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

    def list_students(self, p: Principal, halaqa_id: str):
        if p.role != "manager" and p.halaqat_ids and str(halaqa_id) not in [str(x) for x in p.halaqat_ids]:
            raise BackendError(403, "غير مصرّح لك بالوصول لطلاب هذه الحلقة")
        h_name = self._t(p)["halaqat"].get(halaqa_id, {}).get("name", "")
        return [
            {"id": i, "full_name": s["full_name"], "halaqa_name": h_name, "rating": s.get("rating", 5.0)}
            for i, s in self._t(p)["students"].items()
            if str(s["halaqa_id"]) == str(halaqa_id)
        ][:20]

    def attendance_report(self, p: Principal, student_id: str | None = None, halaqa_id: str | None = None, period: str = "week"):
        t = self._t(p)
        if student_id:
            s = t["students"].get(student_id)
            if not s:
                raise BackendError(404, "الطالب غير موجود")
            if p.role != "manager" and p.halaqat_ids and str(s["halaqa_id"]) not in [str(x) for x in p.halaqat_ids]:
                raise BackendError(403, "غير مصرّح لك بالوصول لبيانات هذا الطالب")
            recs = [r for r in t.get("attendance", []) if r.get("student") == student_id]
            pres = sum(1 for r in recs if r.get("status") == "present")
            abs_cnt = sum(1 for r in recs if r.get("status") == "absent")
            late_cnt = sum(1 for r in recs if r.get("status") == "late")
            rate = f"{int((pres / max(1, pres + abs_cnt + late_cnt)) * 100)}%" if recs else "100%"
            return {
                "student_name": s["full_name"],
                "period": period,
                "present_days": pres,
                "absent_days": abs_cnt,
                "late_days": late_cnt,
                "attendance_rate": rate,
            }
        if halaqa_id:
            if p.role != "manager" and p.halaqat_ids and str(halaqa_id) not in [str(x) for x in p.halaqat_ids]:
                raise BackendError(403, "غير مصرّح لك بالوصول لبيانات هذه الحلقة")
            h = t["halaqat"].get(halaqa_id, {})
            return {
                "halaqa_name": h.get("name", ""),
                "period": period,
                "total_sessions": 5,
                "average_attendance_rate": "90%",
            }
        raise BackendError(400, "يجب تحديد الطالب أو الحلقة")

    def recitation_history(self, p: Principal, student_id: str, limit: int = 5):
        t = self._t(p)
        s = t["students"].get(student_id)
        if not s:
            raise BackendError(404, "الطالب غير موجود")
        if p.role != "manager" and p.halaqat_ids and str(s["halaqa_id"]) not in [str(x) for x in p.halaqat_ids]:
            raise BackendError(403, "غير مصرّح لك بالوصول لبيانات هذا الطالب")
        evals = [
            {"grade": e.get("grade"), "page_number": e.get("page_number"), "date": e.get("date", "2026-11-15")}
            for e in t.get("evals", [])
            if e.get("student") == student_id
        ]
        return evals[:min(max(1, limit), 20)]

    def points_history(self, p: Principal, student_id: str):
        t = self._t(p)
        s = t["students"].get(student_id)
        if not s:
            raise BackendError(404, "الطالب غير موجود")
        if p.role != "manager" and p.halaqat_ids and str(s["halaqa_id"]) not in [str(x) for x in p.halaqat_ids]:
            raise BackendError(403, "غير مصرّح لك بالوصول لبيانات هذا الطالب")
        txs = [
            {"points": pt.get("points", 1), "reason": pt.get("reason", ""), "date": pt.get("date", "2026-11-15")}
            for pt in t.get("points_transactions", [])
            if pt.get("student") == student_id
        ]
        return {
            "student_name": s["full_name"],
            "total_points": s.get("points", 0),
            "recent_transactions": txs[:20],
        }


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

    def list_students(self, p: Principal, halaqa_id: str):
        data = self._req(p, "GET", f"/api/students-and-parents/students/?halaqa_id={halaqa_id}").get("data", [])
        return [
            {"id": str(s.get("id")), "full_name": s.get("full_name") or s.get("user", {}).get("username"), "rating": s.get("rating", 5.0)}
            for s in data[:20]
        ]

    def attendance_report(self, p: Principal, student_id: str | None = None, halaqa_id: str | None = None, period: str = "week"):
        query = f"student_id={student_id}" if student_id else f"halaqa_id={halaqa_id}"
        return self._req(p, "GET", f"/api/attendance/?{query}&period={period}").get("data", {})

    def recitation_history(self, p: Principal, student_id: str, limit: int = 5):
        data = self._req(p, "GET", f"/api/recitation/?student_id={student_id}&limit={limit}").get("data", [])
        return data[:20]

    def points_history(self, p: Principal, student_id: str):
        return self._req(p, "GET", f"/api/points-and-rewards/points/students/?student_id={student_id}").get("data", {})


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

