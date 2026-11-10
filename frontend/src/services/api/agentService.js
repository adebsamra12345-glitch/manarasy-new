import apiClient from './apiClient';

/** إرسال أمر صوتي/كتابي لوكيل منارة وتلقّي النية والإجراء المحلول */
export const sendAgentCommand = async (text, channel = 'text') => {
    const response = await apiClient.post('/api/agent/command/', { text, channel });
    return response.data;
};
