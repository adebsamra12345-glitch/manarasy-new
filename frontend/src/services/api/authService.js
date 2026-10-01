import apiClient from './apiClient';

/** تسجيل الدخول */
export const login = async ({ subdomain, username, password }) => {
    const response = await apiClient.post('/api/tenants/login/', { subdomain, username, password });
    return response.data;
};

/** تسجيل الخروج (محلي) */
export const logout = () => {
    localStorage.clear();
    window.location.href = '/login';
};

/** التحقق من صحة التوكن */
export const verifyToken = async () => {
    const response = await apiClient.post('/api/token/verify/');
    return response.data;
};

/** تحديث التوكن */
export const refreshToken = async () => {
    const refresh = localStorage.getItem('refresh_token');
    const response = await apiClient.post('/api/token/refresh/', { refresh });
    localStorage.setItem('access_token', response.data.access);
    return response.data;
};
