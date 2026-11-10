/**
 * مخزن الـ access token في الذاكرة فقط (متغير وحدة) — لا يُكتب في localStorage،
 * فلا يستطيع سكربت XSS قراءته من التخزين. الجلسة الدائمة هي كوكي refresh (HttpOnly).
 * العلم session_active غير حساس: يخبر الواجهة أن هناك جلسة يمكن تجديدها عند إعادة تحميل الصفحة.
 */
const FLAG = 'session_active';
let accessToken = null;

const safe = (fn) => { try { return fn(); } catch { return null; } };

export const getAccessToken = () => accessToken;

export const setAccessToken = (token) => {
    accessToken = token || null;
    safe(() => (token ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG)));
};

export const hasSession = () => safe(() => localStorage.getItem(FLAG) === '1') === true;

/** مسح كل شيء (الذاكرة + التخزين المحلي) عند الخروج أو فشل التجديد. */
export const clearSession = () => {
    accessToken = null;
    safe(() => localStorage.clear());
};
