import apiClient from './apiClient';

export const getSessions = async () => {
    const response = await apiClient.get('/api/attendance/');
    return response.data;
};

export const getSessionDetail = async (sessionId) => {
    const response = await apiClient.get('/api/attendance/sessions/' + sessionId + '/');
    return response.data;
};

export const startSession = async (payload) => {
    const response = await apiClient.post('/api/attendance/sessions/start/', payload);
    return response.data;
};

export const markAttendance = async (payload) => {
    const response = await apiClient.post('/api/attendance/mark/', payload);
    return response.data;
};
