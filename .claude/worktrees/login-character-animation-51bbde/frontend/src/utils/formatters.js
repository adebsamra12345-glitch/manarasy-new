/**
 * formatters.js
 * دوال تنسيق الأرقام والعملات والنصوص
 */

/**
 * تنسيق الرقم بالأرقام العربية
 * @param {number} num
 * @returns {string}
 */
export const toArabicNumerals = (num) => {
    return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
};

/**
 * تنسيق العملة (الدولار)
 * @param {number} amount
 * @returns {string}
 */
export const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency }).format(amount);
};

/**
 * تقصير النص إلى حد معيّن
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export const truncateText = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
};

/**
 * تنسيق الوقت (HH:MM)
 * @param {string|Date} dateTime
 * @returns {string}
 */
export const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};
