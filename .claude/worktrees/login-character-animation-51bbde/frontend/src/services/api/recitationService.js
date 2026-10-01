import apiClient from './apiClient';

export const getRecitationSessions = async (params = {}) => {
    const response = await apiClient.get('/api/recitation/', { params });
    return response.data;
};

export const submitRecitationGrade = async (payload) => {
    const response = await apiClient.post('/api/recitation/grade/', payload);
    return response.data;
};

export const getStudentRecitationHistory = async (studentId) => {
    const response = await apiClient.get('/api/recitation/student/' + studentId + '/history/');
    return response.data;
};
