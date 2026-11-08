"""
العميل الموحّد للـ Orchestrator داخل تطبيق منارة (OrchestratorClient):
- النقطة الوحيدة التي يتصل بها Django بطبقة الذكاء الاصطناعي (لا يتصل بـ vLLM مباشرة).
- يتحقق من أعلام الميزات (Feature Flags) لكل ميزة ذكاء اصطناعي.
- يضمن استمرار عمل المنصة بشكل طبيعي مع رسائل بديلة لطيفة إذا كان جهاز الذكاء الاصطناعي مطفأً أو بطيئاً.
"""
import base64
import json
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings

from .sanitizer import minimize_payload, sanitize_output_for_ui

FALLBACK_MESSAGES = {
    'chat': 'المساعد الذكي غير متاح حالياً، يمكنك متابعة عملك في المنصة بشكل طبيعي.',
    'agent': 'المساعد الصوتي/النصي غير متاح حالياً، يمكنك تنفيذ الإجراء مباشرة من الشاشة.',
    'evaluation_note': 'تم حفظ التقييم بنجاح. (صياغة الملاحظة الذكية غير متاحة حالياً).',
    'report_insight': 'تم حساب جميع المؤشرات الرقمية بنجاح. (الملخص التحليلي الذكي غير متاح حالياً).',
    'quiz': 'توليد الأسئلة الذكي غير متاح حالياً، يمكنك إضافة الأسئلة يدوياً.',
    'stt': 'خدمة تحويل الصوت إلى نص غير متاحة حالياً، يمكنك كتابة الملاحظة نصياً.',
}


class OrchestratorClient:
    def __init__(self):
        self.base_url = getattr(settings, 'ORCHESTRATOR_BASE_URL', '').rstrip('/')
        self.service_key = getattr(settings, 'ORCHESTRATOR_SERVICE_KEY', '')
        self.timeout = float(getattr(settings, 'ORCHESTRATOR_TIMEOUT_SECONDS', 8.0))

    def is_feature_enabled(self, feature_name: str) -> bool:
        flags = getattr(settings, 'AI_FEATURE_FLAGS', {})
        if not flags.get('MASTER_ENABLED', True):
            return False
        return bool(flags.get(feature_name, False))

    def _headers(
        self,
        *,
        user_id: str,
        role: str,
        tenant_id: str,
        user_jwt: str = '',
        halaqat_ids: list[str] | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> dict[str, str]:
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {self.service_key}',
            'X-User-Id': str(user_id or 'anonymous'),
            'X-User-Role': str(role or 'STUDENT'),
            'X-Tenant-Id': str(tenant_id or 'default'),
        }
        if user_jwt:
            headers['X-User-Jwt'] = user_jwt
        if halaqat_ids:
            headers['X-Halaqat-Ids'] = ','.join(str(x) for x in halaqat_ids)
        if extra_headers:
            headers.update(extra_headers)
        return headers

    def _post(
        self,
        path: str,
        payload: dict[str, Any],
        *,
        user_id: str,
        role: str,
        tenant_id: str,
        user_jwt: str = '',
        halaqat_ids: list[str] | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        if not self.base_url or not self.service_key:
            return False, {'error': 'not_configured'}

        safe_payload = minimize_payload(payload)
        body = json.dumps(safe_payload).encode('utf-8')
        req = urllib.request.Request(
            url=f'{self.base_url}{path}',
            data=body,
            headers=self._headers(
                user_id=user_id,
                role=role,
                tenant_id=tenant_id,
                user_jwt=user_jwt,
                halaqat_ids=halaqat_ids,
                extra_headers=extra_headers,
            ),
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode('utf-8')
                data = json.loads(raw) if raw else {}
                return True, data
        except urllib.error.HTTPError as he:
            try:
                err_data = json.loads(he.read().decode('utf-8'))
            except Exception:
                err_data = {'detail': he.reason}
            return False, {'http_status': he.code, **err_data}
        except Exception:
            return False, {'error': 'unreachable'}

    def health_status(self) -> dict[str, Any]:
        flags = getattr(settings, 'AI_FEATURE_FLAGS', {})
        if not self.base_url or not self.service_key or not flags.get('MASTER_ENABLED', True):
            return {
                'ai_available': False,
                'features': flags,
                'message': FALLBACK_MESSAGES['chat'],
            }
        try:
            req = urllib.request.Request(url=f'{self.base_url}/ready', method='GET')
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                ready = bool(data.get('ready', False))
                return {
                    'ai_available': ready,
                    'features': flags,
                    'orchestrator': data,
                    'message': 'المساعد الذكي جاهز' if ready else FALLBACK_MESSAGES['chat'],
                }
        except Exception:
            return {
                'ai_available': False,
                'features': flags,
                'message': FALLBACK_MESSAGES['chat'],
            }

    def chat(
        self,
        *,
        message: str,
        context: dict[str, Any] | None = None,
        user_id: str,
        role: str,
        tenant_id: str,
    ) -> dict[str, Any]:
        if not self.is_feature_enabled('ASSISTANT_CHAT'):
            return {
                'ai_available': False,
                'feature_enabled': False,
                'answer': FALLBACK_MESSAGES['chat'],
            }
        ok, data = self._post(
            '/v1/chat',
            {'message': message, 'context': context or {}},
            user_id=user_id,
            role=role,
            tenant_id=tenant_id,
        )
        if not ok or not data.get('ai_available', False):
            return {
                'ai_available': False,
                'feature_enabled': True,
                'answer': sanitize_output_for_ui(data.get('detail') or data.get('answer') or FALLBACK_MESSAGES['chat']),
                'rate_limited': data.get('http_status') == 429,
            }
        return {
            'ai_available': True,
            'feature_enabled': True,
            'answer': sanitize_output_for_ui(data.get('answer', '')),
            'prompt_version': data.get('prompt_version', '1.0.0'),
        }

    def agent_turn(
        self,
        *,
        utterance: str,
        halaqat_ids: list[str],
        user_id: str,
        role: str,
        tenant_id: str,
        user_jwt: str = '',
    ) -> dict[str, Any]:
        if not self.is_feature_enabled('VOICE_TEXT_AGENT'):
            return {
                'ai_available': False,
                'feature_enabled': False,
                'status': 'degraded',
                'speak': FALLBACK_MESSAGES['agent'],
            }
        ok, data = self._post(
            '/v1/agent/turn',
            {'utterance': utterance, 'halaqat_ids': [str(x) for x in halaqat_ids]},
            user_id=user_id,
            role=role,
            tenant_id=tenant_id,
            user_jwt=user_jwt,
        )
        if not ok or not data.get('ai_available', True):
            return {
                'ai_available': False,
                'feature_enabled': True,
                'status': 'degraded',
                'speak': sanitize_output_for_ui(data.get('detail') or data.get('speak') or FALLBACK_MESSAGES['agent']),
            }
        if 'speak' in data:
            data['speak'] = sanitize_output_for_ui(data['speak'])
        return {'feature_enabled': True, **data}

    def confirm_agent_action(
        self,
        *,
        token: str,
        utterance: str,
        idempotency_key: str = '',
        user_id: str,
        role: str,
        tenant_id: str,
        user_jwt: str = '',
    ) -> dict[str, Any]:
        if not self.is_feature_enabled('VOICE_TEXT_AGENT'):
            return {
                'ai_available': False,
                'status': 'degraded',
                'speak': FALLBACK_MESSAGES['agent'],
            }
        extra = {'Idempotency-Key': idempotency_key} if idempotency_key else None
        ok, data = self._post(
            '/v1/confirm',
            {'token': token, 'utterance': utterance},
            user_id=user_id,
            role=role,
            tenant_id=tenant_id,
            user_jwt=user_jwt,
            extra_headers=extra,
        )
        if not ok:
            return {
                'ai_available': False,
                'status': 'degraded',
                'speak': sanitize_output_for_ui(data.get('detail') or FALLBACK_MESSAGES['agent']),
            }
        if 'speak' in data:
            data['speak'] = sanitize_output_for_ui(data['speak'])
        return {'ai_available': True, **data}

    def generate_evaluation_note(
        self,
        *,
        recitation_type: str,
        target_unit: str,
        grade: str,
        memorization_mistakes: int = 0,
        tajweed_mistakes: int = 0,
        behavior_score: int = 10,
        requires_repeat: bool = False,
        teacher_notes: str = '',
        user_id: str,
        role: str,
        tenant_id: str,
    ) -> dict[str, Any]:
        fallback = (
            f"بارك الله فيك على تسميع ({target_unit}) بتقدير {grade}. "
            + ("ننصح بمراجعة المقطع لتثبيت الحفظ قبل الجلسة القادمة." if requires_repeat else "استمر على هذا التميز والهمة العالية!")
        )
        if not self.is_feature_enabled('EVALUATION_NOTES'):
            return {'ai_available': False, 'feature_enabled': False, 'note': fallback}

        ok, data = self._post(
            '/v1/evaluation-note',
            {
                'recitation_type': recitation_type,
                'target_unit': target_unit,
                'grade': grade,
                'memorization_mistakes': memorization_mistakes,
                'tajweed_mistakes': tajweed_mistakes,
                'behavior_score': behavior_score,
                'requires_repeat': requires_repeat,
                'teacher_notes': teacher_notes,
            },
            user_id=user_id,
            role=role,
            tenant_id=tenant_id,
        )
        if not ok:
            return {'ai_available': False, 'feature_enabled': True, 'note': fallback}
        return {
            'ai_available': bool(data.get('ai_available', False)),
            'feature_enabled': True,
            'note': sanitize_output_for_ui(data.get('note') or fallback),
        }

    def generate_report_insight(
        self,
        *,
        period: str,
        average_cpi: str,
        attendance_rate: str,
        total_pages: int,
        total_halaqat: int,
        extra_context: str = '',
        user_id: str,
        role: str,
        tenant_id: str,
    ) -> dict[str, Any]:
        fallback = (
            f"تحليل أداء الحلقات للفترة ({period}) يظهر متوسط كفاءة {average_cpi} "
            f"ونسبة حضور {attendance_rate} بإجمالي {total_pages} صفحة مسمّعة عبر {total_halaqat} حلقة."
        )
        if not self.is_feature_enabled('REPORT_INSIGHTS'):
            return {'ai_available': False, 'feature_enabled': False, 'insight': fallback}

        ok, data = self._post(
            '/v1/report-insight',
            {
                'period': period,
                'average_cpi': average_cpi,
                'attendance_rate': attendance_rate,
                'total_pages': total_pages,
                'total_halaqat': total_halaqat,
                'extra_context': extra_context,
            },
            user_id=user_id,
            role=role,
            tenant_id=tenant_id,
        )
        if not ok:
            return {'ai_available': False, 'feature_enabled': True, 'insight': fallback}
        return {
            'ai_available': bool(data.get('ai_available', False)),
            'feature_enabled': True,
            'insight': sanitize_output_for_ui(data.get('insight') or fallback),
        }

    def generate_quiz(
        self,
        *,
        topic: str,
        count: int = 3,
        difficulty: str = 'متوسط',
        user_id: str,
        role: str,
        tenant_id: str,
    ) -> dict[str, Any]:
        if not self.is_feature_enabled('QUIZ_GENERATOR'):
            return {
                'ai_available': False,
                'feature_enabled': False,
                'content': '',
                'fallback_message': FALLBACK_MESSAGES['quiz'],
            }
        ok, data = self._post(
            '/v1/quiz-generate',
            {'topic': topic, 'count': count, 'difficulty': difficulty},
            user_id=user_id,
            role=role,
            tenant_id=tenant_id,
        )
        if not ok or not data.get('ai_available', False):
            return {
                'ai_available': False,
                'feature_enabled': True,
                'content': '',
                'fallback_message': FALLBACK_MESSAGES['quiz'],
            }
        return {
            'ai_available': True,
            'feature_enabled': True,
            'content': sanitize_output_for_ui(data.get('content', '')),
        }

    def transcribe_audio(
        self,
        *,
        audio_bytes: bytes,
        filename: str = 'audio.wav',
        language: str = 'ar',
        user_id: str,
        role: str,
        tenant_id: str,
    ) -> dict[str, Any]:
        if not self.is_feature_enabled('STT_TRANSCRIPTION'):
            return {
                'ai_available': False,
                'feature_enabled': False,
                'status': 'degraded',
                'text': '',
                'speak': FALLBACK_MESSAGES['stt'],
            }
        b64 = base64.b64encode(audio_bytes).decode('ascii')
        ok, data = self._post(
            '/v1/audio/transcribe',
            {'audio_base64': b64, 'filename': filename, 'language': language},
            user_id=user_id,
            role=role,
            tenant_id=tenant_id,
        )
        if not ok or not data.get('ai_available', False):
            return {
                'ai_available': False,
                'feature_enabled': True,
                'status': 'degraded',
                'text': '',
                'speak': FALLBACK_MESSAGES['stt'],
            }
        return {
            'ai_available': True,
            'feature_enabled': True,
            'status': data.get('status', 'ok'),
            'text': sanitize_output_for_ui(data.get('text', '')),
            'speak': sanitize_output_for_ui(data.get('speak', '')),
        }


def get_orchestrator_client() -> OrchestratorClient:
    return OrchestratorClient()

