/**
 * dateHijriGregorian.js
 * أدوات تحويل التواريخ الهجرية والميلادية
 */

/**
 * تحويل تاريخ ميلادي إلى هجري (نص عربي)
 * @param {Date|string} date
 * @returns {string} التاريخ الهجري
 */
export const toHijri = (date = new Date()) => {
    return new Date(date).toLocaleDateString('ar-SA-u-ca-islamic', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
};

/**
 * التاريخ الميلادي بصيغة عربية
 * @param {Date|string} date
 * @returns {string}
 */
export const toGregorianArabic = (date = new Date()) => {
    return new Date(date).toLocaleDateString('ar-SA', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
};

/**
 * إرجاع كلا التاريخين
 * @param {Date|string} date
 * @returns {{ hijri: string, gregorian: string }}
 */
export const getBothDates = (date = new Date()) => ({
    hijri: toHijri(date),
    gregorian: toGregorianArabic(date),
});
