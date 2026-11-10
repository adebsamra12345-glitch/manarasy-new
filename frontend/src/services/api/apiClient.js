import axios from 'axios';
import { refreshAccessToken } from '../sessionRefresh';
import { getAccessToken, hasSession, clearSession } from '../tokenStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * apiClient — نسخة Axios مُهيَّأة مع ترويسات Tenant-ID و JWT
 * يُستخدم هذا الملف كمصدر مركزي للطلبات.
 * الدوال التفصيلية موجودة في ملفات الخدمات المتخصصة:
 *   - authService.js      (المصادقة)
 *   - tenantService.js    (المساجد والاشتراكات)
 *   - attendanceService.js (الحضور)
 *   - recitationService.js (التسميع)
 *   - paymentService.js   (الدفع - شام كاش)
 *   - quranApiService.js  (المصحف الشريف)
 *   - aiService.js        (الذكاء الاصطناعي)
 */
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,   // لاستلام/إرسال كوكي الـ refresh (HttpOnly)
});

// Interceptor: إضافة Token و Tenant-ID تلقائياً في كل طلب
apiClient.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        const tenantId = localStorage.getItem('tenant_id');
        if (token)    config.headers['Authorization'] = `Bearer ${token}`;
        if (tenantId) config.headers['Tenant-ID'] = tenantId;
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor: معالجة موحّدة لأخطاء 401 (انتهاء صلاحية التوكن)
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config || {};
        const url = original.url || '';
        const isAuthRequest = url.includes('/login') || url.includes('/token') || url.includes('/register')
            || url.includes('/refresh') || url.includes('/logout');
        const isOnLoginPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/login');

        // لا نقوم بإعادة التحميل أو التوجيه إذا كان الخطأ ناتجاً عن محاولة تسجيل الدخول
        if (error.response?.status === 401 && !isAuthRequest && !isOnLoginPage) {
            // محاولة تجديد صامتة مرة واحدة ثم إعادة الطلب الأصلي
            if (!original._retried && (getAccessToken() || hasSession())) {
                original._retried = true;
                const newToken = await refreshAccessToken();
                if (newToken) {
                    original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newToken}` };
                    return apiClient(original);
                }
            }
            clearSession();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;
