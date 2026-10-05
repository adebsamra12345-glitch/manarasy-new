import platformClient from './platformClient';

// ---- Auth
export const platformLogin = async (email, password) =>
    (await platformClient.post('/api/platform/auth/login/', { email, password })).data;
export const platformLogout = async () => (await platformClient.post('/api/platform/auth/logout/')).data;

// ---- Registration requests
export const listRegistrations = async (params = {}) =>
    (await platformClient.get('/api/platform/registrations/', { params })).data;
export const getRegistration = async (id) =>
    (await platformClient.get(`/api/platform/registrations/${id}/`)).data;

/** يجلب الإيصال كـ Blob عبر طلب موثَّق (لا يوضع التوكن في الرابط) ويعيد { blob, contentType } */
export const fetchReceiptBlob = async (registrationId, receiptId) => {
    const res = await platformClient.get(
        `/api/platform/registrations/${registrationId}/receipts/${receiptId}/`,
        { responseType: 'blob', timeout: 60000 },
    );
    return { blob: res.data, contentType: res.headers['content-type'] };
};

// التجهيز قد يستغرق دقائق (إنشاء قاعدة + ترحيلات) ⇒ مهلة طويلة
const LONG = { timeout: 200000 };
export const approveRegistration = async (id) =>
    (await platformClient.post(`/api/platform/registrations/${id}/approve/`, {}, LONG)).data;
export const retryRegistration = async (id) =>
    (await platformClient.post(`/api/platform/registrations/${id}/retry/`, {}, LONG)).data;
export const rejectRegistration = async (id, reason) =>
    (await platformClient.post(`/api/platform/registrations/${id}/reject/`, { reason })).data;

// ---- Mosques
export const listMosques = async (params = {}) =>
    (await platformClient.get('/api/platform/mosques/', { params })).data;
export const createMosque = async (payload) =>
    (await platformClient.post('/api/platform/mosques/', payload, LONG)).data;

export const getPlatformPlans = async () => (await platformClient.get('/api/subscriptions/plans/')).data;
