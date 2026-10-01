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

export const getMosqueAdminDashboardData = async (centerId = 'all') => {
    const response = await apiClient.get(`/api/tenants/dashboard/mosque-admin/?center_id=${centerId}`);
    return response.data;
};

// ===== الطلاب =====
export const approveRegistrationRequest = async (requestId) => {
    const response = await apiClient.post(`/api/tenants/dashboard/registration-requests/${requestId}/approve/`);
    return response.data;
};

export const rejectRegistrationRequest = async (requestId) => {
    const response = await apiClient.post(`/api/tenants/dashboard/registration-requests/${requestId}/reject/`);
    return response.data;
};

export const getStudents = async (params = {}) => {
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '' && v !== 'all')
    );
    const query = new URLSearchParams(cleanParams).toString();
    const url = query ? `/api/students-and-parents/students/?${query}` : '/api/students-and-parents/students/';
    const response = await apiClient.get(url);
    return response.data;
};

export const getStudentById = async (id) => {
    const response = await apiClient.get(`/api/students-and-parents/students/${id}/`);
    return response.data;
};

export const createStudent = async (payload) => {
    const response = await apiClient.post('/api/students-and-parents/students/', payload);
    return response.data;
};

export const updateStudent = async (id, payload) => {
    const response = await apiClient.put(`/api/students-and-parents/students/${id}/`, payload);
    return response.data;
};

export const deleteStudent = async (id) => {
    const response = await apiClient.delete(`/api/students-and-parents/students/${id}/`);
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

export const getStudentRegistrationRequests = async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = query
        ? `/api/students-and-parents/students/registration-requests/?${query}`
        : '/api/students-and-parents/students/registration-requests/';
    const response = await apiClient.get(url);
    return response.data;
};

export const cancelStudentRegistrationRequest = async (requestId) => {
    const response = await apiClient.post(`/api/students-and-parents/students/registration-requests/${requestId}/cancel/`);
    return response.data;
};

export const submitStudentDeletionRequest = async (payload) => {
    const response = await apiClient.post('/api/students-and-parents/students/deletion-requests/', payload);
    return response.data;
};

export const getStudentDeletionRequests = async (statusFilter = '') => {
    const url = statusFilter
        ? `/api/students-and-parents/students/deletion-requests/?status=${statusFilter}`
        : '/api/students-and-parents/students/deletion-requests/';
    const response = await apiClient.get(url);
    return response.data;
};

export const cancelStudentDeletionRequest = async (requestId) => {
    const response = await apiClient.post(`/api/students-and-parents/students/deletion-requests/${requestId}/cancel/`);
    return response.data;
};

// ===== المشاريع والمراكز =====
export const getProjects = async () => {
    const response = await apiClient.get('/api/centers-and-projects/projects/');
    return response.data;
};

export const getProjectById = async (id) => {
    const response = await apiClient.get(`/api/centers-and-projects/projects/${id}/`);
    return response.data;
};

export const createProject = async (payload) => {
    const response = await apiClient.post('/api/centers-and-projects/projects/', payload);
    return response.data;
};

export const updateProject = async (id, payload) => {
    const response = await apiClient.put(`/api/centers-and-projects/projects/${id}/`, payload);
    return response.data;
};

export const patchProjectStatus = async (id, isActive) => {
    const response = await apiClient.patch(`/api/centers-and-projects/projects/${id}/`, { is_active: isActive });
    return response.data;
};

export const deleteProject = async (id) => {
    const response = await apiClient.delete(`/api/centers-and-projects/projects/${id}/`);
    return response.data;
};

// ===== مراحل المشاريع وأجزاؤها =====
export const getProjectStages = async (projectId) => {
    const response = await apiClient.get(`/api/centers-and-projects/projects/${projectId}/stages/`);
    return response.data;
};

export const createProjectStage = async (projectId, payload) => {
    const response = await apiClient.post(`/api/centers-and-projects/projects/${projectId}/stages/`, payload);
    return response.data;
};

export const updateProjectStage = async (stageId, payload) => {
    const response = await apiClient.put(`/api/centers-and-projects/projects/stages/${stageId}/`, payload);
    return response.data;
};

export const deleteProjectStage = async (stageId) => {
    const response = await apiClient.delete(`/api/centers-and-projects/projects/stages/${stageId}/`);
    return response.data;
};

export const createStagePart = async (stageId, payload) => {
    const response = await apiClient.post(`/api/centers-and-projects/projects/stages/${stageId}/parts/`, payload);
    return response.data;
};

export const updateStagePart = async (partId, payload) => {
    const response = await apiClient.put(`/api/centers-and-projects/projects/parts/${partId}/`, payload);
    return response.data;
};

export const deleteStagePart = async (partId) => {
    const response = await apiClient.delete(`/api/centers-and-projects/projects/parts/${partId}/`);
    return response.data;
};

// ===== نماذج التقييم والامتحانات والمراكز =====
export const getEvaluationTemplates = async () => {
    const response = await apiClient.get('/api/centers-and-projects/evaluations/templates/');
    return response.data;
};

export const getEvaluationTemplateById = async (id) => {
    const response = await apiClient.get(`/api/centers-and-projects/evaluations/templates/${id}/`);
    return response.data;
};

export const createEvaluationTemplate = async (payload) => {
    const response = await apiClient.post('/api/centers-and-projects/evaluations/templates/', payload);
    return response.data;
};

export const updateEvaluationTemplate = async (id, payload) => {
    const response = await apiClient.put(`/api/centers-and-projects/evaluations/templates/${id}/`, payload);
    return response.data;
};

export const deleteEvaluationTemplate = async (id) => {
    const response = await apiClient.delete(`/api/centers-and-projects/evaluations/templates/${id}/`);
    return response.data;
};

export const createEvaluationGrade = async (templateId, payload) => {
    const response = await apiClient.post(`/api/centers-and-projects/evaluations/templates/${templateId}/grades/`, payload);
    return response.data;
};

export const updateEvaluationGrade = async (gradeId, payload) => {
    const response = await apiClient.put(`/api/centers-and-projects/evaluations/grades/${gradeId}/`, payload);
    return response.data;
};

export const deleteEvaluationGrade = async (gradeId) => {
    const response = await apiClient.delete(`/api/centers-and-projects/evaluations/grades/${gradeId}/`);
    return response.data;
};

// ===== سلالم الاختبارات وأنواع الأخطاء =====
export const getTestRubrics = async () => {
    const response = await apiClient.get('/api/centers-and-projects/test-rubrics/');
    return response.data;
};

export const getTestRubricById = async (id) => {
    const response = await apiClient.get(`/api/centers-and-projects/test-rubrics/${id}/`);
    return response.data;
};

export const createTestRubric = async (payload) => {
    const response = await apiClient.post('/api/centers-and-projects/test-rubrics/', payload);
    return response.data;
};

export const updateTestRubric = async (id, payload) => {
    const response = await apiClient.put(`/api/centers-and-projects/test-rubrics/${id}/`, payload);
    return response.data;
};

export const deleteTestRubric = async (id) => {
    const response = await apiClient.delete(`/api/centers-and-projects/test-rubrics/${id}/`);
    return response.data;
};

export const createRubricErrorType = async (rubricId, payload) => {
    const response = await apiClient.post(`/api/centers-and-projects/test-rubrics/${rubricId}/error-types/`, payload);
    return response.data;
};

export const updateRubricErrorType = async (errorTypeId, payload) => {
    const response = await apiClient.put(`/api/centers-and-projects/test-rubrics/error-types/${errorTypeId}/`, payload);
    return response.data;
};

export const deleteRubricErrorType = async (errorTypeId) => {
    const response = await apiClient.delete(`/api/centers-and-projects/test-rubrics/error-types/${errorTypeId}/`);
    return response.data;
};

export const getExamTemplates = async () => {
    const response = await apiClient.get('/api/centers-and-projects/exams/templates/');
    return response.data;
};

export const getCentersList = async () => {
    const response = await apiClient.get('/api/centers-and-projects/centers/');
    return response.data;
};

export const getCenterById = async (id) => {
    const response = await apiClient.get(`/api/centers-and-projects/centers/${id}/`);
    return response.data;
};

export const createCenter = async (payload) => {
    const response = await apiClient.post('/api/centers-and-projects/centers/', payload);
    return response.data;
};

export const updateCenter = async (id, payload) => {
    const response = await apiClient.put(`/api/centers-and-projects/centers/${id}/`, payload);
    return response.data;
};

export const deleteCenter = async (id) => {
    const response = await apiClient.delete(`/api/centers-and-projects/centers/${id}/`);
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
    if (halaqaId && halaqaId !== 'all') {
        url += `?halaqa_id=${halaqaId}`;
    }
    const response = await apiClient.get(url);
    return response.data;
};

export const getReportsData = async (params = {}) => {
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const query = new URLSearchParams(cleanParams).toString();
    const url = query ? `/api/reports/data/?${query}` : '/api/reports/data/';
    const response = await apiClient.get(url);
    return response.data;
};

export const getStudentActivityData = async (studentId, params = {}) => {
    const cleanParams = Object.fromEntries(
        Object.entries({ student_id: studentId, ...params }).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const query = new URLSearchParams(cleanParams).toString();
    const url = `/api/reports/student-activity/?${query}`;
    const response = await apiClient.get(url);
    return response.data;
};

export const getAvailableMosqueMonths = async () => {
    const response = await apiClient.get('/api/reports/available-months/');
    return response.data;
};




// ===== الجلسات =====
export const getAvailableSessionDates = async (halaqaId, month = '', excludeSessionId = '') => {
    let url = `/api/attendance/sessions/available-dates/?halaqa_id=${halaqaId}`;
    if (month) url += `&month=${month}`;
    if (excludeSessionId) url += `&exclude_session_id=${excludeSessionId}`;
    const response = await apiClient.get(url);
    return response.data;
};

export const getSessions = async (halaqaId, month = '') => {
    let url = `/api/attendance/sessions/?halaqa_id=${halaqaId}`;
    if (month) url += `&month=${month}`;
    const response = await apiClient.get(url);
    return response.data;
};

export const createSession = async (payload) => {
    const response = await apiClient.post('/api/attendance/sessions/', payload);
    return response.data;
};

export const updateSession = async (sessionId, payload) => {
    const response = await apiClient.put(`/api/attendance/sessions/${sessionId}/`, payload);
    return response.data;
};

export const deleteSession = async (sessionId) => {
    const response = await apiClient.delete(`/api/attendance/sessions/${sessionId}/`);
    return response.data;
};

export const saveSchedule = async (halaqaId, month, sessions) => {
    const response = await apiClient.post('/api/attendance/sessions/save-schedule/', {
        halaqa_id: halaqaId,
        month,
        sessions
    });
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

export const updateRecitationEvaluation = async (recitationId, data) => {
    // data should contain { evaluation_grade_id, grade, notes }
    const response = await apiClient.put(`/api/recitation/evaluate/${recitationId}/`, data);
    return response.data;
};

// ===== جدول الدوام الأسبوعي للمسجد / الجلسات =====
export const getMosqueSchedules = async (centerId = '', projectId = '', month = '') => {
    let url = `/api/centers/schedules/?month=${month || '2026-02'}`;
    if (centerId) url += `&center_id=${centerId}`;
    if (projectId) url += `&project_id=${projectId}`;
    const response = await apiClient.get(url);
    return response.data;
};

export const createMosqueSchedule = async (data) => {
    const response = await apiClient.post('/api/centers/schedules/', data);
    return response.data;
};

export const updateMosqueSchedule = async (scheduleId, data) => {
    const response = await apiClient.put(`/api/centers/schedules/${scheduleId}/`, data);
    return response.data;
};

export const deleteMosqueSchedule = async (scheduleId) => {
    const response = await apiClient.delete(`/api/centers/schedules/${scheduleId}/`);
    return response.data;
};

export const saveMosqueBulkSchedule = async (data) => {
    const response = await apiClient.post('/api/centers/schedules/bulk-save/', data);
    return response.data;
};


