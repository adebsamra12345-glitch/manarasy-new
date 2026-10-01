import apiClient from './apiClient';

/** إنشاء اشتراك */
export const createSubscription = async (payload) => {
    const response = await apiClient.post('/api/subscriptions/', payload);
    return response.data;
};

/** بدء عملية الدفع عبر شام كاش */
export const createPayment = async (payload) => {
    const response = await apiClient.post('/api/payments/', payload);
    return response.data;
};

/** استرداد الفواتير */
export const getInvoices = async () => {
    const response = await apiClient.get('/api/payments/invoices/');
    return response.data;
};
