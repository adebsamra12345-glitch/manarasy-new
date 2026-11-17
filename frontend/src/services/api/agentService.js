import apiClient from './apiClient';

/**
 * محادثة مع وكيل منارة (مسار واحد معتمد): /api/ai/agent/chat/
 * يرجع: { answer, ui_actions, confirm_required, session_id, tool_calls_made }
 */
export const sendAgentMessage = async (message, sessionId = '') => {
    const q = (message || '').trim();
    if (!q) throw new Error('النص فارغ');

    const response = await apiClient.post('/api/ai/agent/chat/', {
        message: q,
        session_id: sessionId || '',
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
