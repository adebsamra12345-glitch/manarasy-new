"""خدمة حفظ محادثات الوكيل (قاعدة المسجد) مع الإخفاء والاحتفاظ والتصدير الآمن للتدريب.

كل الدوال تأخذ db_name صراحةً وتستخدم .using(db_name) لعزل المساجد.
فشل الحفظ لا يجوز أن يكسر المحادثة: المستدعي يلتقط الاستثناءات.
"""
import json
import re
from datetime import timedelta

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import (
    DEFAULT_RETENTION_DAYS,
    AgentConversation,
    AgentFeedback,
    AgentMessage,
    AgentSettings,
)
from .sanitizer import redact_pii_string, sanitize_output_for_ui

MAX_TEXT = 2000
MAX_COMMENT = 500
_WS = re.compile(r'\s+')


def redact_for_storage(text: str, limit: int = MAX_TEXT) -> str:
    """إخفاء PII (بريد/هوية/هاتف) + إزالة وسوم HTML + تقصير. لا يُحفظ نص خام أبداً."""
    cleaned = redact_pii_string(sanitize_output_for_ui(text or ''))
    return _WS.sub(' ', cleaned).strip()[:limit]


def get_agent_settings(db_name: str) -> AgentSettings:
    obj, _ = AgentSettings.objects.using(db_name).get_or_create(
        pk=1, defaults={'retention_days': DEFAULT_RETENTION_DAYS}
    )
    return obj


def set_training_consent(db_name: str, value: bool, by_user_id: str) -> AgentSettings:
    obj = get_agent_settings(db_name)
    obj.training_consent = bool(value)
    obj.consent_updated_by = str(by_user_id)[:64]
    obj.consent_updated_at = timezone.now()
    obj.save(using=db_name)
    return obj


@transaction.atomic
def _locked_append(db_name, conv, rows):
    last = (
        AgentMessage.objects.using(db_name).filter(conversation=conv).order_by('-seq').values_list('seq', flat=True).first()
        or 0
    )
    out = []
    for i, row in enumerate(rows, start=1):
        out.append(AgentMessage.objects.using(db_name).create(conversation=conv, seq=last + i, **row))
    conv.save(using=db_name)  # يحدّث last_message_at
    return out


def record_turn(
    db_name: str,
    *,
    user_id: str,
    role: str,
    session_id: str,
    channel: str,
    user_text: str,
    assistant_text: str,
    outcome: str = '',
    tool_calls: list | None = None,
    ui_action_types: list | None = None,
    latency_ms: int | None = None,
) -> AgentMessage:
    """يحفظ دور المستخدم + رد المساعد ويرجع رسالة المساعد (لإرفاق التقييم بها)."""
    if not session_id:
        raise ValueError('session_id مطلوب')
    channel = channel if channel in ('text', 'voice') else 'text'
    cfg = get_agent_settings(db_name)
    conv, _ = AgentConversation.objects.using(db_name).get_or_create(
        user_id=str(user_id)[:64],
        session_id=session_id[:64],
        defaults={'role': str(role)[:32], 'channel': channel, 'training_consent': cfg.training_consent},
    )
    rows = [
        {'sender': 'user', 'text_redacted': redact_for_storage(user_text)},
        {
            'sender': 'assistant',
            'text_redacted': redact_for_storage(assistant_text),
            'outcome': (outcome or '')[:32],
            'tool_calls': [str(t)[:64] for t in (tool_calls or [])][:10],
            'ui_action_types': [str(t)[:32] for t in (ui_action_types or [])][:10],
            'latency_ms': latency_ms,
        },
    ]
    return _locked_append(db_name, conv, rows)[1]


def add_feedback(db_name: str, *, user_id: str, message_id, rating: int, comment: str = '') -> AgentFeedback:
    """تقييم رسالة مساعد يملك صاحبها المحادثة فقط. يرفع LookupError إن لم توجد/لا يملكها."""
    if rating not in (1, -1):
        raise ValueError('التقييم يجب أن يكون 1 أو -1')
    msg = (
        AgentMessage.objects.using(db_name)
        .select_related('conversation')
        .filter(id=message_id, sender='assistant', conversation__user_id=str(user_id))
        .first()
    )
    if msg is None:
        raise LookupError('الرسالة غير موجودة')
    fb, _ = AgentFeedback.objects.using(db_name).update_or_create(
        message=msg,
        user_id=str(user_id),
        defaults={'rating': rating, 'comment_redacted': redact_for_storage(comment, MAX_COMMENT)},
    )
    return fb


def delete_user_conversations(db_name: str, user_id: str) -> int:
    _, per_model = AgentConversation.objects.using(db_name).filter(user_id=str(user_id)).delete()
    return per_model.get(AgentConversation._meta.label, 0)


def purge_expired(db_name: str, now=None) -> int:
    """يحذف المحادثات التي مضى على آخر رسالة فيها أكثر من مدة الاحتفاظ (180 يوماً افتراضياً)."""
    cfg = get_agent_settings(db_name)
    cutoff = (now or timezone.now()) - timedelta(days=cfg.retention_days)
    _, per_model = AgentConversation.objects.using(db_name).filter(last_message_at__lt=cutoff).delete()
    return per_model.get(AgentConversation._meta.label, 0)


# ─── مراجعة بشرية (دورة التحسين) ─────────────────────────────────────────────
_TOOL_NAME_RE = re.compile(r'^[a-z][a-z0-9_]{0,63}$')


def list_review_queue(db_name: str, limit: int = 30) -> list[dict]:
    """أدوار تنتظر المراجعة من محادثات بدأت بعد موافقة المسجد فقط، الأسوأ أولاً (👎 ثم فشل/تحويل ثم الأحدث)."""
    qs = (
        AgentMessage.objects.using(db_name)
        .filter(sender='assistant', review_status='pending', conversation__training_consent=True)
        .select_related('conversation')
        .annotate(score=Sum('feedback__rating'))
        .order_by('-created_at')[:300]
    )
    rows = []
    for m in qs:
        user = (
            AgentMessage.objects.using(db_name).filter(conversation=m.conversation, seq=m.seq - 1, sender='user').first()
        )
        if not user:
            continue
        score = m.score or 0
        priority = 0 if score < 0 else (1 if m.outcome == 'degraded' else (2 if score == 0 else 3))
        rows.append({
            'id': str(m.id), 'user_text': user.text_redacted, 'assistant_text': m.text_redacted,
            'outcome': m.outcome, 'tool_calls': m.tool_calls, 'rating_score': score,
            'created_at': m.created_at.isoformat(), '_p': priority,
        })
    rows.sort(key=lambda r: r['_p'])
    for r in rows:
        r.pop('_p')
    return rows[:limit]


def review_message(db_name: str, *, message_id, reviewer_id: str, status: str,
                   expected_tool: str = '', expected_args: dict | None = None, expected_answer: str = '') -> AgentMessage:
    """يعتمد/يرفض دوراً مع تصحيح اختياري (الأداة/المعاملات/الرد المتوقع). كل نص يُعاد إخفاؤه."""
    if status not in ('approved', 'rejected'):
        raise ValueError('الحالة يجب أن تكون approved أو rejected')
    expected_tool = (expected_tool or '').strip()
    if expected_tool and not _TOOL_NAME_RE.match(expected_tool):
        raise ValueError('اسم الأداة غير صالح')
    args = expected_args if isinstance(expected_args, dict) else {}
    if len(json.dumps(args, ensure_ascii=False)) > 2000:
        raise ValueError('معاملات الأداة كبيرة جداً')
    msg = (
        AgentMessage.objects.using(db_name)
        .select_related('conversation')
        .filter(id=message_id, sender='assistant', conversation__training_consent=True)
        .first()
    )
    if msg is None:
        raise LookupError('الرسالة غير موجودة أو لا تخضع للمراجعة')
    msg.review_status = status
    msg.expected_tool = expected_tool
    msg.expected_args = json.loads(redact_for_storage(json.dumps(args, ensure_ascii=False), 2000)) if args else {}
    msg.expected_answer = redact_for_storage(expected_answer or '')
    msg.reviewed_by = str(reviewer_id)[:64]
    msg.save(using=db_name)
    return msg


# ─── ترميز الأسماء للتصدير ────────────────────────────────────────────────────
def pseudonymize(text: str, names: list[str], mapping: dict[str, str] | None = None) -> tuple[str, dict[str, str]]:
    """يستبدل أسماء الأشخاص (كاملة ثم مفردة ≥3 أحرف) برموز ثابتة داخل المحادثة {{PERSON_n}}.
    متحفظ عن قصد: قد يفرط في الإخفاء، والمراجعة البشرية تصحح قبل التدريب."""
    mapping = dict(mapping or {})
    tokens = set()
    for full in names:
        full = (full or '').strip()
        if not full:
            continue
        tokens.add(full)
        tokens.update(p for p in full.split() if len(p) >= 3)
    out = text
    for tok in sorted(tokens, key=len, reverse=True):  # الأطول أولاً
        if tok in out:
            ph = mapping.setdefault(tok, f'{{{{PERSON_{len(mapping) + 1}}}}}')
            out = out.replace(tok, ph)
    return out, mapping


def build_training_record(user_msg, asst_msg, names, tenant_idx):
    mapping: dict[str, str] = {}
    u, mapping = pseudonymize(user_msg.text_redacted, names, mapping)
    answer = asst_msg.expected_answer or asst_msg.text_redacted
    a, mapping = pseudonymize(redact_for_storage(answer), names, mapping)
    assistant = {'role': 'assistant', 'content': a}
    if asst_msg.expected_tool:
        args = json.loads(pseudonymize(json.dumps(asst_msg.expected_args, ensure_ascii=False), names, mapping)[0])
        assistant = {
            'role': 'assistant',
            'content': '',
            'tool_calls': [{'id': 'call_1', 'type': 'function',
                            'function': {'name': asst_msg.expected_tool, 'arguments': json.dumps(args, ensure_ascii=False)}}],
        }
    return {
        'id': f'flywheel-{tenant_idx}-{asst_msg.id}',
        'category': 'flywheel',
        'role': asst_msg.conversation.role,
        'messages': [{'role': 'user', 'content': u}, assistant],
    }
