const GRADE_COLOR_HEX = {
    'أزرق': '#2563eb',
    'أخضر': '#16a34a',
    'أحمر': '#dc2626',
    'أصفر': '#ca8a04',
    'برتقالي': '#ea580c',
    'رمادي': '#475569',
};

/**
 * يحوّل color_code المخزّن (اسم لون عربي أو قيمة CSS) إلى لون صالح للعرض.
 */
export const resolveGradeColor = (colorCode, fallback = '#558b2f') => {
    const value = String(colorCode || '').trim();
    if (!value) return fallback;
    return GRADE_COLOR_HEX[value] || value;
};
