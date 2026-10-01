import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// إنشاء نسخة axios مع الإعدادات الافتراضية
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor لإضافة Token و Tenant-ID تلقائياً في كل طلب
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        const tenantId = localStorage.getItem('tenant_id');

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        if (tenantId) {
            config.headers['Tenant-ID'] = tenantId;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor للتعامل مع الأخطاء الموحدة (مثل انتهاء صلاحية الـ Token)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // تسجيل الخروج تلقائياً عند انتهاء صلاحية التوكن
            localStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ===== لوحة التحكم =====
export const getMosqueAdminDashboardData = async () => {
    const response = await apiClient.get('/api/tenants/dashboard/mosque-admin/');
    return response.data;
};

// ===== Auth =====
export const login = async ({ subdomain, username, password }) => {
    const response = await apiClient.post('/api/tenants/login/', {
        subdomain,
        username,
        password,
    });
    return response.data;
};

// ===== الحلقات القرآنية =====
// ===== التسجيل والدفع =====
export const getPlans = async () => {
    const response = await apiClient.get('/api/subscriptions/plans/');
    return response.data;
};

export const registerTenant = async (payload) => {
    const response = await apiClient.post('/api/tenants/', payload);
    return response.data;
};

export const createSubscription = async (payload) => {
    const response = await apiClient.post('/api/subscriptions/', payload);
    return response.data;
};

export const createPayment = async (payload) => {
    const response = await apiClient.post('/api/payments/', payload);
    return response.data;
};

// ===== الحلقات القرآنية =====
export const getHalaqat = async () => {
    const response = await apiClient.get('/api/halaqat/');
    return response.data;
};

export const getHalaqaById = async (id) => {
    const response = await apiClient.get(`/api/halaqat/${id}/`);
    return response.data;
};

// ===== الجلسات والحضور =====
export const getSessions = async () => {
    const response = await apiClient.get('/api/attendance/');
    return response.data;
};

export const getSessionDetail = async (sessionId) => {
    const response = await apiClient.get(`/api/attendance/sessions/${sessionId}/`);
    return response.data;
};

export const startSession = async (payload) => {
    const response = await apiClient.post('/api/attendance/sessions/start/', payload);
    return response.data;
};

// ===== الطلاب =====
export const getStudents = async () => {
    const response = await apiClient.get('/api/students-and-parents/students/');
    return response.data;
};

export const enrollStudent = async (payload) => {
    const response = await apiClient.post('/api/students-and-parents/students/', payload);
    return response.data;
};

export default apiClient;
