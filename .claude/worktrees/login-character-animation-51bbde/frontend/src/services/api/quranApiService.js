import apiClient from './apiClient';

export const getSurahList = async () => {
    const response = await apiClient.get('/api/quran/surahs/');
    return response.data;
};

export const getAyahs = async (surahNumber) => {
    const response = await apiClient.get('/api/quran/surahs/' + surahNumber + '/ayahs/');
    return response.data;
};

export const searchQuran = async (query) => {
    const response = await apiClient.get('/api/quran/search/', { params: { q: query } });
    return response.data;
};
