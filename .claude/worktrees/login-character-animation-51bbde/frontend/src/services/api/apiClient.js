import axios from 'axios';

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
});

// Interceptor: إضافة Token و Tenant-ID تلقائياً في كل طلب
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
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
    (error) => {
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;
