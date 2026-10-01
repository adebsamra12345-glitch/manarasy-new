import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
    Bell, CaretDown, Users, CalendarBlank, FilePdf, 
    ArrowRight, Plus, Trash, Eye, WarningCircle, CheckCircle,
    CalendarPlus, Sparkle, Clock, MagnifyingGlass
} from '@phosphor-icons/react';
import { 
    getHalaqat, getSessions, startSession, deleteSession, createSession 
} from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import { exportSessionPdf } from '../../../utils/sessionPdfExporter';
import AlternativeDatePickerModal from '../../../components/AlternativeDatePickerModal';

/**
 * AdminRingSessions (جلسات الحلقة للأدمن ومدير المركز)
 * ─────────────────────────────────────────────────────────────
 * واجهة مستقلة ومخصصة لعرض جلسات حلقة معينة في حساب مدير النظام (Admin) أو مدير المركز.
 * متطابقة في البنية والجمالية وسلاسة الاستخدام مع واجهة المعلم المستقرة،
 * مع منح مدير النظام ومدير المركز كافة الصلاحيات الممكنة (بدء جلسة، إضافة جلسة، حذف جلسة،
 * تصدير PDF، التبديل بين الحلقات، والانتقال للتقويم العام).
 */
const AdminRingSessions = () => {
    const { ringId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';
    const { user } = useAuthContext();

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    // حالة الحلقات واختيار الحلقة الحالية
    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState(ringId || '');
    const [currentRing, setCurrentRing] = useState(null);

    // حالة الجلسات
    const [sessions, setSessions] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [exportingSessionId, setExportingSessionId] = useState(null);

    // نافذة اختيار تاريخ بديل عند التعارض
    const [showAltDatePickerModal, setShowAltDatePickerModal] = useState(false);
    const [conflictDate, setConflictDate] = useState('');
    const [startingInstantSession, setStartingInstantSession] = useState(false);

    // نافذة حذف جلسة
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // نافذة إنشاء جلسة مجدولة جديدة
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creatingSession, setCreatingSession] = useState(false);
    const [modalError, setModalError] = useState('');
    const [formData, setFormData] = useState({
        session_date: today.toISOString().split('T')[0],
        start_time: '16:00',
        end_time: '18:00',
        notes: ''
    });

    // 1. جلب قائمة الحلقات لتغذية القائمة المنسدلة وتحديد بيانات الحلقة الحالية
    useEffect(() => {
        const fetchRings = async () => {
            try {
                const response = await getHalaqat();
                if (response.status === 'success') {
                    const fetchedRings = response.data || [];
                    setRings(fetchedRings);

                    // إذا لم يكن هناك ringId محدد في الرابط، اختر أول حلقة
                    const targetId = ringId || (fetchedRings.length > 0 ? fetchedRings[0].id : '');
                    setSelectedRingId(targetId);

                    const match = fetchedRings.find(r => String(r.id) === String(targetId));
                    setCurrentRing(match || null);
                } else {
                    setError('فشل في جلب قائمة الحلقات');
                }
            } catch (err) {
                console.error('Error fetching halaqat:', err);
                setError('حدث خطأ أثناء الاتصال بالخادم لجلب الحلقات');
            }
        };

        fetchRings();
    }, [ringId]);

    // 2. تحديث الحلقة الحالية عند تغير selectedRingId
    useEffect(() => {
        if (rings.length > 0 && selectedRingId) {
            const match = rings.find(r => String(r.id) === String(selectedRingId));
            setCurrentRing(match || null);
        }
    }, [selectedRingId, rings]);

    // 3. جلب جلسات الحلقة المختارة
    const fetchSessionsData = async () => {
        if (!selectedRingId) return;

        setLoading(true);
        setError('');
        try {
            const response = await getSessions(selectedRingId);
            if (response.status === 'success') {
                const rawSessions = response.data || [];
                const sorted = [...rawSessions].sort((a, b) => {
                    const dateDiff = new Date(b.session_date) - new Date(a.session_date);
                    if (dateDiff !== 0) return dateDiff;
                    return (b.start_time || '').localeCompare(a.start_time || '');
                });
                setSessions(sorted);
            } else {
                setError('فشل في جلب جلسات الحلقة');
            }
        } catch (err) {
            console.error('Error fetching sessions:', err);
            setError('حدث خطأ أثناء جلب الجلسات من الخادم');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessionsData();
    }, [selectedRingId]);

    // تبديل الحلقة من القائمة المنسدلة والتنقل بسلاسة
    const handleRingChange = (e) => {
        const newRingId = e.target.value;
        setSelectedRingId(newRingId);
        navigate(`${basePath}/rings/${newRingId}/sessions`);
    };

    // بدء جلسة جديدة فورية (Start Instant Session)
    const handleStartInstantSession = async (sessionDate = null) => {
        if (!selectedRingId || startingInstantSession) return;
        setStartingInstantSession(true);
        setError('');
        try {
            const teacherId = currentRing?.teacher_id || user?.id;
            const payload = {
                halaqa_id: selectedRingId,
                teacher_id: teacherId
            };
            if (typeof sessionDate === 'string' && sessionDate) {
                payload.session_date = sessionDate;
            }
            const response = await startSession(payload);

            if (response.status === 'success') {
                setShowAltDatePickerModal(false);
                const newSessionId = response.data.session_id;
                navigate(`${basePath}/rings/${selectedRingId}/sessions/${newSessionId}?edit=true`);
            } else {
                setError('حدث خطأ أثناء بدء الجلسة: ' + (response.message || ''));
            }
        } catch (err) {
            console.error('Error starting session:', err);
            if (err.response?.status === 409 || err.response?.data?.error_code === 'SESSION_DATE_CONFLICT') {
                const confDate = err.response?.data?.conflicting_date || (sessionDate || new Date().toISOString().slice(0, 10));
                setConflictDate(confDate);
                setShowAltDatePickerModal(true);
            } else {
                setError(err.response?.data?.message || 'حدث خطأ في الاتصال بالخادم لبدء الجلسة');
            }
        } finally {
            setStartingInstantSession(false);
        }
    };

    const handleSelectAlternativeDate = (chosenDate) => {
        handleStartInstantSession(chosenDate);
    };

    // إنشاء جلسة مجدولة بتوقيت وتاريخ محدد (Create Scheduled Session)
    const handleCreateScheduledSession = async (e) => {
        e.preventDefault();
        setModalError('');

        if (!formData.session_date) {
            setModalError('يرجى تحديد تاريخ الجلسة');
            return;
        }

        // التحقق من منع التواريخ المستقبلية
        const todayISO = new Date().toISOString().slice(0, 10);
        if (formData.session_date > todayISO) {
            setModalError('لا يمكن إنشاء جلسة بتاريخ مستقبلي. يرجى اختيار تاريخ اليوم أو أي تاريخ سابق.');
            return;
        }

        setCreatingSession(true);
        try {
            const payload = {
                halaqa_id: selectedRingId,
                session_date: formData.session_date,
                start_time: formData.start_time ? `${formData.start_time}:00` : '16:00:00',
                end_time: formData.end_time ? `${formData.end_time}:00` : '18:00:00',
                notes: formData.notes
            };

            const response = await createSession(payload);
            if (response.status === 'success') {
                setSuccessMsg('تمت إضافة الجلسة المجدولة بنجاح');
                setShowCreateModal(false);
                fetchSessionsData();
            } else {
                setModalError(response.message || 'فشل في حفظ الجلسة');
            }
        } catch (err) {
            console.error('Error creating session:', err);
            if (err.response?.status === 409 || err.response?.data?.error_code === 'SESSION_DATE_CONFLICT') {
                setModalError('توجد جلسة مسجلة مسبقاً لهذه الحلقة في التاريخ المحدد.');
            } else {
                setModalError(err.response?.data?.message || 'حدث خطأ أثناء حفظ الجلسة في الخادم');
            }
        } finally {
            setCreatingSession(false);
        }
    };

    // حذف جلسة (Delete Session Confirmation)
    const handleOpenDeleteConfirm = (session, e) => {
        e.stopPropagation();
        setSessionToDelete(session);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!sessionToDelete) return;
        setDeleting(true);
        try {
            const response = await deleteSession(sessionToDelete.id);
            if (response.status === 'success') {
                setSuccessMsg('تم حذف الجلسة بنجاح');
                setShowDeleteConfirm(false);
                setSessionToDelete(null);
                fetchSessionsData();
            } else {
                alert(response.message || 'فشل في حذف الجلسة');
            }
        } catch (err) {
            console.error('Error deleting session:', err);
            alert('حدث خطأ أثناء الاتصال بالخادم لحذف الجلسة');
        } finally {
            setDeleting(false);
        }
    };

    // تصدير تقرير الجلسة PDF
    const handleExportPdf = async (e, session) => {
        e.stopPropagation();
        if (exportingSessionId) return;
        setExportingSessionId(session.id);
        try {
            await exportSessionPdf(session.id, {
                session_date: session.session_date,
                halaqa_name: currentRing?.name,
                teacher_name: currentRing?.teacher_name
            });
        } catch (err) {
            console.error('Error exporting PDF:', err);
            alert('حدث خطأ أثناء تصدير تقرير الجلسة بصيغة PDF');
        } finally {
            setExportingSessionId(null);
        }
    };

    // تنسيق التاريخ بالعربية
    const formatSessionDate = (isoDate) => {
        if (!isoDate) return 'تاريخ غير محدد';
        const d = new Date(isoDate);
        return d.toLocaleDateString('ar-SA', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    };

    // فلترة الجلسات حسب البحث
    const filteredSessions = sessions.filter(session => {
        const dateStrArabic = formatSessionDate(session.session_date);
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (
            dateStrArabic.includes(query) ||
            (session.session_date && session.session_date.includes(query)) ||
            (session.notes && session.notes.toLowerCase().includes(query))
        );
    });

    // إحصائيات سريعة للحلقة
    const totalSessions = sessions.length;
    const avgAttendance = totalSessions > 0
        ? Math.round(
            sessions.reduce((acc, s) => {
                const total = s.total_count || 0;
                const present = s.present_count || 0;
                return acc + (total > 0 ? (present / total) * 100 : 0);
            }, 0) / totalSessions
        )
        : 0;

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1050px', margin: '0 auto', direction: 'rtl', fontFamily: 'inherit' }}>
            
            {/* الشريط العلوي والترحيب واختيار الحلقة */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <button
                            onClick={() => navigate(`${basePath}/rings`)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                background: '#f1f8e9',
                                color: '#2e7d32',
                                border: '1px solid #c8e6c9',
                                padding: '0.35rem 0.8rem',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            title="العودة لقائمة الحلقات"
                        >
                            <ArrowRight size={16} />
                            <span>العودة للحلقات</span>
                        </button>
                        <span style={{ color: '#888', fontSize: '0.85rem' }}>/ جلسات الحلقة</span>
                    </div>
                    <h1 style={{ fontSize: '1.75rem', color: '#133315', margin: 0, fontWeight: 'bold' }}>
                        السلام عليكم، أ. {localStorage.getItem('username') || user?.username || 'مدير النظام'}
                    </h1>
                    <p style={{ color: '#777', fontSize: '0.85rem', marginTop: '0.2rem' }}>{dateStr}</p>
                </div>

                <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* اختيار الحلقة من القائمة المنسدلة */}
                    <div className="select-halaqa" style={{ position: 'relative' }}>
                        <select
                            value={selectedRingId}
                            onChange={handleRingChange}
                            style={{
                                appearance: 'none',
                                border: '1.5px solid #558b2f',
                                padding: '0.55rem 2.4rem 0.55rem 1.2rem',
                                borderRadius: '10px',
                                background: '#f1f8e9',
                                color: '#133315',
                                fontWeight: 'bold',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                        >
                            {rings.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.name} {r.project_title ? `(${r.project_title})` : ''}
                                </option>
                            ))}
                            {rings.length === 0 && <option value="">لا توجد حلقات</option>}
                        </select>
                        <CaretDown size={16} color="#133315" style={{ position: 'absolute', top: '50%', right: '0.7rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <Users size={16} color="#558b2f" style={{ position: 'absolute', top: '50%', left: '0.7rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* زر التنبيهات */}
                    <div className="icon-btn" style={{ position: 'relative', background: '#fff', border: '1px solid #ddd', padding: '0.55rem', borderRadius: '50%', cursor: 'pointer' }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* رسائل التنبيه والنجاح */}
            {successMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '0.8rem 1.2rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid #a5d6a7' }}>
                    <CheckCircle size={22} weight="fill" />
                    <span style={{ fontWeight: '500' }}>{successMsg}</span>
                    <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 'auto', color: '#2e7d32' }}>✕</button>
                </div>
            )}

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', backgroundColor: '#ffebee', color: '#c62828', padding: '0.8rem 1.2rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid #ef9a9a' }}>
                    <WarningCircle size={22} weight="fill" />
                    <span style={{ fontWeight: '500' }}>{error}</span>
                    <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 'auto', color: '#c62828' }}>✕</button>
                </div>
            )}

            {/* بطاقة معلومات سريعة عن الحلقة وإحصائياتها */}
            {currentRing && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '16px',
                    padding: '1.2rem 1.8rem',
                    marginBottom: '2rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    gap: '1rem'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.3rem' }}>
                            <h2 style={{ fontSize: '1.6rem', color: '#133315', fontWeight: 'bold', margin: 0 }}>
                                {currentRing.name}
                            </h2>
                            <span style={{
                                backgroundColor: currentRing.is_active !== false ? '#e8f5e9' : '#f5f5f5',
                                color: currentRing.is_active !== false ? '#2e7d32' : '#9e9e9e',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '20px',
                                fontSize: '0.78rem',
                                fontWeight: 'bold'
                            }}>
                                {currentRing.is_active !== false ? 'نشطة' : 'متوقفة'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '1.2rem', color: '#666', fontSize: '0.88rem' }}>
                            <span><strong>المشروع:</strong> {currentRing.project_title || currentRing.center_name || 'عام'}</span>
                            {currentRing.teacher_name && <span><strong>المعلم:</strong> {currentRing.teacher_name}</span>}
                            <span><strong>الطلاب:</strong> {currentRing.students_count || currentRing.studentsCount || 0} طالب</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid #eee', paddingLeft: '1.5rem' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#133315' }}>{totalSessions}</div>
                            <div style={{ fontSize: '0.8rem', color: '#888' }}>إجمالي الجلسات</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#558b2f' }}>{avgAttendance}%</div>
                            <div style={{ fontSize: '0.8rem', color: '#888' }}>متوسط الحضور</div>
                        </div>
                    </div>
                </div>
            )}

            {/* شريط الإجراءات والبحث */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <h2 style={{ fontSize: '2rem', color: '#1a3b1c', fontWeight: 'bold', margin: 0 }}>الجلسات</h2>
                    <span style={{ backgroundColor: '#f1f8e9', color: '#33691e', padding: '0.2rem 0.7rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {filteredSessions.length} جلسة
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* حقل البحث */}
                    <div style={{ position: 'relative', width: '220px' }}>
                        <input
                            type="text"
                            placeholder="بحث بالتاريخ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '0.55rem 2.2rem 0.55rem 1rem',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                textAlign: 'right',
                                outline: 'none',
                                width: '100%',
                                fontSize: '0.9rem'
                            }}
                        />
                        <MagnifyingGlass size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.7rem', transform: 'translateY(-50%)' }} />
                    </div>

                    {/* زر الذهاب إلى جدول الجلسات التقويمي */}
                    <button
                        onClick={() => navigate(`${basePath}/sessions`)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            backgroundColor: '#fff',
                            color: '#133315',
                            border: '1.5px solid #133315',
                            padding: '0.55rem 1.1rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        title="الانتقال إلى جدول الجلسات الشهري التقويمي"
                    >
                        <CalendarBlank size={18} />
                        <span>جدول الجلسات التقويمي</span>
                    </button>

                    {/* زر إضافة جلسة مجدولة */}
                    <button
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            backgroundColor: '#fff',
                            color: '#558b2f',
                            border: '1.5px solid #558b2f',
                            padding: '0.55rem 1.1rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <CalendarPlus size={18} />
                        <span>إضافة جلسة</span>
                    </button>

                    {/* زر بدء جلسة جديدة فورية */}
                    <button
                        onClick={() => handleStartInstantSession()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            backgroundColor: '#558b2f',
                            color: '#fff',
                            border: 'none',
                            padding: '0.6rem 1.4rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(85,139,47,0.3)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Plus size={18} weight="bold" />
                        <span>بدء جلسة جديدة</span>
                    </button>
                </div>
            </div>

            {/* فاصل أفقي */}
            <div style={{ height: '1px', backgroundColor: '#e0e0e0', marginBottom: '2rem' }}></div>

            {/* قائمة الجلسات */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#558b2f', fontSize: '1.1rem' }}>
                    جاري تحميل جلسات الحلقة...
                </div>
            ) : filteredSessions.length === 0 ? (
                <div style={{
                    padding: '3.5rem 2rem',
                    textAlign: 'center',
                    backgroundColor: '#fff',
                    borderRadius: '16px',
                    border: '1px dashed #ccc'
                }}>
                    <CalendarBlank size={48} color="#9e9e9e" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1.3rem', color: '#424242', marginBottom: '0.5rem' }}>
                        لا توجد جلسات مسجلة لهذه الحلقة حالياً
                    </h3>
                    <p style={{ color: '#757575', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                        يمكنك بدء جلسة حضور جديدة فوراً أو إضافة موعد جلسة مجدولة.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button
                            onClick={() => handleStartInstantSession()}
                            style={{
                                backgroundColor: '#558b2f',
                                color: '#fff',
                                border: 'none',
                                padding: '0.6rem 1.4rem',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            بدء أول جلسة الآن
                        </button>
                    </div>
                </div>
            ) : (
                <div className="sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    {filteredSessions.map(session => {
                        const attendancePercentage = session.total_count > 0
                            ? Math.round((session.present_count / session.total_count) * 100)
                            : 0;

                        return (
                            <div
                                key={session.id}
                                onClick={() => navigate(`${basePath}/rings/${selectedRingId}/sessions/${session.id}`)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1.3rem 1.8rem',
                                    border: '1px solid #c8e6c9',
                                    borderRadius: '16px',
                                    background: '#fff',
                                    position: 'relative',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    overflow: 'hidden'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.07)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.borderColor = '#81c784';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.borderColor = '#c8e6c9';
                                }}
                            >
                                {/* شريط التمييز الجانبي البرتقالي المميز للمنارة */}
                                <div style={{
                                    position: 'absolute',
                                    right: '0',
                                    top: '0',
                                    bottom: '0',
                                    width: '6px',
                                    backgroundColor: '#f57c00'
                                }}></div>

                                <div style={{ textAlign: 'right', paddingRight: '12px' }}>
                                    <h3 style={{ fontSize: '1.3rem', color: '#133315', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                                        {formatSessionDate(session.session_date)}
                                    </h3>
                                    <div style={{ color: '#666', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.9rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            الحضور: <strong style={{ color: '#133315' }}>{session.present_count || 0}</strong> من {session.total_count || 0}
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#81b255', display: 'inline-block' }}></span>
                                        </span>

                                        {(session.start_time || session.end_time) && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#888' }}>
                                                <Clock size={15} />
                                                <span>{session.start_time ? session.start_time.slice(0, 5) : ''} {session.end_time ? `- ${session.end_time.slice(0, 5)}` : ''}</span>
                                            </span>
                                        )}

                                        {session.notes && (
                                            <span style={{ color: '#888', fontStyle: 'italic', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {session.notes}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    {/* زر تصدير تقرير الجلسة PDF */}
                                    <button
                                        type="button"
                                        title="تصدير تقرير الجلسة PDF"
                                        disabled={exportingSessionId === session.id}
                                        onClick={(e) => handleExportPdf(e, session)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            padding: '0.5rem 0.9rem',
                                            border: '1px solid #558b2f',
                                            borderRadius: '8px',
                                            background: exportingSessionId === session.id ? '#f1f8e9' : '#fff',
                                            color: '#133315',
                                            fontWeight: 'bold',
                                            fontSize: '0.85rem',
                                            cursor: exportingSessionId === session.id ? 'wait' : 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <FilePdf size={18} color="#c62828" weight="fill" />
                                        <span>{exportingSessionId === session.id ? 'جاري...' : 'تقرير PDF'}</span>
                                    </button>

                                    {/* زر عرض تفاصيل الجلسة */}
                                    <button
                                        type="button"
                                        title="عرض وتعديل تفاصيل الجلسة والتقييمات"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`${basePath}/rings/${selectedRingId}/sessions/${session.id}`);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            padding: '0.5rem 0.8rem',
                                            border: '1px solid #81c784',
                                            borderRadius: '8px',
                                            background: '#fff',
                                            color: '#2e7d32',
                                            fontWeight: 'bold',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Eye size={17} />
                                        <span>التفاصيل</span>
                                    </button>

                                    {/* زر حذف الجلسة (صلاحية خاصة بالأدمن) */}
                                    <button
                                        type="button"
                                        title="حذف الجلسة"
                                        onClick={(e) => handleOpenDeleteConfirm(session, e)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '36px',
                                            height: '36px',
                                            border: '1px solid #ef9a9a',
                                            borderRadius: '8px',
                                            background: '#fff',
                                            color: '#c62828',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffebee'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                        <Trash size={17} />
                                    </button>

                                    {/* دائرة نسبة الحضور */}
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '50%',
                                        border: '3px solid #81b255',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: '#f1f8e9',
                                        color: '#133315',
                                        fontWeight: 'bold',
                                        fontSize: '1rem',
                                        marginRight: '0.4rem'
                                    }}>
                                        {attendancePercentage}%
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* مودال إنشاء جلسة مجدولة جديدة */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, direction: 'rtl'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', padding: '2rem',
                        width: '90%', maxWidth: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                            <h3 style={{ margin: 0, color: '#133315', fontSize: '1.3rem', fontWeight: 'bold' }}>
                                إضافة جلسة مجدولة للحلقة
                            </h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#888' }}
                            >✕</button>
                        </div>

                        {modalError && (
                            <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '0.6rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleCreateScheduledSession}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#333', marginBottom: '0.4rem' }}>
                                    تاريخ الجلسة *
                                </label>
                                <input
                                    type="date"
                                    max={new Date().toISOString().split('T')[0]}
                                    value={formData.session_date}
                                    onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.95rem' }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#333', marginBottom: '0.4rem' }}>
                                        وقت البدء
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                        style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'inherit' }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#333', marginBottom: '0.4rem' }}>
                                        وقت الانتهاء
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                        style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'inherit' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', color: '#333', marginBottom: '0.4rem' }}>
                                    ملاحظات (اختياري)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    placeholder="موضوع الجلسة أو ملاحظات تحضيرية..."
                                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'inherit', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    style={{ padding: '0.6rem 1.2rem', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingSession}
                                    style={{
                                        padding: '0.6rem 1.5rem',
                                        backgroundColor: '#558b2f',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 'bold',
                                        cursor: creatingSession ? 'wait' : 'pointer',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    {creatingSession ? 'جاري الحفظ...' : 'حفظ الجلسة'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* مودال تأكيد حذف الجلسة */}
            {showDeleteConfirm && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, direction: 'rtl'
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', padding: '2rem',
                        width: '90%', maxWidth: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', textAlign: 'center'
                    }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#ffebee',
                            color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1rem'
                        }}>
                            <Trash size={28} />
                        </div>
                        <h3 style={{ fontSize: '1.3rem', color: '#133315', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                            هل أنت متأكد من حذف هذه الجلسة؟
                        </h3>
                        <p style={{ color: '#666', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                            سيتم حذف سجل الجلسة بتاريخ <strong>{formatSessionDate(sessionToDelete?.session_date)}</strong> بما فيها سجلات الحضور الخاصة بها. هذا الإجراء لا يمكن التراجع عنه.
                        </p>
                        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{ padding: '0.6rem 1.4rem', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                                style={{
                                    padding: '0.6rem 1.5rem',
                                    backgroundColor: '#c62828',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 'bold',
                                    cursor: deleting ? 'wait' : 'pointer',
                                    fontFamily: 'inherit'
                                }}
                            >
                                {deleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* مودال اختيار تاريخ بديل عند تعارض بدء الجلسة */}
            <AlternativeDatePickerModal
                isOpen={showAltDatePickerModal}
                onClose={() => setShowAltDatePickerModal(false)}
                onSelectDate={handleSelectAlternativeDate}
                halaqaId={selectedRingId}
                conflictingDate={conflictDate}
                title="تعارض في تاريخ الجلسة"
                message="توجد جلسة مسجلة مسبقاً لهذه الحلقة في التاريخ المحدد."
            />
        </div>
    );
};

export default AdminRingSessions;
