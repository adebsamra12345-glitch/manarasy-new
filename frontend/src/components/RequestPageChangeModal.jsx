import React, { useState, useEffect } from 'react';
import { X, BookmarkSimple, PencilSimple, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { submitStudentRegistrationRequest } from '../services/api/tenantService';
import { useAuthContext } from '../context/AuthContext';

/**
 * RequestPageChangeModal
 * يسمح للمعلم بتقديم طلب تعديل صفحة الوصول لطالب معين من داخل الجلسة (موبايل وحاسوب)
 */
const RequestPageChangeModal = ({ isOpen, onClose, student, ringId, onSuccess }) => {
    const { user } = useAuthContext();
    const [newPage, setNewPage] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen && student) {
            setNewPage(student.reached_page || 1);
            setReason('');
            setError('');
            setSuccessMsg('');
            setSubmitting(false);
        }
    }, [isOpen, student]);

    if (!isOpen || !student) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const pageNum = parseInt(newPage, 10);
        if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) {
            setError('رقم صفحة الوصول يجب أن يكون بين 1 و 604.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                request_type: 'UPDATE',
                student_id: student.student_id,
                full_name: student.student_name,
                reached_page: pageNum,
                halaqa_id: ringId,
                general_notes: reason.trim() || 'طلب تعديل صفحة الوصول من داخل جلسة التسميع',
                user_profile_id: user?.id
            };

            const res = await submitStudentRegistrationRequest(payload);
            if (res.status === 'success') {
                setSuccessMsg('تم إرسال طلب تعديل صفحة الوصول للإدارة بنجاح.');
                if (onSuccess) onSuccess(pageNum);
                setTimeout(() => {
                    onClose();
                }, 1400);
            } else {
                setError(res.message || 'حدث خطأ أثناء إرسال الطلب.');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'حدث خطأ أثناء الاتصال بالخادم.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            direction: 'rtl',
            backdropFilter: 'blur(3px)'
        }}>
            <div style={{
                background: '#fff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '440px',
                padding: '1.5rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                position: 'relative',
                animation: 'fadeIn 0.2s ease-out'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: '#e8f5e9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#2e7d32'
                        }}>
                            <BookmarkSimple size={22} weight="fill" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#133315', fontWeight: 'bold' }}>
                                طلب تعديل صفحة الوصول
                            </h3>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                الطالب: <strong style={{ color: '#133315' }}>{student.student_name}</strong>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        style={{
                            background: '#f5f5f5',
                            border: 'none',
                            padding: '0.4rem',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex'
                        }}
                    >
                        <X size={18} color="#666" />
                    </button>
                </div>

                {error && (
                    <div style={{
                        background: '#ffebee',
                        color: '#c62828',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}>
                        <WarningCircle size={18} />
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div style={{
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontWeight: 'bold'
                    }}>
                        <CheckCircle size={18} />
                        {successMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Current Page Display */}
                    <div style={{
                        background: '#f9fbe7',
                        border: '1px solid #dce775',
                        borderRadius: '10px',
                        padding: '0.65rem 0.85rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontSize: '0.85rem', color: '#558b2f', fontWeight: 'bold' }}>
                            صفحة الوصول الحالية:
                        </span>
                        <span style={{
                            background: '#558b2f',
                            color: '#fff',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            fontSize: '0.9rem'
                        }}>
                            {student.reached_page || 1}
                        </span>
                    </div>

                    {/* New Page Input */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#333', marginBottom: '0.4rem' }}>
                            رقم صفحة الوصول الجديدة المطلوبة: <span style={{ color: '#d32f2f' }}>*</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="604"
                            required
                            value={newPage}
                            onChange={(e) => setNewPage(e.target.value)}
                            placeholder="مثال: 45"
                            style={{
                                width: '100%',
                                padding: '0.6rem 0.75rem',
                                borderRadius: '8px',
                                border: '1.5px solid #81b255',
                                outline: 'none',
                                fontSize: '0.95rem',
                                fontWeight: 'bold',
                                color: '#133315',
                                boxSizing: 'border-box'
                            }}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#777', marginTop: '0.25rem', display: 'block' }}>
                            أدخل رقماً من 1 إلى 604 بحسب صفحات المصحف الشريف.
                        </span>
                    </div>

                    {/* Reason Textarea */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#333', marginBottom: '0.4rem' }}>
                            سبب التعديل أو ملاحظات للإدارة:
                        </label>
                        <textarea
                            rows="3"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="اكتب توضيحاً للإدارة (مثال: تم اختبار الطالب واجتياز الأجزاء السابقة بنجاح...)"
                            style={{
                                width: '100%',
                                padding: '0.6rem 0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #ccc',
                                outline: 'none',
                                fontSize: '0.85rem',
                                fontFamily: 'inherit',
                                resize: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            style={{
                                background: '#f5f5f5',
                                border: '1px solid #ddd',
                                padding: '0.55rem 1.1rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                color: '#555'
                            }}
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || successMsg}
                            style={{
                                background: '#558b2f',
                                color: '#fff',
                                border: 'none',
                                padding: '0.55rem 1.25rem',
                                borderRadius: '8px',
                                cursor: submitting ? 'wait' : 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                opacity: submitting ? 0.7 : 1
                            }}
                        >
                            <PencilSimple size={16} />
                            {submitting ? 'جاري الإرسال...' : 'إرسال طلب التعديل'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RequestPageChangeModal;
