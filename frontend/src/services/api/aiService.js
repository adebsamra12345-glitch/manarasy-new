import apiClient from './apiClient';
import { isAiFeatureEnabled } from '../../config/features';

/**
 * رسائل بديلة لطيفة (Graceful Degradation) في حال كان جهاز الذكاء الاصطناعي مطفأً أو بطيئاً
 * لضمان عدم تعطل أي صفحة في المنصة.
 */
export const AI_FALLBACK_MESSAGES = {
    OFFLINE: 'المساعد الذكي غير متاح حالياً، يمكنك متابعة عملك في المنصة بشكل طبيعي.',
    DISABLED: 'هذه الميزة الذكية غير مفعّلة حالياً.',
    EVAL_NOTE: 'تم حفظ التقييم بنجاح. يمكنك كتابة ملاحظة المعلم يدوياً.',
    STT: 'تحويل الصوت إلى نص غير متاح حالياً، يمكنك كتابة الملاحظة نصياً.',
};

/** تعقيم نصي إضافي على جهة العميل لمنع أي وسوم HTML */
export const sanitizeAiText = (text) => {
    if (!text) return '';
    return String(text).replace(/<[^>]+>/g, '').replace(/[<>]/g, '').trim();
};

/** فحص حالة خدمة الذكاء الاصطناعي وأعلام الميزات */
export const getAiStatus = async () => {
    if (!isAiFeatureEnabled('AI_MASTER_ENABLED')) {
        return { ai_available: false, message: AI_FALLBACK_MESSAGES.DISABLED };
    }
    try {
        const response = await apiClient.get('/api/ai/status/', { timeout: 4000 });
        return response.data?.data || { ai_available: false, message: AI_FALLBACK_MESSAGES.OFFLINE };
    } catch {
        return { ai_available: false, message: AI_FALLBACK_MESSAGES.OFFLINE };
    }
};

/** الدردشة مع المساعد الذكي لمنارة */
export const sendAiChatMessage = async (message, context = {}) => {
    if (!isAiFeatureEnabled('AI_ASSISTANT_CHAT')) {
        return { ai_available: false, answer: AI_FALLBACK_MESSAGES.DISABLED };
    }
    try {
        const response = await apiClient.post(
            '/api/ai/chat/',
            { message, context },
            { timeout: 10000 }
        );
        const data = response.data?.data || {};
        return {
            ai_available: Boolean(data.ai_available),
            answer: sanitizeAiText(data.answer) || AI_FALLBACK_MESSAGES.OFFLINE,
        };
    } catch {
        return { ai_available: false, answer: AI_FALLBACK_MESSAGES.OFFLINE };
    }
};

/** تنفيذ أمر للوكيل الصوتي/النصي (معلم / مدير) مع دعم التأكيد الصوتي */
export const sendAgentTurn = async (utterance) => {
    if (!isAiFeatureEnabled('AI_VOICE_TEXT_AGENT')) {
        return { ai_available: false, status: 'degraded', speak: AI_FALLBACK_MESSAGES.DISABLED };
    }
    try {
        const response = await apiClient.post(
            '/api/ai/agent/turn/',
            { utterance },
            { timeout: 10000 }
        );
        const data = response.data?.data || {};
        return {
            ...data,
            speak: sanitizeAiText(data.speak),
        };
    } catch {
        return { ai_available: false, status: 'degraded', speak: AI_FALLBACK_MESSAGES.OFFLINE };
    }
};

/** تأكيد أو إلغاء عملية كتابية معلّقة للوكيل */
export const confirmAgentTurn = async (token, utterance, idempotencyKey = '') => {
    if (!isAiFeatureEnabled('AI_VOICE_TEXT_AGENT')) {
        return { ai_available: false, status: 'degraded', speak: AI_FALLBACK_MESSAGES.DISABLED };
    }
    try {
        const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
        const response = await apiClient.post(
            '/api/ai/agent/confirm/',
            { token, utterance },
            { headers, timeout: 10000 }
        );
        const data = response.data?.data || {};
        return {
            ...data,
            speak: sanitizeAiText(data.speak),
        };
    } catch {
        return { ai_available: false, status: 'degraded', speak: AI_FALLBACK_MESSAGES.OFFLINE };
    }
};

/** توليد ملاحظة تربوية ذكية لتقييم التسميع */
export const generateSmartEvaluationNote = async (evalPayload) => {
    if (!isAiFeatureEnabled('AI_EVALUATION_NOTES')) {
        return { ai_available: false, note: '' };
    }
    try {
        const response = await apiClient.post('/api/ai/evaluation-note/', evalPayload, { timeout: 8000 });
        const data = response.data?.data || {};
        return {
            ai_available: Boolean(data.ai_available),
            note: sanitizeAiText(data.note),
        };
    } catch {
        return { ai_available: false, note: '' };
    }
};

/** توليد ملخص تنفيذي ذكي لتقارير الحلقات */
export const generateReportInsight = async (reportPayload) => {
    if (!isAiFeatureEnabled('AI_REPORT_INSIGHTS')) {
        return { ai_available: false, insight: '' };
    }
    try {
        const response = await apiClient.post('/api/ai/report-insight/', reportPayload, { timeout: 10000 });
        const data = response.data?.data || {};
        return {
            ai_available: Boolean(data.ai_available),
            insight: sanitizeAiText(data.insight),
        };
    } catch {
        return { ai_available: false, insight: '' };
    }
};

/** توليد أسئلة مسابقات واختبارات ذكية */
export const generateAiQuizQuestions = async (topic, count = 3, difficulty = 'متوسط') => {
    if (!isAiFeatureEnabled('AI_QUIZ_GENERATOR')) {
        return { ai_available: false, content: '', fallback_message: AI_FALLBACK_MESSAGES.DISABLED };
    }
    try {
        const response = await apiClient.post(
            '/api/ai/quiz-generate/',
            { topic, count, difficulty },
            { timeout: 12000 }
        );
        const data = response.data?.data || {};
        return {
            ai_available: Boolean(data.ai_available),
            content: sanitizeAiText(data.content),
            fallback_message: sanitizeAiText(data.fallback_message),
        };
    } catch {
        return { ai_available: false, content: '', fallback_message: AI_FALLBACK_MESSAGES.OFFLINE };
    }
};

/** التنبؤ بمعدل النسيان ومقترحات المراجعة للطالب (متوافق مع الواجهات الحالية) */
export const getMemorizationPrediction = async (studentId) => {
    if (!isAiFeatureEnabled('AI_REPORT_INSIGHTS')) {
        return { ai_available: false, fallback_message: AI_FALLBACK_MESSAGES.DISABLED };
    }
    try {
        const response = await apiClient.get(`/api/ai/memorization-prediction/${studentId}/`, { timeout: 8000 });
        return response.data?.data || response.data;
    } catch {
        return { ai_available: false, fallback_message: AI_FALLBACK_MESSAGES.OFFLINE };
    }
};

/** تحليل وتفريغ الصوت عبر خدمة STT في الـ Orchestrator */
export const analyzeAudioPronunciation = async (formData) => {
    if (!isAiFeatureEnabled('AI_STT_TRANSCRIPTION')) {
        return { ai_available: false, text: '', speak: AI_FALLBACK_MESSAGES.DISABLED };
    }
    try {
        const response = await apiClient.post('/api/ai/audio-eval/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 12000,
        });
        const data = response.data?.data || response.data || {};
        return {
            ...data,
            text: sanitizeAiText(data.text),
            speak: sanitizeAiText(data.speak),
        };
    } catch {
        return { ai_available: false, text: '', speak: AI_FALLBACK_MESSAGES.STT };
    }
};
