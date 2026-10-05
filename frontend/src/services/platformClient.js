import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * عميل أدمن المنصة — منفصل تماماً عن apiClient الخاص بالمساجد:
 *  - التوكن في sessionStorage (يُمسح بإغلاق التبويب) وبمفتاح مختلف عن access_token الخاص بالمساجد.
 *  - لا يرسل Tenant-ID أبداً.
 *  - عند 401 يمسح جلسة المنصة فقط ويعيد إلى /platform/login.
 */
export const PLATFORM_TOKEN_KEY = 'platform_access_token';
export const PLATFORM_ADMIN_KEY = 'platform_admin';

export const getPlatformToken = () => {
    try { return sessionStorage.getItem(PLATFORM_TOKEN_KEY); } catch { return null; }
};
export const clearPlatformSession = () => {
    try {
        sessionStorage.removeItem(PLATFORM_TOKEN_KEY);
        sessionStorage.removeItem(PLATFORM_ADMIN_KEY);
    } catch { /* ignore */ }
};

const platformClient = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

platformClient.interceptors.request.use((config) => {
    const token = getPlatformToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

platformClient.interceptors.response.use(
    (res) => res,
    (error) => {
        const isLogin = (error.config?.url || '').includes('/auth/login');
        if (error.response?.status === 401 && !isLogin) {
            clearPlatformSession();
            if (!window.location.pathname.startsWith('/platform/login')) {
                window.location.assign('/platform/login');
            }
        }
        return Promise.reject(error);
    },
);

export default platformClient;
