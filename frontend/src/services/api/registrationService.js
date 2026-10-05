import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * واجهات التسجيل العامة (بدون توثيق). نسخة axios منفصلة عمداً:
 * لا Authorization ولا Tenant-ID حتى لا يتسرّب أي توكن قديم إلى هذه الطلبات.
 */
const publicClient = axios.create({ baseURL: API_BASE_URL, timeout: 60000 });

export const getPlans = async () => (await publicClient.get('/api/subscriptions/plans/')).data;

/** ينشئ طلب تسجيل بحالة PENDING_PAYMENT ويعيد { id, upload_token, ... } */
export const createRegistration = async (payload) =>
    (await publicClient.post('/api/public/registrations/', payload)).data;

/** يرفع إشعار الدفع. الرمز يُرسل في ترويسة وليس في الرابط. */
export const uploadReceipt = async (registrationId, uploadToken, file, referenceNumber = '', onProgress) => {
    const form = new FormData();
    form.append('file', file);
    if (referenceNumber) form.append('reference_number', referenceNumber);
    const res = await publicClient.post(`/api/public/registrations/${registrationId}/receipt/`, form, {
        headers: { 'X-Upload-Token': uploadToken },
        timeout: 120000,
        onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
    });
    return res.data;
};

export const getRegistrationStatus = async (registrationId, uploadToken) =>
    (await publicClient.get(`/api/public/registrations/${registrationId}/status/`, {
        headers: { 'X-Upload-Token': uploadToken },
    })).data;

/** يستخرج رسالة خطأ مقروءة من استجابة DRF (حقول/تفاصيل) أو من الشبكة */
export const extractApiError = (err, fallback = 'حدث خطأ غير متوقع') => {
    const data = err?.response?.data;
    if (!data) return err?.code === 'ECONNABORTED' ? 'انتهت مهلة الاتصال، حاول مجدداً' : (err?.message || fallback);
    if (typeof data === 'string') return fallback;
    if (data.message) return data.message;
    if (data.detail) return typeof data.detail === 'string' ? data.detail : fallback;
    const first = Object.values(data).flat?.()[0];
    return typeof first === 'string' ? first : fallback;
};
