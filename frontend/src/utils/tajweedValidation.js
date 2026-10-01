/**
 * tajweedValidation.js
 * معايير تقييم التجويد والأخطاء الشائعة
 */

export const TAJWEED_ERROR_TYPES = {
    MADD: 'خطأ في المد',
    GHUNNA: 'خطأ في الغنة',
    IDGHAM: 'خطأ في الإدغام',
    IKHFA: 'خطأ في الإخفاء',
    IQLAB: 'خطأ في الإقلاب',
    QALQALA: 'خطأ في القلقلة',
    WAQF: 'خطأ في الوقف',
    PRONUNCIATION: 'خطأ في النطق',
};

export const GRADE_LEVELS = {
    MUMTAZ: { label: 'ممتاز', minScore: 90, color: '#2e7d32' },
    JAYYID_JIDDAN: { label: 'جيد جداً', minScore: 80, color: '#388e3c' },
    JAYYID: { label: 'جيد', minScore: 70, color: '#f9a825' },
    MAQBUL: { label: 'مقبول', minScore: 60, color: '#ef6c00' },
    RASIB: { label: 'راسب', minScore: 0, color: '#c62828' },
};

/**
 * تحويل الدرجة الرقمية إلى تقدير نصي
 * @param {number} score
 * @returns {{ label: string, color: string }}
 */
export const scoreToGrade = (score) => {
    const entry = Object.values(GRADE_LEVELS).find(g => score >= g.minScore);
    return entry || GRADE_LEVELS.RASIB;
};
