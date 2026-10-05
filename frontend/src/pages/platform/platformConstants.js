export const STATUS_META = {
    PENDING_PAYMENT: { label: 'بانتظار إيصال الدفع', tone: 'gray' },
    PENDING_APPROVAL: { label: 'بانتظار الموافقة', tone: 'amber' },
    PROVISIONING: { label: 'جارٍ التجهيز', tone: 'blue' },
    APPROVED: { label: 'مقبول', tone: 'green' },
    REJECTED: { label: 'مرفوض', tone: 'red' },
    PROVISIONING_FAILED: { label: 'فشل التجهيز', tone: 'red' },
};

export const SOURCE_LABEL = { SELF_SERVICE: 'تسجيل ذاتي', ADMIN_CREATED: 'أضافه الأدمن' };

export const EVENT_LABEL = {
    created: 'أُنشئ الطلب',
    receipt_uploaded: 'رُفع إيصال',
    approved: 'وُوفق على الطلب',
    provisioning_retry: 'إعادة محاولة التجهيز',
    provisioned: 'اكتمل تجهيز المسجد',
    provisioning_failed: 'فشل التجهيز',
    rejected: 'رُفض الطلب',
    created_by_admin: 'أُضيف يدوياً من الأدمن',
    payment_reference: 'رقم عملية الدفع',
};

export const FILTERS = [
    { key: 'PENDING_APPROVAL', label: 'بانتظار الموافقة' },
    { key: 'PENDING_PAYMENT', label: 'بانتظار الدفع' },
    { key: 'PROVISIONING,PROVISIONING_FAILED', label: 'التجهيز' },
    { key: 'APPROVED', label: 'المقبولة' },
    { key: 'REJECTED', label: 'المرفوضة' },
    { key: '', label: 'الكل' },
];

export const fmtDate = (iso) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('ar-SY', { dateStyle: 'medium', timeStyle: 'short' });
    } catch { return iso; }
};
