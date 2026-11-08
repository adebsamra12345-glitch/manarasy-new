"""
واجهات برمجة التطبيقات (API Views) لميزات الذكاء الاصطناعي في منصة منارة:
- جميع المسارات محمية بـ @tenant_auth وتفرض صلاحيات الأدوار وعزل المستأجرين:
  * STUDENT: يمكنه رؤية توقعات مراجعته الخاصة فقط (لا يرى بيانات طالب آخر).
  * TEACHER: يرى طلاب حلقاته فقط.
  * CENTER_MANAGER: يرى طلاب وحلقات مركزه فقط.
  * TENANT_ADMIN: يرى نطاق المسجد.
- لا ترسل للنموذج أي معرّفات شخصية (PII).
- تعمل المنصة بشكل طبيعي مع رسالة بديلة لطيفة إذا كان جهاز الـ GPU مطفأً أو بطيئاً.
"""
import json

from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from core_system.auth import STAFF_ROLES, get_tenant_db, tenant_auth
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.reports_and_certificates.analytical_engines import (
    analyze_circle_performance,
    analyze_student_trend,
)
from tenant_modules.students_and_parents.models import Student

from .client import get_orchestrator_client


def _parse_json(request) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except ValueError:
        return {}


def _extract_caller_context(request) -> tuple[str, str, str, str]:
    profile = getattr(request, 'profile', None)
    tenant = getattr(request, 'tenant', None)
    user_id = str(profile.user_id) if (profile and getattr(profile, 'user_id', None)) else str(getattr(profile, 'id', 'anonymous'))
    roles = profile.get_roles() if profile else ['STUDENT']
    # اختيار أعلى دور صلاحية للمستخدم
    role_priority = ('TENANT_ADMIN', 'CENTER_MANAGER', 'TEACHER', 'STUDENT')
    primary_role = next((r for r in role_priority if r in roles), roles[0] if roles else 'STUDENT')
    tenant_id = str(tenant.id) if tenant else 'default'
    auth_header = request.headers.get('Authorization', '')
    return user_id, primary_role, tenant_id, auth_header


def _allowed_halaqa_ids_for_profile(db_name: str, profile, primary_role: str) -> list[str]:
    qs = Halaqa.objects.using(db_name).filter(is_active=True)
    if primary_role == 'TENANT_ADMIN':
        return [str(x) for x in qs.values_list('id', flat=True)]
    if primary_role == 'CENTER_MANAGER':
        if profile and profile.center_id:
            return [str(x) for x in qs.filter(center_id=profile.center_id).values_list('id', flat=True)]
        return []
    if primary_role == 'TEACHER':
        t_name = profile.user.username if (profile and profile.user) else ''
        if not t_name:
            return []
        return [
            str(x)
            for x in qs.filter(Q(teacher_name=t_name) | Q(teacher_name__iexact=t_name)).values_list('id', flat=True)
        ]
    return []


def _can_access_student(db_name: str, profile, primary_role: str, student: Student) -> bool:
    """يتحقق بصرامة أن المستخدم يملك صلاحية الوصول إلى هذا الطالب تحديداً."""
    if primary_role == 'TENANT_ADMIN':
        return True
    if primary_role == 'STUDENT':
        return bool(profile and student.user_id and str(student.user_id) == str(profile.user_id))
    allowed_halaqat = set(_allowed_halaqa_ids_for_profile(db_name, profile, primary_role))
    if student.halaqa_id and str(student.halaqa_id) in allowed_halaqat:
        return True
    return student.enrollments.using(db_name).filter(halaqa_id__in=allowed_halaqat, is_active=True).exists()


@csrf_exempt
@tenant_auth()
def ai_status_view(request):
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)
    client = get_orchestrator_client()
    data = client.health_status()
    return JsonResponse({'status': 'success', 'data': data}, status=200)


@csrf_exempt
@tenant_auth(STAFF_ROLES)
def ai_chat_view(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)
    body = _parse_json(request)
    message = (body.get('message') or '').strip()
    if not message:
        return JsonResponse({'status': 'error', 'message': 'الرسالة مطلوبة'}, status=400)

    user_id, role, tenant_id, _ = _extract_caller_context(request)
    client = get_orchestrator_client()
    res = client.chat(
        message=message,
        context=body.get('context') if isinstance(body.get('context'), dict) else {},
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
    )
    return JsonResponse({'status': 'success', 'data': res}, status=200)


@csrf_exempt
@tenant_auth(STAFF_ROLES)
def ai_agent_turn_view(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)
    body = _parse_json(request)
    utterance = (body.get('utterance') or '').strip()
    if not utterance:
        return JsonResponse({'status': 'error', 'message': 'النص المطلوب فارغ'}, status=400)

    db_name = get_tenant_db(request)
    user_id, role, tenant_id, auth_header = _extract_caller_context(request)
    halaqat_ids = _allowed_halaqa_ids_for_profile(db_name, request.profile, role)

    client = get_orchestrator_client()
    res = client.agent_turn(
        utterance=utterance,
        halaqat_ids=halaqat_ids,
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
        user_jwt=auth_header,
    )
    return JsonResponse({'status': 'success', 'data': res}, status=200)


@csrf_exempt
@tenant_auth(STAFF_ROLES)
def ai_agent_confirm_view(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)
    body = _parse_json(request)
    token = (body.get('token') or '').strip()
    utterance = (body.get('utterance') or '').strip()
    if not token or not utterance:
        return JsonResponse({'status': 'error', 'message': 'رمز التأكيد والرد مطلوبان'}, status=400)

    user_id, role, tenant_id, auth_header = _extract_caller_context(request)
    idem_key = request.headers.get('Idempotency-Key', '')
    client = get_orchestrator_client()
    res = client.confirm_agent_action(
        token=token,
        utterance=utterance,
        idempotency_key=idem_key,
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
        user_jwt=auth_header,
    )
    return JsonResponse({'status': 'success', 'data': res}, status=200)


@csrf_exempt
@tenant_auth(STAFF_ROLES)
def ai_evaluation_note_view(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)
    body = _parse_json(request)
    user_id, role, tenant_id, _ = _extract_caller_context(request)
    client = get_orchestrator_client()
    res = client.generate_evaluation_note(
        recitation_type=str(body.get('recitation_type') or 'حفظ جديد'),
        target_unit=str(body.get('target_unit') or f"صفحة {body.get('page_number', 1)}"),
        grade=str(body.get('grade') or 'ممتاز'),
        memorization_mistakes=int(body.get('memorization_mistakes') or 0),
        tajweed_mistakes=int(body.get('tajweed_mistakes') or 0),
        behavior_score=int(body.get('behavior_score') or 10),
        requires_repeat=bool(body.get('requires_repeat', False)),
        teacher_notes=str(body.get('notes') or ''),
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
    )
    return JsonResponse({'status': 'success', 'data': res}, status=200)


@csrf_exempt
@tenant_auth(STAFF_ROLES)
def ai_report_insight_view(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)
    body = _parse_json(request)
    db_name = get_tenant_db(request)
    user_id, role, tenant_id, _ = _extract_caller_context(request)
    allowed_h_ids = _allowed_halaqa_ids_for_profile(db_name, request.profile, role)
    halaqat_qs = Halaqa.objects.using(db_name).filter(id__in=allowed_h_ids, is_active=True)

    month_str = body.get('month')
    circle_stats = analyze_circle_performance(db_name, month_str=month_str, halaqat_qs=halaqat_qs)

    client = get_orchestrator_client()
    res = client.generate_report_insight(
        period=circle_stats.get('period', 'الشهر الحالي'),
        average_cpi=circle_stats.get('average_cpi', '0%'),
        attendance_rate=str(body.get('attendance_rate') or circle_stats.get('average_cpi', '0%')),
        total_pages=int(body.get('total_pages') or 0),
        total_halaqat=int(circle_stats.get('total_halaqat_analyzed') or 0),
        extra_context=str(body.get('extra_context') or ''),
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
    )
    return JsonResponse({'status': 'success', 'data': res}, status=200)


@csrf_exempt
@tenant_auth(STAFF_ROLES)
def ai_quiz_generate_view(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)
    body = _parse_json(request)
    topic = (body.get('topic') or '').strip()
    if not topic:
        return JsonResponse({'status': 'error', 'message': 'موضوع الاختبار مطلوب'}, status=400)

    user_id, role, tenant_id, _ = _extract_caller_context(request)
    client = get_orchestrator_client()
    res = client.generate_quiz(
        topic=topic,
        count=min(10, max(1, int(body.get('count') or 3))),
        difficulty=str(body.get('difficulty') or 'متوسط'),
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
    )
    return JsonResponse({'status': 'success', 'data': res}, status=200)


@csrf_exempt
@tenant_auth()
def ai_memorization_prediction_view(request, student_id):
    """
    نقطة النهاية المتوافقة مع aiService.js (getMemorizationPrediction):
    - تفرض فحص الصلاحيات حسب الدور بحيث لا يحصل مستخدم على بيانات طالب خارج نطاقه.
    - ترجع المؤشرات الرياضية دائماً وتُثريها بتوصية ذكية إن كان جهاز الذكاء الاصطناعي متاحاً.
    """
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db_name = get_tenant_db(request)
    user_id, role, tenant_id, _ = _extract_caller_context(request)

    student = Student.objects.using(db_name).filter(id=student_id).first()
    if not student:
        return JsonResponse({'status': 'error', 'message': 'الطالب غير موجود'}, status=404)

    if not _can_access_student(db_name, request.profile, role, student):
        return JsonResponse({'status': 'error', 'message': 'لا تملك صلاحية الاطلاع على بيانات هذا الطالب'}, status=403)

    trend = analyze_student_trend(db_name, str(student.id)) or {}
    # إزالة اسم الطالب ومعرّفه قبل إرسال المؤشرات الرقمية للنموذج (حماية الخصوصية)
    anonymous_metrics = {
        'overall_attendance_rate': trend.get('overall_attendance_rate', '0%'),
        'recent_14day_attendance_rate': trend.get('recent_14day_attendance_rate', '0%'),
        'attendance_trend': trend.get('attendance_trend', ''),
        'memorization_velocity_weekly': trend.get('memorization_velocity_weekly', ''),
        'reached_page': student.reached_page or 1,
        'risk_classification': trend.get('risk_classification', ''),
    }

    client = get_orchestrator_client()
    ai_res = client.chat(
        message='اقترح خطة مراجعة موجزة من نقطتين لهذا الطالب بناءً على مؤشراته الرقمية فقط.',
        context=anonymous_metrics,
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
    )

    return JsonResponse(
        {
            'status': 'success',
            'data': {
                **trend,
                'ai_available': ai_res.get('ai_available', False),
                'ai_recommendation': ai_res.get('answer') or trend.get('recommendation', ''),
            },
        },
        status=200,
    )


@csrf_exempt
@tenant_auth(STAFF_ROLES)
def ai_audio_eval_view(request):
    """
    نقطة النهاية المتوافقة مع aiService.js (analyzeAudioPronunciation / تفريغ الملاحظات الصوتية عبر STT).
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    user_id, role, tenant_id, _ = _extract_caller_context(request)
    audio_bytes = b''
    filename = 'audio.wav'

    if request.FILES.get('file'):
        f = request.FILES['file']
        audio_bytes = f.read()
        filename = f.name or filename
    elif request.FILES.get('audio'):
        f = request.FILES['audio']
        audio_bytes = f.read()
        filename = f.name or filename
    else:
        body = _parse_json(request)
        b64 = body.get('audio_base64') or ''
        if b64:
            import base64
            try:
                audio_bytes = base64.b64decode(b64)
            except Exception:
                audio_bytes = b''
        filename = body.get('filename') or filename

    if not audio_bytes:
        return JsonResponse({'status': 'error', 'message': 'الملف الصوتي مطلوب'}, status=400)

    client = get_orchestrator_client()
    res = client.transcribe_audio(
        audio_bytes=audio_bytes,
        filename=filename,
        user_id=user_id,
        role=role,
        tenant_id=tenant_id,
    )
    return JsonResponse({'status': 'success', 'data': res}, status=200)

