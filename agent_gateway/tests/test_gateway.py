import pytest
from fastapi.testclient import TestClient

from app.backend import get_backend
from app.arabic import normalize, parse_confirmation
from app.auth import make_token
from app.main import _pending, app

c = TestClient(app)


def hdr(role="teacher", halaqat=("h1",), sub="u_teacher1"):
    return {"Authorization": "Bearer " + make_token(
        sub=sub, role=role, tenant_id="t1", halaqat_ids=list(halaqat))}


@pytest.fixture(autouse=True)
def _reset():
    get_backend().reset()
    _pending.clear()


def test_no_token_rejected():
    assert c.get("/v1/tools").status_code == 401


def test_student_role_rejected():
    h = {"Authorization": "Bearer " + make_token(sub="x", role="student", tenant_id="t1")}
    assert c.get("/v1/tools", headers=h).status_code == 403


def test_tools_filtered_by_role():
    names = lambda r: {t["function"]["name"] for t in c.get("/v1/tools", headers=r).json()}
    assert "approve_registration" not in names(hdr())
    assert "approve_registration" in names(hdr("manager", ()))


def test_teacher_cannot_call_manager_tool():
    assert c.post("/v1/tools/approve_registration", json={"request_id": "r1"}, headers=hdr()).status_code == 404


def test_write_requires_confirmation_and_executes_after_yes():
    r = c.post("/v1/tools/mark_attendance", json={"student_query": "خالد", "status": "absent"}, headers=hdr()).json()
    assert r["status"] == "confirm_required" and "خالد يوسف" in r["speak"]
    assert get_backend().db["t1"]["attendance"] == []          # لم يُنفَّذ بعد
    r2 = c.post("/v1/confirm", json={"token": r["confirm_token"], "utterance": "نعم أكد"}, headers=hdr()).json()
    assert r2["status"] == "ok" and len(get_backend().db["t1"]["attendance"]) == 1


@pytest.mark.parametrize("said", ["لا", "لا الغي", "لأ", "الغاء"])
def test_negative_cancels(said):
    r = c.post("/v1/tools/mark_attendance", json={"student_query": "خالد", "status": "late"}, headers=hdr()).json()
    out = c.post("/v1/confirm", json={"token": r["confirm_token"], "utterance": said}, headers=hdr()).json()
    assert out["status"] == "cancelled" and get_backend().db["t1"]["attendance"] == []


def test_unclear_confirmation_does_not_execute():
    r = c.post("/v1/tools/mark_attendance", json={"student_query": "خالد", "status": "late"}, headers=hdr()).json()
    out = c.post("/v1/confirm", json={"token": r["confirm_token"], "utterance": "ممم شو"}, headers=hdr()).json()
    assert out["status"] == "confirm_required" and get_backend().db["t1"]["attendance"] == []


def test_confirm_token_bound_to_user():
    r = c.post("/v1/tools/mark_attendance", json={"student_query": "خالد", "status": "late"}, headers=hdr()).json()
    other = hdr("teacher", ("h1",), sub="u_other")
    assert c.post("/v1/confirm", json={"token": r["confirm_token"], "utterance": "نعم"}, headers=other).status_code == 404


def test_ambiguous_name_asks_back():
    r = c.post("/v1/tools/mark_attendance", json={"student_query": "أحمد", "status": "absent"}, headers=hdr()).json()
    assert r["status"] == "needs_clarification" and len(r["options"]) == 2


def test_teacher_scope_limited_to_own_halaqa():
    r = c.post("/v1/tools/student_summary", json={"student_query": "عمر سالم"}, headers=hdr()).json()
    assert r["status"] == "needs_clarification"          # عمر في h2
    assert c.post("/v1/tools/student_summary", json={"student_query": "عمر سالم"},
                  headers=hdr("manager", ())).json()["status"] == "ok"


def test_missing_param_asks_back():
    r = c.post("/v1/tools/mark_attendance", json={"student_query": "خالد"}, headers=hdr()).json()
    assert r["status"] == "needs_clarification"


def test_eval_confirm_then_recorded():
    r = c.post("/v1/tools/record_recitation_eval",
               json={"student_query": "خالد", "grade": "ممتاز", "page_number": 5}, headers=hdr()).json()
    assert r["status"] == "confirm_required" and "ممتاز" in r["speak"] and "5" in r["speak"]
    assert get_backend().db["t1"]["evals"] == []
    c.post("/v1/confirm", json={"token": r["confirm_token"], "utterance": "تمام"}, headers=hdr())
    assert get_backend().db["t1"]["evals"][0]["grade"] == "ممتاز"


def test_idempotent_confirm():
    r = c.post("/v1/tools/points_bonus", json={"student_query": "خالد", "reason": "حفظ ممتاز"}, headers=hdr()).json()
    body = {"token": r["confirm_token"], "utterance": "نعم"}
    h = {**hdr(), "Idempotency-Key": "k1"}
    c.post("/v1/confirm", json=body, headers=h); c.post("/v1/confirm", json=body, headers=h)
    assert get_backend().db["t1"]["students"]["s3"]["points"] == 11


def test_dialect_normalization_and_confirmation():
    assert normalize("بدي هلأ غايب") == "اريد الان غائب"
    assert normalize("الحين شلون") == "الان كيف"
    assert parse_confirmation("إيوه") == "yes" and parse_confirmation("ايوا تمام") == "yes"
    assert parse_confirmation("لا تسجل") == "no"


def test_django_backend_forwards_user_token_and_maps_status():
    import httpx
    from app.auth import Principal
    from app.backend import DjangoBackend, BackendError
    seen = []

    def handler(req: httpx.Request):
        seen.append((req.method, req.url.path, req.headers.get("authorization"), req.headers.get("tenant-id"),
                     req.content.decode() if req.content else ""))
        if req.url.path.endswith("/attendance/"):
            return httpx.Response(201, json={"status": "success", "data": {"id": "a1"}})
        return httpx.Response(403, json={"status": "error", "message": "لا تملك صلاحية"})

    b = DjangoBackend(); b.http = httpx.Client(transport=httpx.MockTransport(handler))
    p = Principal("u", "teacher", "t", [], {"Authorization": "Bearer X", "Tenant-ID": "T"})
    b.mark_attendance(p, {"id": "s1", "halaqa_id": "h1"}, "late")
    m, path, auth, tid, body = seen[0]
    assert path == "/api/attendance/" and auth == "Bearer X" and tid == "T"
    assert '"status": "LATE"' in body or '"status":"LATE"' in body
    with pytest.raises(BackendError) as ei:
        b.bonus(p, {"id": "s1"}, "x")
    assert ei.value.status == 403
