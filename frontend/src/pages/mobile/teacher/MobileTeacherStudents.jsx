import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MagnifyingGlass, Trash, X, CheckCircle, WarningCircle,
    ClockCounterClockwise, PhoneCall, Star, CaretDown, ArrowLeft,
    PencilSimple, TrendUp
} from '@phosphor-icons/react';
import { getHalaqat, getStudentsByRing } from '../../../services/api/tenantService';
import { submitStudentDeletionRequest, getStudentDeletionRequests } from '../../../services/api/tenantService';
import AddStudentWizard from '../../desktop/teacher/AddStudentWizard';
import TeacherRequestsPanel from '../../desktop/teacher/TeacherRequestsPanel';

const Toast = ({ message, type, onClose }) => {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
    const bg = type === 'success' ? '#2e7d32' : '#c62828';
    const Icon = type === 'success' ? CheckCircle : WarningCircle;
    return (
        <div style={{
            position: 'fixed', bottom: '5rem', left: '1rem', right: '1rem',
            background: bg, color: '#fff', padding: '0.9rem 1.2rem', borderRadius: '14px',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 9999,
            animation: 'toastUp 0.3s ease', direction: 'rtl'
        }}>
            <Icon size={20} weight="fill" />
            <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: '500' }}>{message}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                <X size={16} />
            </button>
            <style>{'@keyframes toastUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}'}</style>
        </div>
    );
};

const DeletionBottomSheet = ({ student, onConfirm, onCancel, loading }) => {
    const [reason, setReason] = useState('');
    return (
        <>
            <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 8000, backdropFilter: 'blur(3px)' }} />
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 8001,
                background: '#fff', borderRadius: '24px 24px 0 0',
                padding: '1.5rem 1.2rem 2rem',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
                direction: 'rtl', animation: 'sheetUp 0.3s ease'
            }}>
                <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 99, margin: '0 auto 1.2rem' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                    <div style={{ background: '#ffebee', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Trash size={22} color="#c62828" weight="fill" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1a1a1a' }}>طلب حذف الطالب</h3>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>سيراجع الطلب من قبل الادارة</p>
                    </div>
                </div>
                <div style={{ background: '#fff8e1', borderRadius: '12px', padding: '0.8rem 1rem', marginBottom: '1rem', border: '1px solid #ffe082' }}>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#5d4037', lineHeight: 1.6 }}>
                        هل تريد تقديم طلب حذف الطالب{' '}
                        <strong style={{ color: '#c62828' }}>"{student?.full_name}"</strong>؟
                    </p>
                </div>
                <label style={{ display: 'block', fontSize: '0.88rem', color: '#444', fontWeight: '600', marginBottom: '0.4rem' }}>
                    سبب الحذف <span style={{ color: '#999', fontWeight: 'normal' }}>(اختياري)</span>
                </label>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="اكتب سبب الحذف..."
                    rows={3}
                    maxLength={500}
                    style={{
                        width: '100%', padding: '0.75rem', borderRadius: '10px',
                        border: '1.5px solid #e0e0e0', fontFamily: 'inherit',
                        resize: 'none', outline: 'none', fontSize: '0.88rem',
                        boxSizing: 'border-box', marginBottom: '0.2rem', color: '#333'
                    }}
                    onFocus={e => e.target.style.borderColor = '#c62828'}
                    onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                />
                <small style={{ color: '#bbb', fontSize: '0.75rem' }}>{reason.length}/500</small>
                <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem' }}>
                    <button onClick={onCancel} disabled={loading} style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: '1.5px solid #ddd', background: '#fff', color: '#555', fontWeight: '600', fontSize: '0.9rem', fontFamily: 'inherit', cursor: 'pointer' }}>الغاء</button>
                    <button onClick={() => onConfirm(reason)} disabled={loading} style={{ flex: 2, padding: '0.85rem', borderRadius: '12px', border: 'none', background: loading ? '#ef9a9a' : '#c62828', color: '#fff', fontWeight: '700', fontSize: '0.9rem', fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                        {loading ? 'جاري...' : <><Trash size={16} weight="fill" />تاكيد الطلب</>}
                    </button>
                </div>
            </div>
            <style>{'@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}'}</style>
        </>
    );
};

const StatusBadge = ({ status }) => {
    const map = { PENDING: { bg: '#fff8e1', color: '#f57c00', label: 'قيد الانتظار' }, APPROVED: { bg: '#e8f5e9', color: '#2e7d32', label: 'مقبول' }, REJECTED: { bg: '#ffebee', color: '#c62828', label: 'مرفوض' } };
    const s = map[status] || map.PENDING;
    return <span style={{ background: s.bg, color: s.color, padding: '0.15rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700' }}>{s.label}</span>;
};

const MobileTeacherStudents = () => {
    const navigate = useNavigate();
    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState('all');
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [confirmStudent, setConfirmStudent] = useState(null);
    const [deletionLoading, setDeletionLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [showRequestsView, setShowRequestsView] = useState(false);
    const [deletionRequests, setDeletionRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);

    useEffect(() => { getHalaqat().then(res => { if (res.status === 'success') setRings(res.data || []); }).catch(console.error); }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try { const res = await getStudentsByRing(selectedRingId); if (res.status === 'success') setStudents(res.data || []); } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { fetchStudents(); }, [selectedRingId]);

    const fetchDeletionRequests = async () => {
        setRequestsLoading(true);
        try { const res = await getStudentDeletionRequests(); if (res.status === 'success') setDeletionRequests(res.data || []); } catch (e) { console.error(e); } finally { setRequestsLoading(false); }
    };

    const handleDeletionRequest = async (reason) => {
        if (!confirmStudent) return;
        setDeletionLoading(true);
        try {
            const res = await submitStudentDeletionRequest({ student_id: confirmStudent.id, reason: reason || undefined });
            if (res.status === 'success') { setToast({ message: res.message, type: 'success' }); setConfirmStudent(null); }
            else { setToast({ message: res.message || 'حدث خطأ', type: 'error' }); }
        } catch (err) { setToast({ message: err?.response?.data?.message || 'حدث خطا اثناء الارسال', type: 'error' }); } finally { setDeletionLoading(false); }
    };

    const filtered = students.filter(s => s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

    if (showRequestsView) {
        return (
            <TeacherRequestsPanel
                isOpen={showRequestsView}
                onClose={() => setShowRequestsView(false)}
                isMobile={true}
            />
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f8f8f8', direction: 'rtl', paddingBottom: '5rem' }}>
            <div style={{ background: '#fff', padding: '1rem', borderBottom: '1px solid #eee', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#1a3b1c', fontWeight: '700' }}>الطلاب</h1>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ background: '#f4a261', color: '#fff', padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700' }}>{students.length}</span>
                        <button id="btn-mobile-deletion-requests" onClick={() => { setShowRequestsView(true); fetchDeletionRequests(); }} style={{ background: '#ffebee', border: 'none', borderRadius: '10px', padding: '0.5rem 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <ClockCounterClockwise size={18} color="#c62828" />
                            <span style={{ fontSize: '0.78rem', color: '#c62828', fontWeight: '600' }}>الطلبات</span>
                        </button>
                    </div>
                </div>
                <div style={{ position: 'relative', marginBottom: '0.7rem' }}>
                    <input type="text" placeholder="ابحث عن طالب..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.7rem 2.5rem 0.7rem 0.9rem', border: '1.5px solid #e8e8e8', borderRadius: '10px', outline: 'none', fontFamily: 'inherit', fontSize: '0.88rem', background: '#fafafa', boxSizing: 'border-box', color: '#333' }} />
                    <MagnifyingGlass size={16} color="#aaa" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                </div>
                <div style={{ position: 'relative' }}>
                    <select value={selectedRingId} onChange={e => setSelectedRingId(e.target.value)} style={{ width: '100%', padding: '0.6rem 2rem 0.6rem 0.9rem', border: '1.5px solid #e8e8e8', borderRadius: '10px', appearance: 'none', background: '#fafafa', fontFamily: 'inherit', fontSize: '0.85rem', color: '#444', outline: 'none' }}>
                        <option value="all">كل الحلقات</option>
                        {rings.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <CaretDown size={14} color="#aaa" style={{ position: 'absolute', top: '50%', left: '0.7rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
            </div>

            <div style={{ padding: '0.8rem' }}>
                {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: '#558b2f' }}>جاري التحميل...</div>
                : filtered.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem', color: '#bbb' }}>لا يوجد طلاب</div>
                : filtered.map(student => (
                    <div key={student.id} style={{ background: '#fff', borderRadius: '16px', marginBottom: '0.9rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(135deg, #558b2f 0%, #33691e 100%)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: '700' }}>{student.full_name}</h3>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                                    <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '20px', fontSize: '0.72rem' }}>{student.gender === 'F' ? 'انثى' : 'ذكر'}</span>
                                    <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '20px', fontSize: '0.72rem' }}>صفحة {student.reached_page}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#fff' }}>
                                <Star size={14} weight="fill" /><span style={{ fontSize: '0.8rem' }}>{student.points || 0}</span>
                            </div>
                        </div>
                        <div style={{ padding: '0.8rem 1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#555', marginBottom: '0.8rem' }}>
                                <div><span style={{ color: '#999' }}>اسم الاب: </span>{student.parent_name || '-'}</div>
                                <div><span style={{ color: '#999' }}>هاتف الاب: </span>{student.parent_phone || '-'}</div>
                                <div><span style={{ color: '#999' }}>هاتف الام: </span>{student.mother_phone || '-'}</div>
                                <div><span style={{ color: '#999' }}>رقم الوثيقة: </span>{student.national_id || '-'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid #f5f5f5', paddingTop: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <a
                                    href={student.parent_phone ? `tel:${student.parent_phone}` : undefined}
                                    onClick={(e) => {
                                        if (!student.parent_phone) {
                                            e.preventDefault();
                                            setToast({ message: 'لا يوجد رقم هاتف مسجل لولي الأمر', type: 'error' });
                                        }
                                    }}
                                    title="الاتصال بولي الأمر"
                                    style={{
                                        background: '#f1f8e9',
                                        border: 'none',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        color: '#558b2f',
                                        padding: '0.55rem 0.65rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textDecoration: 'none'
                                    }}
                                >
                                    <PhoneCall size={18} />
                                </a>
                                <button
                                    id={`btn-mobile-edit-student-${student.id}`}
                                    onClick={() => { setStudentToEdit(student); setIsWizardOpen(true); }}
                                    style={{
                                        flex: 1,
                                        minWidth: '70px',
                                        padding: '0.55rem 0.5rem',
                                        borderRadius: '10px',
                                        border: '1.5px solid #558b2f',
                                        background: '#f1f8e9',
                                        color: '#33691e',
                                        fontWeight: '700',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.25rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <PencilSimple size={14} weight="bold" />
                                    طلب تعديل
                                </button>
                                <button
                                    id={`btn-mobile-request-deletion-${student.id}`}
                                    onClick={() => setConfirmStudent(student)}
                                    style={{
                                        flex: 1,
                                        minWidth: '70px',
                                        padding: '0.55rem 0.5rem',
                                        borderRadius: '10px',
                                        border: '1.5px solid #c62828',
                                        background: '#fff',
                                        color: '#c62828',
                                        fontWeight: '700',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.25rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <Trash size={14} weight="bold" />
                                    طلب حذف
                                </button>
                                <button
                                    id={`btn-mobile-student-activity-${student.id}`}
                                    onClick={() => navigate(`/teacher/students/${student.id}/activity`)}
                                    style={{
                                        flex: 1.1,
                                        minWidth: '80px',
                                        padding: '0.55rem 0.6rem',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: '#e65100',
                                        color: '#fff',
                                        fontWeight: '700',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.25rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <TrendUp size={14} weight="bold" />
                                    نشاط الطالب
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {confirmStudent && <DeletionBottomSheet student={confirmStudent} loading={deletionLoading} onConfirm={handleDeletionRequest} onCancel={() => setConfirmStudent(null)} />}
            <AddStudentWizard
                isOpen={isWizardOpen}
                onClose={() => { setIsWizardOpen(false); setStudentToEdit(null); }}
                onComplete={() => {
                    fetchStudents();
                    setToast({ message: 'تم إرسال طلب تعديل بيانات الطالب بنجاح بانتظار موافقة الإدارة.', type: 'success' });
                }}
                studentToEdit={studentToEdit}
            />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default MobileTeacherStudents;
