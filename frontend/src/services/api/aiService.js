import apiClient from './apiClient';

/** التنبؤ بمعدل النسيان ومقترحات المراجعة للطالب */
export const getMemorizationPrediction = async (studentId) => {
    const response = await apiClient.get('/api/ai/memorization-prediction/' + studentId + '/');
    return response.data;
};

/** تحليل الأداء الصوتي الأولي */
export const analyzeAudioPronunciation = async (formData) => {
    const response = await apiClient.post('/api/ai/audio-eval/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};
