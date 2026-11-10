import axios from 'axios';
import { setAccessToken, getAccessToken, hasSession, clearSession } from './tokenStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

let inflight = null;

/**
 * تجديد الـ access token عبر كوكي HttpOnly (لا يقرأه JavaScript).
 * طلب واحد فقط في آنٍ واحد (single-flight) حتى لا تتسابق عدة طلبات 401.
 * يعيد التوكن الجديد، أو null إن فشل التجديد (الجلسة منتهية).
 */
export const refreshAccessToken = () => {
    if (inflight) return inflight;
    const tenantId = localStorage.getItem('tenant_id');
    inflight = axios
        .post(`${API_BASE_URL}/api/tenants/refresh/`, {}, {
            withCredentials: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                ...(tenantId ? { 'Tenant-ID': tenantId } : {}),
            },
        })
        .then((res) => {
            const data = res.data?.data;
            if (!data?.access_token) return null;
            setAccessToken(data.access_token);
            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('user_role', data.user.role);
                if (Array.isArray(data.user.roles)) {
                    localStorage.setItem('user_roles', JSON.stringify(data.user.roles));
                }
            }
            return data.access_token;
        })
        .catch(() => null)
        .finally(() => { inflight = null; });
    return inflight;
};

/** إبطال الجلسة في الخادم ومسح الكوكي (best-effort، لا ينتظر). */
export const revokeSession = () => {
    const tenantId = localStorage.getItem('tenant_id');
    return axios
        .post(`${API_BASE_URL}/api/tenants/logout/`, {}, {
            withCredentials: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                ...(tenantId ? { 'Tenant-ID': tenantId } : {}),
            },
        })
        .catch(() => null);
};

/**
 * يُستدعى قبل أول رسم للواجهة: يرحّل توكن localStorage القديم إلى الذاكرة (مرة واحدة)،
 * وإن وُجدت جلسة بلا توكن في الذاكرة (إعادة تحميل) يجدّده صامتاً عبر كوكي الـ refresh.
 */
export const bootSession = async () => {
    try {
        const legacy = localStorage.getItem('access_token');
        if (legacy) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setAccessToken(legacy);
        }
    } catch { /* التخزين غير متاح */ }
    if (getAccessToken() || !hasSession()) return;
    const token = await refreshAccessToken();
    if (!token) clearSession();
};
