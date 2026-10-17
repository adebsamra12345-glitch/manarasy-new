/**
 * Juz Amma Surahs (78 to 114) with Mushaf standard page numbers.
 */
export const JUZ_AMMA_SURAHS = [
    { number: 78, name: 'النبأ', page: 582 },
    { number: 79, name: 'النازعات', page: 583 },
    { number: 80, name: 'عبس', page: 585 },
    { number: 81, name: 'التكوير', page: 586 },
    { number: 82, name: 'الانفطار', page: 587 },
    { number: 83, name: 'المطففين', page: 587 },
    { number: 84, name: 'الانشقاق', page: 589 },
    { number: 85, name: 'البروج', page: 590 },
    { number: 86, name: 'الطارق', page: 591 },
    { number: 87, name: 'الأعلى', page: 591 },
    { number: 88, name: 'الغاشية', page: 592 },
    { number: 89, name: 'الفجر', page: 593 },
    { number: 90, name: 'البلد', page: 594 },
    { number: 91, name: 'الشمس', page: 595 },
    { number: 92, name: 'الليل', page: 595 },
    { number: 93, name: 'الضحى', page: 596 },
    { number: 94, name: 'الشرح', page: 596 },
    { number: 95, name: 'التين', page: 597 },
    { number: 96, name: 'العلق', page: 597 },
    { number: 97, name: 'القدر', page: 598 },
    { number: 98, name: 'البينة', page: 598 },
    { number: 99, name: 'الزلزلة', page: 599 },
    { number: 100, name: 'العاديات', page: 599 },
    { number: 101, name: 'القارعة', page: 600 },
    { number: 102, name: 'التكاثر', page: 600 },
    { number: 103, name: 'العصر', page: 601 },
    { number: 104, name: 'الهمزة', page: 601 },
    { number: 105, name: 'الفيل', page: 601 },
    { number: 106, name: 'قريش', page: 602 },
    { number: 107, name: 'الماعون', page: 602 },
    { number: 108, name: 'الكوثر', page: 602 },
    { number: 109, name: 'الكافرون', page: 603 },
    { number: 110, name: 'النصر', page: 603 },
    { number: 111, name: 'المسد', page: 603 },
    { number: 112, name: 'الإخلاص', page: 604 },
    { number: 113, name: 'الفلق', page: 604 },
    { number: 114, name: 'الناس', page: 604 },
];

export const getSurahByNumber = (num) => JUZ_AMMA_SURAHS.find(s => s.number === Number(num));

export const getSurahName = (num) => {
    if (!num) return '';
    const s = getSurahByNumber(num);
    return s ? `سورة ${s.name}` : `سورة ${num}`;
};
