import React, { useState, useEffect } from 'react';
import { X, BookOpen, User, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { evaluateRecitation } from '../../../services/api/tenantService';

const RecitationModal = ({ isOpen, onClose, student, evaluationTemplate, onEvaluationSuccess }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    useEffect(() => {
        if (isOpen && student) {
            setCurrentPage((student.reached_page || 1) + 1);
            setNotes('');
            setError(null);
            setSuccessMessage(null);
        }
    }, [isOpen, student]);

    if (!isOpen || !student) return null;

    const handleGradeSelect = async (grade) => {
        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const payload = {
                attendance_id: student.attendance_id,
                student_id: student.student_id,
                page_number: currentPage,
                evaluation_grade_id: grade.id,
                grade: grade.name,
                notes: notes,
                recitation_type: 'NEW_MEMORIZATION'
            };

            const response = await evaluateRecitation(payload);
            
            if (response.status === 'success') {
                const data = response.data;
                setSuccessMessage(response.message);
                setNotes('');
                
                // Notify parent component about the updated reached_page
                if (onEvaluationSuccess) {
                    onEvaluationSuccess(student.attendance_id, data.reached_page);
                }

                if (data.can_recite_next) {
                    // Automatically move to the next page
                    setCurrentPage(data.next_page);
                }
                // If cannot recite next (requires repeat), the modal stays open on the same page
                // The user can close it manually
            } else {
                setError(response.message || 'حدث خطأ أثناء التقييم');
            }
        } catch (err) {
            console.error(err);
            setError('حدث خطأ في الاتصال بالخادم');
        } finally {
            setSubmitting(false);
        }
    };

    const grades = evaluationTemplate?.grades || [];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
            direction: 'rtl'
        }}>
            <div style={{
                background: '#fff',
                width: '100%',
                maxWidth: '500px',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                position: 'relative'
            }}>
                <button 
                    onClick={onClose}
                    style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    <X size={24} color="#888" />
                </button>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                        <div style={{ background: '#f1f8e9', padding: '1rem', borderRadius: '50%' }}>
                            <BookOpen size={40} color="#558b2f" />
                        </div>
                    </div>
                    <h2 style={{ color: '#133315', fontSize: '1.5rem', marginBottom: '0.5rem' }}>إضافة تقييم تسميع</h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#666' }}>
                        <User size={18} />
                        <span style={{ fontWeight: 'bold' }}>{student.student_name}</span>
                    </div>
                </div>

                {error && (
                    <div style={{ background: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <WarningCircle size={20} />
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={20} />
                        {successMessage}
                    </div>
                )}

                <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <p style={{ color: '#888', marginBottom: '0.5rem' }}>رقم الصفحة الحالية المراد تسميعها</p>
                    <div style={{ 
                        fontSize: '3rem', 
                        fontWeight: 'bold', 
                        color: '#f57c00',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1rem'
                    }}>
                        <span>{currentPage}</span>
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <input 
                        type="text" 
                        placeholder="ملاحظات حول التسميع (اختياري)..." 
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '0.8rem',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            outline: 'none',
                            fontFamily: 'inherit'
                        }}
                    />
                </div>

                <div>
                    <p style={{ color: '#666', marginBottom: '1rem', fontWeight: 'bold' }}>تقييم الأداء:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {grades.length > 0 ? grades.map(grade => (
                            <button
                                key={grade.id}
                                onClick={() => handleGradeSelect(grade)}
                                disabled={submitting}
                                style={{
                                    backgroundColor: grade.color_code || '#558b2f',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    fontSize: '1rem',
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.7 : 1,
                                    transition: 'transform 0.1s'
                                }}
                                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {grade.name}
                            </button>
                        )) : (
                            <p style={{ color: '#c62828', gridColumn: '1 / -1', textAlign: 'center' }}>
                                نموذج التقييم غير متوفر لهذه الحلقة.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecitationModal;
