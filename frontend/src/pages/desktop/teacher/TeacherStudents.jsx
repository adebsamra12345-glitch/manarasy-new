import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretDown, Users, Bell, MagnifyingGlass, Star, PhoneCall, Trash, X, CheckCircle, WarningCircle, ClockCounterClockwise } from '@phosphor-icons/react';
import { getHalaqat, getStudentsByRing } from '../../../services/api/tenantService';
import { submitStudentDeletionRequest, getStudentDeletionRequests } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import AddStudentWizard from './AddStudentWizard';
import TeacherRequestsPanel from './TeacherRequestsPanel';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileTeacherStudents from '../../mobile/teacher/MobileTeacherStudents';

/* ─── Toast component ─────────────────────────────────────────────────────────â”€ */
const Toast = ({ message, type, onClose }) => {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
    const bg = type === 'success' ? '#2e7d32' : type === 'error' ? '#c62828' : '#e65100';
    const Icon = type === 'success' ? CheckCircle : WarningCircle;
    return (
        <div style={{
            position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
            background: bg, color: '#fff', padding: '0.9rem 1.8rem', borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '0.7rem',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)', zIndex: 9999,
            animation: 'slideUp 0.3s ease', minWidth: '300px'
        }}>
            <Icon size={22} weight="fill" />
            <span style={{ flex: 1, fontWeight: '500', fontSize: '0.9rem' }}>{message}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
                <X size={18} />
            </button>
            <style>{`@keyframes slideUp{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
        </div>
    );
};

/* ─── Confirm Dialog ─────────────────────────────────────────────────────────â”€â”€ */
const DeletionConfirmDialog = ({ student, onConfirm, onCancel, loading }) => {
    const [reason, setReason] = useState('');
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 8000,
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                background: '#fff', borderRadius: '20px', padding: '2.5rem',
                maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                direction: 'rtl', animation: 'popIn 0.25s ease'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
                    <div style={{ background: '#ffebee', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash size={24} color="#c62828" weight="fill" />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, color: '#1a1a1a', fontSize: '1.2rem' }}>طلب حذف الطالب</h3>
                        <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>سيتم إرسال الطلب للإدارة للمراجعة</p>
                    </div>
                </div>

                <div style={{ background: '#fff8e1', borderRadius: '12px', padding: '1rem', marginBottom: '1.2rem', border: '1px solid #ffe082' }}>
                    <p style={{ margin: 0, color: '#5d4037', fontSize: '0.9rem', lineHeight: 1.6 }}>
                        هل تريد تقديم طلب حذف الطالب <strong style={{ color: '#c62828' }}>"{student?.full_name}"</strong>؟
                        <br />
                        <small>لن يُحذف الطالب مباشرةً — سيُراجع الطلب من قِبل الإدارة.</small>
                    </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#444', fontSize: '0.9rem', fontWeight: '600' }}>
                        سبب الحذف <span style={{ color: '#999', fontWeight: 'normal' }}>(اختياري)</span>
                    </label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="اكتب سبب طلب الحذف هنا..."
                        maxLength={500}
                        rows={3}
                        style={{
                            width: '100%', padding: '0.8rem', borderRadius: '10px',
                            border: '1.5px solid #e0e0e0', fontFamily: 'inherit',
                            resize: 'vertical', outline: 'none', fontSize: '0.9rem',
                            boxSizing: 'border-box', transition: 'border-color 0.2s',
                            color: '#333'
                        }}
                        onFocus={e => e.target.style.borderColor = '#c62828'}
                        onBlur={e => e.target.style.borderColor = '#e0e0e0'}
                    />
                    <small style={{ color: '#999' }}>{reason.length}/500</small>
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        style={{
                            padding: '0.7rem 1.5rem', borderRadius: '10px', border: '1.5px solid #ddd',
                            background: '#fff', color: '#555', cursor: 'pointer', fontWeight: '600',
                            fontFamily: 'inherit', fontSize: '0.9rem'
                        }}
                    >إلغاء</button>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={loading}
                        style={{
                            padding: '0.7rem 1.8rem', borderRadius: '10px', border: 'none',
                            background: loading ? '#ef9a9a' : '#c62828', color: '#fff',
                            cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '700',
                            fontFamily: 'inherit', fontSize: '0.9rem',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            transition: 'background 0.2s'
                        }}
                    >
                        {loading ? (
                            <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />جاري الإرسال...</>
                        ) : (
                            <><Trash size={16} weight="fill" />تأكيد الطلب</>
                        )}
                    </button>
                </div>
                <style>{`
                    @keyframes popIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
                    @keyframes spin{to{transform:rotate(360deg)}}
                `}</style>
            </div>
        </div>
    );
};

/* ─── Status badge ────────────────────────────────────────────────────────────â”€ */
const StatusBadge = ({ status }) => {
    const map = {
        PENDING: { bg: '#fff8e1', color: '#f57c00', label: 'قيد الانتظار' },
        APPROVED: { bg: '#e8f5e9', color: '#2e7d32', label: 'مقبول' },
        REJECTED: { bg: '#ffebee', color: '#c62828', label: 'مرفوض' },
    };
    const s = map[status] || map.PENDING;
    return (
        <span style={{ background: s.bg, color: s.color, padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>
            {s.label}
        </span>
    );
};

/* ─── Main Component ─────────────────────────────────────────────────────────── */
const TeacherStudents = () => {
    const navigate = useNavigate();
    const { isMobile } = useDeviceType();
    const { user } = useAuthContext();

    if (isMobile) {
        return <MobileTeacherStudents />;
    }

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState('all');
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);

    // Deletion request state
    const [confirmStudent, setConfirmStudent] = useState(null);
    const [deletionLoading, setDeletionLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [showRequestsPanel, setShowRequestsPanel] = useState(false);
    const [deletionRequests, setDeletionRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(false);

    useEffect(() => {
        const fetchRings = async () => {
            try {
                const response = await getHalaqat();
                if (response.status === 'success') {
                    setRings(response.data || []);
                    if (response.data?.length > 0) setSelectedRingId('all');
                }
            } catch (err) { console.error(err); }
        };
        fetchRings();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const response = await getStudentsByRing(selectedRingId);
            if (response.status === 'success') setStudents(response.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStudents(); }, [selectedRingId]);

    const fetchDeletionRequests = async () => {
        setRequestsLoading(true);
        try {
            const res = await getStudentDeletionRequests();
            if (res.status === 'success') setDeletionRequests(res.data || []);
        } catch (err) { console.error(err); }
        finally { setRequestsLoading(false); }
    };

    const handleOpenRequests = () => {
        setShowRequestsPanel(true);
        fetchDeletionRequests();
    };

    const handleDeletionRequest = async (reason) => {
        if (!confirmStudent) return;
        setDeletionLoading(true);
        try {
            const res = await submitStudentDeletionRequest({
                student_id: confirmStudent.id,
                reason: reason || undefined,
            });
            if (res.status === 'success') {
                setToast({ message: res.message, type: 'success' });
                setConfirmStudent(null);
            } else {
                setToast({ message: res.message || 'حدث خطأ', type: 'error' });
            }
        } catch (err) {
            const msg = err?.response?.data?.message || 'حدث خطأ أثناء إرسال طلب الحذف';
            setToast({ message: msg, type: 'error' });
        } finally {
            setDeletionLoading(false);
        }
    };

    const filteredStudents = students.filter(st =>
        st.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (isoString) => {
        if (!isoString) return 'غير متوفر';
        const date = new Date(isoString);
        return `${date.getFullYear()} / ${date.getMonth() + 1} / ${date.getDate()}`;
    };

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', direction: 'rtl', minHeight: '100vh', background: '#fcfcfc' }}>
            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.5rem' }}>السلام عليكم، أ. {localStorage.getItem('username') || user?.username}</h1>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>{dateStr}</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="select-halaqa" style={{ position: 'relative' }}>
                        <select
                            value={selectedRingId}
                            onChange={(e) => setSelectedRingId(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: '1px solid #eee',
                                padding: '0.5rem 2.5rem 0.5rem 1rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#133315',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit',
                                minWidth: '150px'
                            }}
                        >
                            <option value="all">كل الحلقات</option>
                            {rings.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <CaretDown size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <Users size={16} color="#888" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                    <button
                        id="btn-deletion-requests-panel"
                        onClick={handleOpenRequests}
                        title="طلبات الحذف"
                        style={{ position: 'relative', background: '#fff', border: '1px solid #eee', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <ClockCounterClockwise size={20} color="#c62828" />
                    </button>
                    <div className="icon-btn" style={{ position: 'relative', background: '#fff', border: '1px solid #eee', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Title & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ fontSize: '2.5rem', color: '#1a3b1c', fontWeight: 'bold', margin: 0 }}>الطلاب</h2>
                    <span style={{ background: '#f4a261', color: '#fff', padding: '0.3rem 1rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {students.length} طالب
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, maxWidth: '55%' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="text"
                            placeholder=" ابحث عن طالب ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '0.7rem 2.5rem 0.7rem 1rem',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                width: '100%',
                                outline: 'none',
                                fontFamily: 'inherit',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                            }}
                        />
                        <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                    </div>
                    <button
                        id="btn-add-student-request"
                        onClick={() => { setStudentToEdit(null); setIsWizardOpen(true); }}
                        style={{
                            backgroundColor: '#558b2f',
                            color: '#fff',
                            border: 'none',
                            padding: '0.7rem 1.5rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                            fontFamily: 'inherit'
                        }}
                    >
                        طلب تسجيل طالب
                    </button>
                </div>
            </div>

            <AddStudentWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onComplete={() => fetchStudents()}
                studentToEdit={studentToEdit}
            />

            {/* Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', color: '#558b2f', padding: '2rem' }}>ط¬ط§ط±ظٹ طھط­ظ…ظٹظ„ الطلاب...</div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '2.5rem',
                    paddingTop: '2rem'
                }}>
                    {filteredStudents.map(student => (
                        <div key={student.id} style={{
                            background: '#fff',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                            border: '1px solid #f0f0f0',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Top row: Gender badge and Points */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ background: '#aed1f5', color: '#333', padding: '0.3rem 1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    {student.gender === 'F' ? 'أنثى' : 'ذكر'}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#666', fontSize: '0.85rem' }}>
                                    <span>{student.points || 0} نقطة</span>
                                    <Star size={16} color="#f57c00" weight="regular" />
                                </div>
                            </div>

                            {/* Avatar */}
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                border: '3px solid #eee',
                                background: '#fafafa',
                                margin: '-4.5rem auto 1rem auto',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: '#ccc'
                            }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>

                            {/* Center info */}
                            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                <div style={{ background: '#dcedc8', color: '#33691e', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginBottom: '0.5rem' }}>
                                    {student.rating || '0.0'} / 5
                                </div>
                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', color: '#111' }}>{student.full_name}</h3>
                                <p style={{ color: '#e65100', margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>رقم صفحة الوصول : {student.reached_page}</p>
                            </div>

                            {/* Details List */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', color: '#444', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>اسم الأب :</span> <span>{student.parent_name || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>اسم الأم والكنية :</span> <span>{student.mother_name || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>تاريخ الميلاد :</span> <span>{formatDate(student.birth_date)}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رقم هاتف الأب :</span> <span>{student.parent_phone || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رقم هاتف الأم :</span> <span>{student.mother_phone || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رقم الوثيقة :</span> <span>{student.national_id || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رقم القيد :</span> <span>{student.registration_number || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>السكن الحالي :</span> <span>{student.current_residence || 'غير متوفر'}</span></div>
                            </div>

                            {/* Actions Footer */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#81b255', padding: 0 }}>
                                    <PhoneCall size={24} weight="regular" />
                                </button>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button
                                        id={`btn-edit-student-${student.id}`}
                                        onClick={() => { setStudentToEdit(student); setIsWizardOpen(true); }}
                                        style={{
                                            backgroundColor: '#558b2f',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '0.4rem 1.2rem',
                                            borderRadius: '20px',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontFamily: 'inherit'
                                        }}>تعديل</button>
                                    <button
                                        id={`btn-request-deletion-${student.id}`}
                                        onClick={() => setConfirmStudent(student)}
                                        title="طلب حذف الطالب"
                                        style={{
                                            backgroundColor: '#fff',
                                            color: '#c62828',
                                            border: '1.5px solid #c62828',
                                            padding: '0.4rem 1rem',
                                            borderRadius: '20px',
                                            fontSize: '0.82rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            fontFamily: 'inherit',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#c62828'; e.currentTarget.style.color = '#fff'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#c62828'; }}
                                    >
                                        <Trash size={14} weight="bold" />
                                        طلب حذف
                                    </button>
                                    <button
                                        id={`btn-student-activity-${student.id}`}
                                        onClick={() => navigate(`/teacher/students/${student.id}/activity`)}
                                        style={{
                                            backgroundColor: '#e65100',
                                            color: '#fff',
                                            border: 'none',
                                            padding: '0.4rem 1.2rem',
                                            borderRadius: '20px',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontFamily: 'inherit'
                                        }}
                                    >
                                        نشاط الطالب
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Deletion Confirm Dialog ──────────────────────────────────────────â”€ */}
            {confirmStudent && (
                <DeletionConfirmDialog
                    student={confirmStudent}
                    loading={deletionLoading}
                    onConfirm={handleDeletionRequest}
                    onCancel={() => setConfirmStudent(null)}
                />
            )}

            {/* ─── Teacher Requests Panel ─────────────────────────────────── */}
            <TeacherRequestsPanel
                isOpen={showRequestsPanel}
                onClose={() => setShowRequestsPanel(false)}
            />

            {/* ─── Toast ──────────────────────────────────────────────────────────── */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        </div>
    );
};

export default TeacherStudents;

