import apiClient from './api/apiClient';

// 1. نقاط الطلاب
export const getStudentsPointsList = async (params = {}) => {
    const res = await apiClient.get('/api/points/students/', { params });
    return res.data;
};

export const grantBonusPoints = async (payload) => {
    const res = await apiClient.post('/api/points/bonus/', payload);
    return res.data;
};

export const getPointsTransactions = async (params = {}) => {
    const res = await apiClient.get('/api/points/transactions/', { params });
    return res.data;
};

// 2. المكافآت والمتجر
export const getRewardsList = async () => {
    const res = await apiClient.get('/api/rewards/');
    return res.data;
};

export const createReward = async (payload) => {
    const res = await apiClient.post('/api/rewards/', payload);
    return res.data;
};

export const updateReward = async (id, payload) => {
    const res = await apiClient.put(`/api/rewards/${id}/`, payload);
    return res.data;
};

export const deleteReward = async (id) => {
    const res = await apiClient.delete(`/api/rewards/${id}/`);
    return res.data;
};

export const redeemReward = async (payload) => {
    const res = await apiClient.post('/api/rewards/redeem/', payload);
    return res.data;
};

// 3. إدارة طلبات المكافآت من قبل الإدارة
export const getAdminRewardClaims = async (params = {}) => {
    const res = await apiClient.get('/api/rewards/claims/', { params });
    return res.data;
};

export const actionAdminRewardClaim = async (id, payload) => {
    const res = await apiClient.post(`/api/rewards/claims/${id}/action/`, payload);
    return res.data;
};

// 4. التحكم بفتح وإغلاق المتجر (إعدادات المركز والمسجد)
export const getStoreSettings = async () => {
    const res = await apiClient.get('/api/rewards/store-settings/');
    return res.data;
};

export const updateStoreSettings = async (payload) => {
    const res = await apiClient.post('/api/rewards/store-settings/', payload);
    return res.data;
};

// 5. واجهات بوابة الطالب / ولي الأمر الموحدة
export const getStudentPortalDashboard = async (params = {}) => {
    const res = await apiClient.get('/api/student-portal/dashboard/', { params });
    return res.data;
};

export const getStudentPortalPointsStore = async (params = {}) => {
    const res = await apiClient.get('/api/student-portal/points-store/', { params });
    return res.data;
};

export const claimStudentReward = async (payload) => {
    const res = await apiClient.post('/api/student-portal/claim-reward/', payload);
    return res.data;
};

export const getStudentFollowUp = async (params = {}) => {
    const res = await apiClient.get('/api/student-portal/follow-up/', { params });
    return res.data;
};

export const getStudentNotifications = async (params = {}) => {
    const res = await apiClient.get('/api/student-portal/notifications/', { params });
    return res.data;
};

export const markAllStudentNotificationsRead = async () => {
    const res = await apiClient.post('/api/student-portal/notifications/mark-read/');
    return res.data;
};

export const markStudentNotificationRead = async (id) => {
    const res = await apiClient.post(`/api/student-portal/notifications/${id}/read/`);
    return res.data;
};

// 6. المسابقات
export const getCompetitionsList = async () => {
    const res = await apiClient.get('/api/competitions/');
    return res.data;
};

export const getCompetitionDetail = async (id) => {
    const res = await apiClient.get(`/api/competitions/${id}/`);
    return res.data;
};

export const createCompetition = async (payload) => {
    const res = await apiClient.post('/api/competitions/', payload);
    return res.data;
};

export const updateCompetition = async (id, payload) => {
    const res = await apiClient.put(`/api/competitions/${id}/`, payload);
    return res.data;
};

export const deleteCompetition = async (id) => {
    const res = await apiClient.delete(`/api/competitions/${id}/`);
    return res.data;
};

export const addCompetitionQuestion = async (compId, payload) => {
    const res = await apiClient.post(`/api/competitions/${compId}/questions/`, payload);
    return res.data;
};

export const updateCompetitionQuestion = async (qId, payload) => {
    const res = await apiClient.put(`/api/competitions/questions/${qId}/`, payload);
    return res.data;
};

export const deleteCompetitionQuestion = async (qId) => {
    const res = await apiClient.delete(`/api/competitions/questions/${qId}/`);
    return res.data;
};

// 7. واجهات الطالب للمسابقات
export const getStudentCompetitions = async (params = {}) => {
    const res = await apiClient.get('/api/student/competitions/', { params });
    return res.data;
};

export const startStudentCompetition = async (compId) => {
    const res = await apiClient.post(`/api/student/competitions/${compId}/start/`);
    return res.data;
};

export const submitStudentCompetition = async (compId, payload) => {
    const res = await apiClient.post(`/api/student/competitions/${compId}/submit/`, payload);
    return res.data;
};

