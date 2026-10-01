import apiClient from './apiClient';

export const getPlans = async () => {
    const response = await apiClient.get('/api/subscriptions/plans/');
    return response.data;
};

export const registerTenant = async (payload) => {
    const response = await apiClient.post('/api/tenants/', payload);
    return response.data;
};

export const getTenantList = async () => {
    const response = await apiClient.get('/api/tenants/');
    return response.data;
};

export const getMosqueAdminDashboardData = async () => {
    const response = await apiClient.get('/api/tenants/dashboard/mosque-admin/');
    return response.data;
};

// ===== الطلاب =====
export const getStudents = async () => {
    const response = await apiClient.get('/api/students-and-parents/students/');
    return response.data;
};

export const getStudentsByRing = async (halaqaId) => {
    let url = '/api/students-and-parents/students/';
    if (halaqaId && halaqaId !== 'all') {
        url += `?halaqa_id=${halaqaId}`;
    }
    const response = await apiClient.get(url);
    return response.data;
};

export const enrollStudent = async (payload) => {
    const response = await apiClient.post('/api/students-and-parents/students/', payload);
    return response.data;
};

export const submitStudentRegistrationRequest = async (payload) => {
    const response = await apiClient.post('/api/students-and-parents/students/registration-requests/', payload);
    return response.data;
};

// ===== المشاريع =====
export const getProjects = async () => {
    const response = await apiClient.get('/api/centers-and-projects/projects/');
    return response.data;
};

// ===== الحلقات القرآنية =====
export const getHalaqat = async () => {
    const response = await apiClient.get('/api/halaqat/');
    return response.data;
};

export const getHalaqaById = async (id) => {
    const response = await apiClient.get('/api/halaqat/' + id + '/');
    return response.data;
};

// ===== التقارير والإحصائيات =====
export const getAnalyticsSummary = async (halaqaId = null) => {
    let url = '/api/reports/analytics/';
    if (halaqaId) {
        url += `?halaqa_id=${halaqaId}`;
    }
    const response = await apiClient.get(url);
    return response.data;
};

// ===== الجلسات =====
export const getSessions = async (halaqaId) => {
    const response = await apiClient.get(`/api/attendance/sessions/?halaqa_id=${halaqaId}`);
    return response.data;
};

export const startSession = async (data) => {
    // data should contain { halaqa_id, teacher_id, absent_student_ids, notes }
    const response = await apiClient.post('/api/attendance/sessions/start/', data);
    return response.data;
};

export const getTeacherSessionDetail = async (sessionId) => {
    const response = await apiClient.get(`/api/attendance/sessions/${sessionId}/`);
    return response.data;
};

export const updateSessionDetails = async (sessionId, data) => {
    // data should contain { students: [{attendance_id, status, behavior_score, notes}] }
    const response = await apiClient.put(`/api/attendance/sessions/${sessionId}/`, data);
    return response.data;
};

// ===== التسميع =====
export const evaluateRecitation = async (data) => {
    // data should contain { attendance_id, student_id, page_number, evaluation_grade_id, grade, notes, ... }
    const response = await apiClient.post('/api/recitation/evaluate/', data);
    return response.data;
};
