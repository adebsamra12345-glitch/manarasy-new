// أسماء الألوان العربية المخزّنة في فئات التقييم (انظر COLOR_OPTIONS في وحدة الاختبارات)
const ARABIC_COLOR_HEX = {
    'أزرق': '#2563eb',
    'أخضر': '#16a34a',
    'أحمر': '#dc2626',
    'أصفر': '#ca8a04',
    'برتقالي': '#ea580c',
    'رمادي': '#475569',
};

/** يحوّل color_code المخزّن (اسم عربي أو لون CSS) إلى لون CSS صالح، أو fallback إن لم يوجد. */
export const resolveGradeColor = (code, fallback = '#558b2f') => {
    const value = String(code || '').trim();
    if (!value) return fallback;
    return ARABIC_COLOR_HEX[value] || value;
};
