import apiClient from '../api/apiClient';

/**
 * رفع ملف إلى S3 عبر presigned URL
 * @param {File} file — الملف المراد رفعه
 * @param {string} folder — المجلد المستهدف (مثال: 'audio', 'documents')
 */
export const uploadFileToS3 = async (file, folder = 'uploads') => {
    // الخطوة 1: الحصول على presigned URL من الخادم
    const { data } = await apiClient.post('/api/storage/presigned-url/', {
        filename: file.name,
        content_type: file.type,
        folder,
    });

    // الخطوة 2: رفع الملف مباشرة إلى S3
    await fetch(data.presigned_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
    });

    return data.file_url;
};
