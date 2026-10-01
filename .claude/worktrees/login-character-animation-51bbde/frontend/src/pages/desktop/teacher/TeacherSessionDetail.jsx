import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Bell, CaretDown, Users, MagnifyingGlass, UserCircle } from '@phosphor-icons/react';
import { getHalaqat, getTeacherSessionDetail, startSession, updateSessionDetails } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import RecitationModal from './RecitationModal';

const ATTENDANCE_OPTIONS = [
    { label: 'حاضر', value: 'PRESENT' },
    { label: 'غياب مبرر', value: 'EXCUSED' },
    { label: 'غياب غير مبرر', value: 'ABSENT' },
    { label: 'متأخر', value: 'LATE' },
];

const BEHAVIOR_OPTIONS = [
    { label: 'ممتاز', value: 10 },
    { label: 'جيد جداً', value: 8 },
    { label: 'جيد', value: 6 },
    { label: 'مقبول', value: 4 },
    { label: 'ضعيف', value: 2 },
];

const TeacherSessionDetail = () => {
    const { ringId, sessionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthContext();
    
    // Check if we are in read-only mode or edit mode
    // If we just created the session (e.g. from 'new' or passed edit=true), we can edit
    const isEditMode = location.search.includes('edit=true');

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState(ringId || '');
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [evaluationTemplate, setEvaluationTemplate] = useState(null);
    const [evaluatingStudent, setEvaluatingStudent] = useState(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Fetch rings for the dropdown
    useEffect(() => {
        const fetchRings = async () => {
            try {
                const response = await getHalaqat();
                if (response.status === 'success') {
                    setRings(response.data || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchRings();
    }, []);

    // Load session details
    useEffect(() => {
        const loadSessionData = async () => {
            if (!sessionId || sessionId === 'new') return;
            
            setLoading(true);
            try {
                const response = await getTeacherSessionDetail(sessionId);
                if (response.status === 'success') {
                    setStudents(response.attendance || []);
                    setEvaluationTemplate(response.evaluation_template || null);
                } else {
                    setError('فشل في جلب تفاصيل الجلسة');
                }
            } catch (err) {
                console.error(err);
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };
        
        loadSessionData();
    }, [sessionId]);

    const handleRingChange = (e) => {
        const newRingId = e.target.value;
        setSelectedRingId(newRingId);
        // If they change ring, navigate back to sessions list for that ring
        navigate(`/teacher/rings/${newRingId}/sessions`);
    };

    const handleStudentChange = (attendanceId, field, value) => {
        if (!isEditMode) return;
        setStudents(prev => prev.map(st => 
            st.attendance_id === attendanceId ? { ...st, [field]: value } : st
        ));
    };

    const handleSaveSession = async () => {
        if (!isEditMode) return;
        setSaving(true);
        try {
            const payload = {
                students: students.map(st => ({
                    attendance_id: st.attendance_id,
                    status: st.status,
                    behavior_score: st.behavior_score,
                    notes: st.notes || ''
                }))
            };
            const response = await updateSessionDetails(sessionId, payload);
            if (response.status === 'success') {
                alert('تم حفظ تفاصيل الجلسة بنجاح!');
                // Navigate to read-only view
                navigate(`/teacher/rings/${selectedRingId}/sessions/${sessionId}`);
            } else {
                alert('حدث خطأ أثناء الحفظ');
            }
        } catch (err) {
            console.error(err);
            alert('حدث خطأ في الاتصال بالخادم');
        } finally {
            setSaving(false);
        }
    };

    const handleEvaluationSuccess = (attendanceId, newReachedPage) => {
        setStudents(prev => prev.map(st => 
            st.attendance_id === attendanceId ? { ...st, reached_page: newReachedPage } : st
        ));
    };

    const filteredStudents = students.filter(st => 
        st.student_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', direction: 'rtl' }}>
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
                            onChange={handleRingChange}
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
                                fontFamily: 'inherit'
                            }}
                        >
                            {rings.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <CaretDown size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <Users size={16} color="#888" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                    <div className="icon-btn" style={{ position: 'relative', background: '#fff', border: '1px solid #eee', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Page Title & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '2.5rem', color: '#1a3b1c', fontWeight: 'bold' }}>طلاب الحلقة {isEditMode ? '' : '(للقراءة فقط)'}</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '50%' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input 
                            type="text" 
                            placeholder="ابحث عن طالب ..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ 
                                padding: '0.5rem 2.5rem 0.5rem 1rem', 
                                border: '1px solid #ddd', 
                                borderRadius: '8px',
                                width: '100%',
                                outline: 'none'
                            }} 
                        />
                        <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.5rem', transform: 'translateY(-50%)' }} />
                    </div>
                    <button 
                        style={{ 
                            backgroundColor: '#558b2f', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '0.6rem 1.5rem', 
                            borderRadius: '8px', 
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        طلب تسجيل طالب
                    </button>
                </div>
            </div>
            
            {/* Table Header */}
            <div style={{ display: 'flex', backgroundColor: '#e0e0e0', padding: '1rem', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
                <div style={{ flex: 1.5 }}>الطالب</div>
                <div style={{ flex: 2, borderRight: '1px solid #aaa' }}>الحضور</div>
                <div style={{ flex: 1, borderRight: '1px solid #aaa' }}>السلوك</div>
                <div style={{ flex: 1, borderRight: '1px solid #aaa' }}>التقييم</div>
                <div style={{ flex: 2, borderRight: '1px solid #aaa' }}>ملاحظات</div>
            </div>

            {/* Table Body */}
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#558b2f' }}>جاري تحميل تفاصيل الجلسة...</div>
            ) : error ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#c62828' }}>{error}</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {filteredStudents.map(student => (
                        <div key={student.attendance_id} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            padding: '1rem', 
                            border: '1px solid #eee', 
                            borderRadius: '8px', 
                            background: '#fff',
                            textAlign: 'center'
                        }}>
                            {/* Student Name */}
                            <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: '#133315' }}>
                                <UserCircle size={24} color="#64b5f6" weight="fill" />
                                {student.student_name}
                            </div>

                            {/* Attendance */}
                            <div style={{ flex: 2, display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                                {ATTENDANCE_OPTIONS.map(opt => (
                                    <button 
                                        key={opt.value}
                                        disabled={!isEditMode}
                                        onClick={() => handleStudentChange(student.attendance_id, 'status', opt.value)}
                                        style={{
                                            padding: '0.3rem 0.5rem',
                                            border: `1px solid ${student.status === opt.value ? '#558b2f' : '#ccc'}`,
                                            borderRadius: '4px',
                                            background: student.status === opt.value ? '#f1f8e9' : '#fff',
                                            color: student.status === opt.value ? '#558b2f' : '#888',
                                            cursor: isEditMode ? 'pointer' : 'default',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* Behavior */}
                            <div style={{ flex: 1, padding: '0 0.5rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        disabled={!isEditMode}
                                        value={student.behavior_score || 10}
                                        onChange={(e) => handleStudentChange(student.attendance_id, 'behavior_score', parseInt(e.target.value))}
                                        style={{
                                            width: '100%',
                                            padding: '0.3rem',
                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                            appearance: 'none',
                                            background: '#fff',
                                            textAlign: 'center',
                                            cursor: isEditMode ? 'pointer' : 'default'
                                        }}
                                    >
                                        {BEHAVIOR_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <CaretDown size={12} color="#888" style={{ position: 'absolute', top: '50%', left: '0.3rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                </div>
                            </div>

                            {/* Evaluation */}
                            <div style={{ flex: 1 }}>
                                <button 
                                    disabled={!isEditMode}
                                    onClick={() => setEvaluatingStudent(student)}
                                    style={{
                                        backgroundColor: '#81b255',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.4rem 1rem',
                                        borderRadius: '4px',
                                        cursor: isEditMode ? 'pointer' : 'default',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    إضافة تقييم
                                </button>
                            </div>

                            {/* Notes */}
                            <div style={{ flex: 2 }}>
                                <input 
                                    type="text" 
                                    placeholder="مثلاً: تأخر لمدة عشر دقائق بعذر"
                                    disabled={!isEditMode}
                                    value={student.notes || ''}
                                    onChange={(e) => handleStudentChange(student.attendance_id, 'notes', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.4rem',
                                        border: '1px solid #eee',
                                        borderRadius: '4px',
                                        outline: 'none',
                                        color: '#555',
                                        background: isEditMode ? '#f9f9f9' : '#fff'
                                    }}
                                />
                            </div>

                        </div>
                    ))}
                </div>
            )}

            {/* Save Button */}
            {isEditMode && !loading && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                    <button 
                        onClick={handleSaveSession}
                        disabled={saving}
                        style={{
                            backgroundColor: '#f57c00',
                            color: '#fff',
                            border: 'none',
                            padding: '0.8rem 3rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        {saving ? 'جاري الحفظ...' : 'حفظ الجلسة'}
                    </button>
                </div>
            )}

            {/* Recitation Modal */}
            <RecitationModal 
                isOpen={!!evaluatingStudent}
                onClose={() => setEvaluatingStudent(null)}
                student={evaluatingStudent}
                evaluationTemplate={evaluationTemplate}
                onEvaluationSuccess={handleEvaluationSuccess}
            />
        </div>
    );
};

export default TeacherSessionDetail;
