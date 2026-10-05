/**
 * تحقق مسبق (Frontend) من إشعار الدفع قبل الرفع.
 * هذا تحسين لتجربة المستخدم فقط — الباك إند يعيد كل الفحوص ولا يثق بهذه النتيجة.
 */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024; // 5MB (نفس RECEIPT_MAX_BYTES في Django)
export const RECEIPT_ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf';

const EXT_TO_KIND = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', pdf: 'pdf' };

const startsWith = (bytes, sig, offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

/** يحدد النوع من البايتات الأولى للملف (وليس من الامتداد). */
export async function sniffKind(file) {
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpg';
    if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
    const text = new TextDecoder('latin1').decode(head);
    if (text.includes('%PDF-')) return 'pdf';
    return null;
}

/** @returns {Promise<string>} رسالة خطأ بالعربية، أو '' إن كان الملف صالحاً */
export async function validateReceiptFile(file) {
    if (!file) return 'يرجى اختيار ملف الإشعار';
    if (file.size === 0) return 'الملف فارغ';
    if (file.size > RECEIPT_MAX_BYTES) {
        return `حجم الملف (${(file.size / 1048576).toFixed(1)} ميغابايت) يتجاوز الحد الأقصى 5 ميغابايت`;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const expected = EXT_TO_KIND[ext];
    if (!expected) return 'نوع الملف غير مدعوم. الأنواع المسموحة: PNG, JPG, WEBP, PDF';
    const actual = await sniffKind(file);
    if (!actual || actual !== expected) return 'محتوى الملف لا يطابق نوعه أو أنه غير مدعوم';
    return '';
}

export const formatBytes = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
