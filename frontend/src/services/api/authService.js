import apiClient from './apiClient';
import { refreshAccessToken, revokeSession } from '../sessionRefresh';
import { clearSession } from '../tokenStore';

/** تسجيل الدخول */
export const login = async ({ subdomain, username, password }) => {
    const response = await apiClient.post('/api/tenants/login/', { subdomain, username, password });
    return response.data;
};

/** تسجيل الخروج (محلي) */
export const logout = async () => {
    await revokeSession();   // يُبطل الـ refresh ويمسح الكوكي في الخادم
    clearSession();
    window.location.href = '/login';
};

/** التحقق من صحة التوكن */
export const verifyToken = async () => {
    const response = await apiClient.post('/api/token/verify/');
    return response.data;
};

/** تحديث التوكن */
export const refreshToken = () => refreshAccessToken();
