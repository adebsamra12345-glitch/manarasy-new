import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from core_system.auth import get_tenant_db
from tenant_modules.halaqat.views import get_token_payload, get_teacher_name_from_token
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student
from .runtime import get_agent, norm, ROLE_PREFIX

logger = logging.getLogger(__name__)
MAX_TEXT = 300
AGENT_MAX_PER_MINUTE = 30
MIN_MARGIN = 0.15  # أقل هامش ثقة لتنفيذ الأمر؛ دون ذلك يُطلب توضيح


def _resolve_student(db_name, request, name):
    """يطابق الاسم المنطوق مع طلاب المسجد (ضمن نطاق صلاحية المعلم)، ويعيد حتى 5 مرشحين."""
    qs = Student.objects.using(db_name).select_related('halaqa')
    try:
        teacher = get_teacher_name_from_token(request, db_name)
    except ValueError:
        return []
    if teacher:
        qs = qs.filter(halaqa__teacher_name=teacher)
    first = norm(name).split()[0]
    out = []
    for sid, full, hal in qs.values_list('id', 'full_name', 'halaqa__name')[:5000]:
        n = norm(full)
        if first and (n.split() or [''])[0] == first and all(p in n for p in norm(name).split()):
            out.append({"id": str(sid), "name": full, "halaqa": hal})
            if len(out) == 5:
                break
    return out


def _resolve_halaqa(db_name, request, name):
    qs = Halaqa.objects.using(db_name).filter(deleted_at__isnull=True)
    try:
        teacher = get_teacher_name_from_token(request, db_name)
    except ValueError:
        return None
    if teacher:
        qs = qs.filter(teacher_name=teacher)
    target = norm(name)
    for hid, hname in qs.values_list('id', 'name'):
        if norm(hname) == target:
            return {"id": str(hid), "name": hname}
    return None


@csrf_exempt
def agent_command_view(request):
    """POST {text, channel?} -> {status, intent, slots, action, requires_confirmation, ...}"""
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    payload = get_token_payload(request)
    if not payload:
        return JsonResponse({"status": "error", "message": "التوكن مفقودة أو غير صالحة"}, status=401)
    role = payload.get('role')

    # تقييد المعدل لكل مستخدم: حماية من استنزاف المعالج بنموذج التصنيف
    from django.core.cache import cache
    rl_key = 'agent_rl:%s' % (payload.get('user_id') or payload.get('username'))
    cache.add(rl_key, 0, 60)
    try:
        hits = cache.incr(rl_key)
    except ValueError:
        cache.set(rl_key, 1, 60); hits = 1
    if hits > AGENT_MAX_PER_MINUTE:
        return JsonResponse({"status": "error", "message": "طلبات كثيرة، حاول بعد قليل"}, status=429)
    if role not in ROLE_PREFIX:
        return JsonResponse({"status": "error", "message": "دور غير مدعوم"}, status=403)
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        body = json.loads(request.body.decode('utf-8') or '{}')
    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "بيانات غير صالحة"}, status=400)
    text = (body.get('text') or '').strip()[:MAX_TEXT]
    if not text:
        return JsonResponse({"status": "error", "message": "النص فارغ"}, status=400)

    try:
        res = get_agent().predict(text, role)
    except Exception:
        logger.exception("agent predict failed")
        return JsonResponse({"status": "error", "message": "تعذّر تحليل الأمر"}, status=500)

    res["text"] = text
    if res["intent"] not in ("permission_denied", "out_of_scope", "clarify") and res.pop("confidence", 1) < MIN_MARGIN:
        res.update(intent="clarify", slots={}, requires_confirmation=False,
                   action={"type": "reply", "message": "لم أفهم الأمر جيداً، هل تعيد صياغته؟"})
    res.pop("confidence", None)

    # ربط الأسماء بمعرّفات حقيقية من قاعدة المسجد
    slots = res.get("slots", {})
    act = res.get("action", {})
    resolved = {}
    if res["intent"] not in ("permission_denied", "out_of_scope", "clarify"):
        if slots.get("student"):
            cands = _resolve_student(db_name, request, slots["student"])
            if not cands:
                res.update(intent="clarify", requires_confirmation=False,
                           action={"type": "reply", "message": f"لم أجد طالباً باسم «{slots['student']}»."})
            elif len(cands) > 1:
                route = act.get("route", "")
                if "{studentId}" in route:
                    for c in cands:
                        c["route"] = route.replace("{studentId}", c["id"])
                res.update(requires_confirmation=False, needs_choice=True, candidates=cands,
                           action={"type": "reply", "message": "وجدت أكثر من طالب، اختر واحداً."})
            else:
                resolved["studentId"] = cands[0]["id"]; resolved["studentName"] = cands[0]["name"]
        if slots.get("halaqa") and "needs_choice" not in res and res["intent"] != "clarify":
            h = _resolve_halaqa(db_name, request, slots["halaqa"])
            if h:
                resolved["ringId"] = h["id"]
    if "route" in act and res["intent"] not in ("clarify",) and "needs_choice" not in res:
        route = act["route"]
        for k in ("studentId", "ringId"):
            route = route.replace("{" + k + "}", resolved.get(k, "{" + k + "}"))
        if "{" in route:
            res.update(intent="clarify", action={"type": "reply", "message": "حدّد الطالب أو الحلقة بدقة."})
        else:
            act["route"] = route
    res["resolved"] = resolved
    res["status"] = "success"
    return JsonResponse(res, json_dumps_params={"ensure_ascii": False})
