import React, { useState, useEffect, useCallback } from 'react';
import {
    X, ClockCounterClockwise, Trash, UserPlus, UserSwitch,
    MagnifyingGlass, ArrowRight, WarningCircle, CheckCircle, ArrowsClockwise, Prohibit
} from '@phosphor-icons/react';
import {
    getStudentRegistrationRequests,
    getStudentDeletionRequests,
    cancelStudentRegistrationRequest,
    cancelStudentDeletionRequest
} from '../../../services/api/tenantService';

// Status Badge Component
const StatusBadge = ({ status }) => {
    switch (status) {
        case 'APPROVED':
            return <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700' }}>موافق عليه</span>;
        case 'REJECTED':
            return <span style={{ background: '#ffebee', color: '#c62828', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700' }}>مرفوض</span>;
        case 'CANCELLED':
        case 'CANCELLED_BY_TEACHER':
            return <span style={{ background: '#f5f5f5', color: '#616161', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700' }}>ملغى بواسطة المعلم</span>;
        case 'UNDER_REVIEW':
            return <span style={{ background: '#e0f7fa', color: '#00838f', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700' }}>تحت المراجعة</span>;
        case 'PENDING':
        default:
            return <span style={{ background: '#fff8e1', color: '#f57f17', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700' }}>قيد الانتظار</span>;
    }
};

const TeacherRequestsPanel = ({ isOpen, onClose, isMobile = false }) => {
    const [activeTab, setActiveTab] = useState('ADD'); // 'ADD' | 'UPDATE' | 'DELETE'
    const [addRequests, setAddRequests] = useState([]);
    const [updateRequests, setUpdateRequests] = useState([]);
    const [deleteRequests, setDeleteRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState(null);

    // Confirmation Modal State
    const [requestToCancel, setRequestToCancel] = useState(null);
    const [cancelling, setCancelling] = useState(false);

    const fetchAllRequests = useCallback(async () => {
        setLoading(true);
        try {
            const [regRes, delRes] = await Promise.all([
                getStudentRegistrationRequests(),
                getStudentDeletionRequests()
            ]);

            if (regRes?.status === 'success' && regRes.data) {
                const addList = regRes.data.filter(r => r.request_type === 'NEW' || !r.request_type);
                const updateList = regRes.data.filter(r => r.request_type === 'UPDATE');
                setAddRequests(addList);
                setUpdateRequests(updateList);
            } else {
                setAddRequests([]);
                setUpdateRequests([]);
            }

            if (delRes?.status === 'success' && delRes.data) {
                setDeleteRequests(delRes.data || []);
            } else {
                setDeleteRequests([]);
            }
        } catch (err) {
            console.error('Failed to fetch teacher requests:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchAllRequests();
        }
    }, [isOpen, fetchAllRequests]);

    if (!isOpen) return null;

    // Handle Confirm Cancel Request
    const handleConfirmCancel = async () => {
        if (!requestToCancel) return;
        setCancelling(true);
        try {
            let res;
            if (requestToCancel.type === 'DELETE') {
                res = await cancelStudentDeletionRequest(requestToCancel.id);
            } else {
                res = await cancelStudentRegistrationRequest(requestToCancel.id);
            }

            if (res?.status === 'success') {
                setToast({ message: res.message || 'تم التراجع عن الطلب بنجاح', type: 'success' });
                setRequestToCancel(null);
                fetchAllRequests(); // Immediate list refresh
            } else {
                setToast({ message: res?.message || 'تعذر التراجع عن الطلب', type: 'error' });
            }
        } catch (err) {
            console.error('Error cancelling request:', err);
            setToast({ message: err?.response?.data?.message || 'حدث خطأ أثناء التراجع عن الطلب', type: 'error' });
        } finally {
            setCancelling(false);
        }
    };

    // Current tab items filtering
    const getCurrentList = () => {
        let list = [];
        if (activeTab === 'ADD') list = addRequests;
        else if (activeTab === 'UPDATE') list = updateRequests;
        else if (activeTab === 'DELETE') list = deleteRequests;

        if (!searchQuery.trim()) return list;

        const q = searchQuery.toLowerCase();
        return list.filter(r =>
            (r.full_name || r.student_name || '').toLowerCase().includes(q) ||
            (r.parent_name || '').toLowerCase().includes(q) ||
            (r.reason || '').toLowerCase().includes(q) ||
            (r.halaqa_name || '').toLowerCase().includes(q)
        );
    };

    const currentList = getCurrentList();

    const isCancelAllowed = (status) => {
        return status === 'PENDING' || status === 'UNDER_REVIEW';
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000,
            display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(3px)'
        }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                width: isMobile ? '100%' : '520px',
                maxWidth: '100vw', height: '100vh',
                background: '#f8fafc', boxShadow: '-4px 0 30px rgba(0,0,0,0.2)',
                display: 'flex', flexDirection: 'column', direction: 'rtl',
                fontFamily: 'Tajawal, sans-serif'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.2rem 1.5rem', background: 'linear-gradient(135deg, #1b382b 0%, #2e5944 100%)',
                    color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                        {isMobile && (
                            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ArrowRight size={18} color="#fff" />
                            </button>
                        )}
                        <ClockCounterClockwise size={24} color="#34d399" weight="fill" />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700' }}>إدارة الطلبات</h2>
                            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>متابعة طلبات الإضافة، التعديل، والحذف</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button onClick={fetchAllRequests} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: '#fff', padding: '0.35rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <ArrowsClockwise size={14} className={loading ? 'spin-icon' : ''} />
                            <span>تحديث</span>
                        </button>
                        {!isMobile && (
                            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={18} color="#fff" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs Row */}
                <div style={{
                    background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.5rem 1rem',
                    display: 'flex', gap: '0.5rem', overflowX: 'auto'
                }}>
                    <button
                        onClick={() => setActiveTab('ADD')}
                        style={{
                            flex: 1, padding: '0.65rem 0.8rem', borderRadius: '10px', border: 'none',
                            background: activeTab === 'ADD' ? '#e6f4ea' : 'transparent',
                            color: activeTab === 'ADD' ? '#1b382b' : '#64748b',
                            fontWeight: activeTab === 'ADD' ? '700' : '500',
                            fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            transition: 'all 0.2s ease', whiteSpace: 'nowrap'
                        }}
                    >
                        <UserPlus size={18} color={activeTab === 'ADD' ? '#2e7d32' : '#64748b'} />
                        <span>طلبات الإضافة ({addRequests.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('UPDATE')}
                        style={{
                            flex: 1, padding: '0.65rem 0.8rem', borderRadius: '10px', border: 'none',
                            background: activeTab === 'UPDATE' ? '#e3f2fd' : 'transparent',
                            color: activeTab === 'UPDATE' ? '#1565c0' : '#64748b',
                            fontWeight: activeTab === 'UPDATE' ? '700' : '500',
                            fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            transition: 'all 0.2s ease', whiteSpace: 'nowrap'
                        }}
                    >
                        <UserSwitch size={18} color={activeTab === 'UPDATE' ? '#1565c0' : '#64748b'} />
                        <span>طلبات التعديل ({updateRequests.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('DELETE')}
                        style={{
                            flex: 1, padding: '0.65rem 0.8rem', borderRadius: '10px', border: 'none',
                            background: activeTab === 'DELETE' ? '#ffebee' : 'transparent',
                            color: activeTab === 'DELETE' ? '#c62828' : '#64748b',
                            fontWeight: activeTab === 'DELETE' ? '700' : '500',
                            fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            transition: 'all 0.2s ease', whiteSpace: 'nowrap'
                        }}
                    >
                        <Trash size={18} color={activeTab === 'DELETE' ? '#c62828' : '#64748b'} />
                        <span>طلبات الحذف ({deleteRequests.length})</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div style={{ padding: '0.8rem 1rem', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9',
                        padding: '0.5rem 0.8rem', borderRadius: '10px'
                    }}>
                        <MagnifyingGlass size={16} color="#94a3b8" />
                        <input
                            type="text"
                            placeholder="بحث باسم الطالب..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                border: 'none', background: 'transparent', outline: 'none',
                                flex: 1, fontSize: '0.85rem', fontFamily: 'inherit'
                            }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Body Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <ArrowsClockwise size={32} className="spin-icon" color="#2e5944" />
                            <span>جاري تحميل الطلبات...</span>
                        </div>
                    ) : currentList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
                            <ClockCounterClockwise size={48} color="#cbd5e1" style={{ marginBottom: '0.8rem' }} />
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>
                                {searchQuery ? 'لا توجد نتائج تطابق البحث' : 'لا توجد طلبات في هذا التبويب'}
                            </p>
                        </div>
                    ) : (
                        currentList.map(req => {
                            const studentName = req.full_name || req.student_name || 'طالب';
                            const createdDate = req.created_at ? new Date(req.created_at).toLocaleDateString('ar-SA') : '—';
                            const canCancel = isCancelAllowed(req.status);

                            return (
                                <div key={req.id} style={{
                                    background: '#fff', borderRadius: '14px', padding: '1.1rem',
                                    marginBottom: '0.9rem', border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)', transition: 'all 0.2s ease'
                                }}>
                                    {/* Header Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                                        <div>
                                            <strong style={{ color: '#0f172a', fontSize: '1rem', display: 'block', marginBottom: '0.2rem' }}>
                                                {studentName}
                                            </strong>
                                            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                                تاريخ الطلب: {createdDate}
                                            </span>
                                        </div>
                                        <StatusBadge status={req.status} />
                                    </div>

                                    {/* Details Grid */}
                                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem', fontSize: '0.82rem', color: '#334155', margin: '0.5rem 0', lineHeight: 1.6 }}>
                                        {activeTab === 'ADD' && (
                                            <>
                                                {req.halaqa_name && <div><strong>الحلقة:</strong> {req.halaqa_name}</div>}
                                                {req.parent_name && <div><strong>ولي الأمر:</strong> {req.parent_name} {req.parent_phone ? `(${req.parent_phone})` : ''}</div>}
                                                {req.national_id && <div><strong>الرقم القومي:</strong> {req.national_id}</div>}
                                                {req.general_notes && <div><strong>ملاحظات:</strong> {req.general_notes}</div>}
                                            </>
                                        )}
                                        {activeTab === 'UPDATE' && (
                                            <>
                                                <div><strong>نوع الطلب:</strong> تعديل بيانات طالب</div>
                                                {req.parent_name && <div><strong>ولي الأمر:</strong> {req.parent_name}</div>}
                                                {req.parent_phone && <div><strong>هاتف ولي الأمر:</strong> {req.parent_phone}</div>}
                                                {req.general_notes && <div><strong>تفاصيل التعديل:</strong> {req.general_notes}</div>}
                                            </>
                                        )}
                                        {activeTab === 'DELETE' && (
                                            <>
                                                <div><strong>سبب طلب الحذف:</strong> {req.reason || 'لم يذكر سبب'}</div>
                                                {req.reviewed_by_name && <div><strong>المراجع:</strong> {req.reviewed_by_name}</div>}
                                            </>
                                        )}
                                        {req.rejection_reason && (
                                            <div style={{ marginTop: '0.4rem', color: '#c62828', fontWeight: '600' }}>
                                                سبب الرفض: {req.rejection_reason}
                                            </div>
                                        )}
                                    </div>

                                    {/* Cancel Action Footer */}
                                    {canCancel && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.8rem', paddingTop: '0.6rem', borderTop: '1px dashed #e2e8f0' }}>
                                            <button
                                                onClick={() => setRequestToCancel({ id: req.id, type: activeTab, name: studentName })}
                                                style={{
                                                    background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3',
                                                    borderRadius: '8px', padding: '0.45rem 0.9rem', fontSize: '0.8rem',
                                                    fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <Prohibit size={15} color="#e11d48" />
                                                <span>التراجع عن الطلب</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Confirmation Modal (نافذة التأكيد) */}
            {requestToCancel && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', width: '420px', maxWidth: '95vw',
                        padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', direction: 'rtl',
                        animation: 'popIn 0.2s ease'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
                            <div style={{ background: '#ffebee', padding: '0.6rem', borderRadius: '50%', display: 'flex' }}>
                                <WarningCircle size={28} color="#c62828" weight="fill" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1a1a1a', fontWeight: '700' }}>
                                تأكيد إلغاء الطلب
                            </h3>
                        </div>

                        <p style={{ color: '#4b5563', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                            هل أنت متأكد من رغبتك في التراجع عن هذا الطلب؟
                            {requestToCancel.name && (
                                <span style={{ display: 'block', marginTop: '0.4rem', fontWeight: '700', color: '#1b382b' }}>
                                    (الطلب الخاص بالطالب: {requestToCancel.name})
                                </span>
                            )}
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setRequestToCancel(null)}
                                disabled={cancelling}
                                style={{
                                    padding: '0.6rem 1.2rem', borderRadius: '10px', border: '1px solid #cbd5e1',
                                    background: '#f8fafc', color: '#475569', fontWeight: '600', fontSize: '0.88rem',
                                    cursor: 'pointer'
                                }}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleConfirmCancel}
                                disabled={cancelling}
                                style={{
                                    padding: '0.6rem 1.4rem', borderRadius: '10px', border: 'none',
                                    background: '#c62828', color: '#fff', fontWeight: '700', fontSize: '0.88rem',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
                                }}
                            >
                                {cancelling ? <ArrowsClockwise size={16} className="spin-icon" /> : null}
                                <span>تأكيد</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                    background: toast.type === 'success' ? '#1b382b' : '#c62828', color: '#fff',
                    padding: '0.75rem 1.5rem', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    zIndex: 10000, display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem',
                    fontWeight: '600'
                }}>
                    {toast.type === 'success' ? <CheckCircle size={20} color="#34d399" weight="fill" /> : <WarningCircle size={20} color="#fff" weight="fill" />}
                    <span>{toast.message}</span>
                </div>
            )}

            <style>{`
                @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .spin-icon { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default TeacherRequestsPanel;
