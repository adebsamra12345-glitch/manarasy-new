import apiClient from './apiClient';

/**
 * محادثة مع وكيل منارة (مسار واحد معتمد): /api/ai/agent/chat/
 * يرجع: { answer, ui_actions, confirm_required, session_id, tool_calls_made }
 */
export const sendAgentMessage = async (message, sessionId = '', channel = 'text') => {
    const q = (message || '').trim();
    if (!q) throw new Error('النص فارغ');

    const response = await apiClient.post('/api/ai/agent/chat/', {
        message: q,
        session_id: sessionId || '',
        channel,
    });
    return response.data?.data || response.data;
};

/**
 * تأكيد/إلغاء إجراء كتابة معلّق في الخادم (حضور، تقييم، نقاط...)
 * @param {string} token رمز التأكيد من confirm_required.confirm_token
 * @param {string} utterance «نعم» أو «لا»
 */
export const confirmAgentAction = async (token, utterance, idempotencyKey = '') => {
    const response = await apiClient.post(
        '/api/ai/agent/confirm/',
        { token, utterance },
        idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined
    );
    return response.data?.data || response.data;
};

/** تقييم رد المساعد: rating = 1 (👍) أو -1 (👎) */
export const sendAgentFeedback = async (messageId, rating, comment = '') => {
    const response = await apiClient.post('/api/ai/agent/feedback/', { message_id: messageId, rating, comment });
    return response.data;
};

/** إعدادات الخصوصية للمساعد: { training_consent, retention_days } */
export const getAgentSettings = async () => {
    const response = await apiClient.get('/api/ai/agent/settings/');
    return response.data?.data || {};
};

/** تغيير موافقة المسجد على استخدام المحادثات لتحسين المساعد (مدير المسجد فقط) */
export const setAgentTrainingConsent = async (trainingConsent) => {
    const response = await apiClient.put('/api/ai/agent/settings/', { training_consent: Boolean(trainingConsent) });
    return response.data?.data || {};
};

/** حذف كل محادثات المستخدم الحالي مع المساعد */
export const deleteAgentHistory = async () => {
    const response = await apiClient.delete('/api/ai/agent/history/');
    return response.data?.data || {};
};

/** صوت عربي من الخادم لنص الرد (اختياري). يرمي خطأ عند عدم التوفر فيُستعمل صوت المتصفح. */
export const fetchAgentSpeech = async (text) => {
    const response = await apiClient.post('/api/ai/agent/tts/', { text }, { responseType: 'blob', timeout: 20000 });
    return response.data;
};

/** قائمة أدوار المساعد المنتظرة للمراجعة (مدير المسجد) */
export const getAgentReviewQueue = async () => {
    const response = await apiClient.get('/api/ai/agent/review/');
    return response.data?.data || [];
};

/** اعتماد/رفض دور مع رد مصحَّح اختياري: status = 'approved' | 'rejected' */
export const reviewAgentMessage = async (messageId, status, expectedAnswer = '') => {
    const response = await apiClient.post(`/api/ai/agent/review/${messageId}/`, {
        status,
        expected_answer: expectedAnswer,
    });
    return response.data;
};

/**
 * تفريغ التسجيل الصوتي عبر محرك STT في الخادم (/api/ai/audio-eval/)
 *
 * @param {Blob} audioBlob - ملف الصوت المسجل عبر MediaRecorder
 * @param {string} mimeType - نوع الصوت (e.g. 'audio/webm', 'audio/wav')
 * @returns {Promise<string>} النص المفرغ من الصوت
 */
export const transcribeAudioCommand = async (audioBlob, mimeType = 'audio/webm') => {
    if (!audioBlob) throw new Error('بيانات الصوت مفقودة');

    const formData = new FormData();
    const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    formData.append('audio', audioBlob, `agent_command.${ext}`);
    formData.append('file', audioBlob, `agent_command.${ext}`);

    const response = await apiClient.post('/api/ai/audio-eval/', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        timeout: 15000,
    });

    const data = response.data?.data || response.data || {};
    const transcribedText = (data.text || data.transcription || data.utterance || '').trim();
    return transcribedText;
};
