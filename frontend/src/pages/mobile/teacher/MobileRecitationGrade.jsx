import React, { useState, useEffect } from 'react';
import { 
    BookOpen, CheckCircle, WarningCircle, CaretDown, Plus, Minus, 
    Check, Star, ArrowRight, ArrowsClockwise 
} from '@phosphor-icons/react';
import { getStudentsByRing, evaluateRecitation, getEvaluationTemplates, getHalaqat } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { JUZ_AMMA_SURAHS } from '../../../utils/quranData';
import { resolveGradeColor } from '../../../utils/gradeColors';

/**
 * MobileRecitationGrade — شاشة رصد درجات التسميع والسبر الشاملة للموبايل
 */
const MobileRecitationGrade = () => {
    const { user } = useAuthContext();
    const navigate = useNavigate();

    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState('all');
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [recitationType, setRecitationType] = useState('NEW_MEMORIZATION'); // NEW_MEMORIZATION, MINOR_REVISION, MAJOR_REVISION
    
    // Evaluation Modes: PAGE vs SURAH (for Quranic projects)
    const [evalMode, setEvalMode] = useState('PAGE');
    const [selectedSurahs, setSelectedSurahs] = useState([]);
    const [surahFilter, setSurahFilter] = useState('');
    const [lessonTitle, setLessonTitle] = useState('');

    const [pageNumber, setPageNumber] = useState(1);
    const [notes, setNotes] = useState('');
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState({ error: null, success: null });

    const selectedRing = rings.find(r => String(r.id) === String(selectedRingId));
    const currentStudent = students.find(s => s.id === selectedStudentId);
    
    const isReverse = selectedRing?.recitation_direction === 'REVERSE' || 
                      currentStudent?.project?.recitation_direction === 'REVERSE';
    const isCustom = selectedRing?.project_type === 'CUSTOM' || 
                     currentStudent?.project?.project_type === 'CUSTOM';

    const computeDefaultPage = (st, ring) => {
        const rev = ring?.recitation_direction === 'REVERSE' || st?.project?.recitation_direction === 'REVERSE';
        if (rev) {
            return (st?.reached_page && st.reached_page > 1) ? st.reached_page - 1 : 604;
        }
        return (st?.reached_page || 1) + 1;
    };

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const ringsRes = await getHalaqat();
                if (ringsRes.status === 'success') {
                    setRings(ringsRes.data || []);
                }
                const tmplRes = await getEvaluationTemplates();
                if (tmplRes.status === 'success') {
                    setTemplates(tmplRes.data || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchInitial();
    }, []);

    useEffect(() => {
        const loadStudents = async () => {
            setLoading(true);
            try {
                const res = await getStudentsByRing(selectedRingId);
                if (res.status === 'success') {
                    const stList = res.data || [];
                    setStudents(stList);
                    if (stList.length > 0 && !selectedStudentId) {
                        setSelectedStudentId(stList[0].id);
                        setPageNumber(computeDefaultPage(stList[0], selectedRing));
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadStudents();
    }, [selectedRingId]);

    const handleStudentSelect = (stId) => {
        setSelectedStudentId(stId);
        const st = students.find(s => s.id === stId);
        if (st) {
            setPageNumber(computeDefaultPage(st, selectedRing));
        }
    };

    const handleToggleSurah = (surah) => {
        setSelectedSurahs(prev => {
            const exists = prev.includes(surah.number);
            let updated;
            if (exists) {
                updated = prev.filter(num => num !== surah.number);
            } else {
                updated = [...prev, surah.number];
            }
            if (updated.length > 0) {
                const primary = JUZ_AMMA_SURAHS.find(s => s.number === updated[0]);
                if (primary) setPageNumber(primary.page);
            }
            return updated;
        });
    };

    const filteredSurahs = JUZ_AMMA_SURAHS.filter(s => 
        s.name.includes(surahFilter.trim()) || 
        String(s.number).includes(surahFilter.trim())
    );

    const handleGradeSubmit = async (gradeObj) => {
        if (!selectedStudentId) {
            setFeedback({ error: 'الرجاء اختيار طالب أولاً', success: null });
            return;
        }

        if (!isCustom && evalMode === 'SURAH' && selectedSurahs.length === 0) {
            setFeedback({ error: 'الرجاء اختيار سورة واحدة على الأقل من جزء عم', success: null });
            return;
        }

        setSubmitting(true);
        setFeedback({ error: null, success: null });

        try {
            const payload = {
                student_id: selectedStudentId,
                page_number: pageNumber,
                evaluation_grade_id: gradeObj.id,
                grade: gradeObj.name,
                notes: notes,
                recitation_type: recitationType
            };

            if (isCustom && lessonTitle.trim()) {
                payload.lesson_title = lessonTitle.trim();
            }

            if (!isCustom && evalMode === 'SURAH' && selectedSurahs.length > 0) {
                payload.is_surah_evaluation = true;
                if (selectedSurahs.length === 1) {
                    payload.surah_number = selectedSurahs[0];
                } else {
                    payload.surahs_list = selectedSurahs;
                }
            }

            const response = await evaluateRecitation(payload);

            if (response.status === 'success') {
                const data = response.data;
                setFeedback({ error: null, success: response.message || 'تم تسجيل درجة التسميع بنجاح!' });
                setNotes('');
                if (isCustom) setLessonTitle('');
                setSelectedSurahs([]);

                // Update local list
                setStudents(prev => prev.map(s => s.id === selectedStudentId ? { ...s, reached_page: data.reached_page || pageNumber } : s));

                if (data.can_recite_next) {
                    setPageNumber(data.next_page);
                }
            } else {
                setFeedback({ error: response.message || 'حدث خطأ أثناء التقييم', success: null });
            }
        } catch (err) {
            console.error(err);
            setFeedback({ error: 'حدث خطأ في الاتصال بالخادم', success: null });
        } finally {
            setSubmitting(false);
        }
    };

    const gradesList = templates.length > 0 && templates[0].grades
        ? templates[0].grades
        : [
            { id: '1', name: 'ممتاز (100%)', color_code: '#2e7d32' },
            { id: '2', name: 'جيد جداً (85%)', color_code: '#558b2f' },
            { id: '3', name: 'جيد (75%)', color_code: '#ed6c02' },
            { id: '4', name: 'إعادة التسميع', color_code: '#d32f2f' },
        ];

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit' }}>
            {/* Header Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: '#f5f5f5', border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}
                >
                    <ArrowRight size={20} color="#133315" />
                </button>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: '1.2rem', color: '#133315', margin: 0, fontWeight: 'bold' }}>رصد درجات التسميع</h2>
                    {isReverse && (
                        <span style={{ fontSize: '0.72rem', color: '#e65100', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            <ArrowsClockwise size={12} /> تسميع عكسي (تنازلي)
                        </span>
                    )}
                </div>
                <div style={{ width: 32 }}></div>
            </div>

            {/* Recitation Type Selector Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '1.2rem' }}>
                <button
                    onClick={() => setRecitationType('NEW_MEMORIZATION')}
                    style={{
                        padding: '0.6rem 0.2rem',
                        borderRadius: '10px',
                        border: `1px solid ${recitationType === 'NEW_MEMORIZATION' ? '#558b2f' : '#e0e0e0'}`,
                        background: recitationType === 'NEW_MEMORIZATION' ? '#f1f8e9' : '#fff',
                        color: recitationType === 'NEW_MEMORIZATION' ? '#33691e' : '#666',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                    }}
                >
                    الحفظ الجديد
                </button>
                <button
                    onClick={() => setRecitationType('MINOR_REVISION')}
                    style={{
                        padding: '0.6rem 0.2rem',
                        borderRadius: '10px',
                        border: `1px solid ${recitationType === 'MINOR_REVISION' ? '#0288d1' : '#e0e0e0'}`,
                        background: recitationType === 'MINOR_REVISION' ? '#e1f5fe' : '#fff',
                        color: recitationType === 'MINOR_REVISION' ? '#0277bd' : '#666',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                    }}
                >
                    المراجعة الصغرى
                </button>
                <button
                    onClick={() => setRecitationType('MAJOR_REVISION')}
                    style={{
                        padding: '0.6rem 0.2rem',
                        borderRadius: '10px',
                        border: `1px solid ${recitationType === 'MAJOR_REVISION' ? '#f57c00' : '#e0e0e0'}`,
                        background: recitationType === 'MAJOR_REVISION' ? '#fff3e0' : '#fff',
                        color: recitationType === 'MAJOR_REVISION' ? '#e65100' : '#666',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                    }}
                >
                    السبر والامتحان
                </button>
            </div>

            {/* Ring & Student Pickers */}
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '14px', border: '1px solid #eee', marginBottom: '1rem' }}>
                {/* Select Ring */}
                <div style={{ marginBottom: '0.8rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>الحلقة القرآنية</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={selectedRingId}
                            onChange={(e) => setSelectedRingId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 2rem 0.6rem 0.8rem',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '0.88rem',
                                fontWeight: 'bold',
                                color: '#133315',
                                outline: 'none',
                                appearance: 'none',
                                background: '#fff'
                            }}
                        >
                            <option value="all">كل الحلقات</option>
                            {rings.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <CaretDown size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.6rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                </div>

                {/* Select Student */}
                <div>
                    <label style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>اختر الطالب</label>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={selectedStudentId}
                            onChange={(e) => handleStudentSelect(e.target.value)}
                            disabled={loading || students.length === 0}
                            style={{
                                width: '100%',
                                padding: '0.6rem 2rem 0.6rem 0.8rem',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontSize: '0.88rem',
                                fontWeight: 'bold',
                                color: '#133315',
                                outline: 'none',
                                appearance: 'none',
                                background: '#fff'
                            }}
                        >
                            {students.length === 0 ? (
                                <option value="">لا يوجد طلاب</option>
                            ) : (
                                students.map(s => (
                                    <option key={s.id} value={s.id}>{s.full_name} (وصل صفحة {s.reached_page || 1})</option>
                                ))
                            )}
                        </select>
                        <CaretDown size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.6rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                </div>
            </div>

            {/* Custom Project Lesson Title */}
            {isCustom && (
                <div style={{ background: '#fff', padding: '1rem', borderRadius: '14px', border: '1px solid #eee', marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#133315', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>
                        عنوان الدرس / المحتوى المخصص:
                    </label>
                    <input
                        type="text"
                        placeholder="مثال: مخارج الحروف وصفاتها..."
                        value={lessonTitle}
                        onChange={e => setLessonTitle(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.65rem',
                            borderRadius: '8px',
                            border: '1.5px solid #81b255',
                            fontSize: '0.88rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>
            )}

            {/* Evaluation Mode Toggle (Quranic: Pages vs Short Surahs) */}
            {!isCustom && (
                <div style={{ display: 'flex', background: '#e8f5e9', borderRadius: '10px', padding: '3px', marginBottom: '1rem' }}>
                    <button
                        type="button"
                        onClick={() => setEvalMode('PAGE')}
                        style={{
                            flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px',
                            fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer',
                            background: evalMode === 'PAGE' ? '#fff' : 'transparent',
                            color: evalMode === 'PAGE' ? '#2e7d32' : '#666',
                            boxShadow: evalMode === 'PAGE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        التسميع بالصفحات
                    </button>
                    <button
                        type="button"
                        onClick={() => setEvalMode('SURAH')}
                        style={{
                            flex: 1, padding: '0.5rem', border: 'none', borderRadius: '8px',
                            fontWeight: 'bold', fontSize: '0.82rem', cursor: 'pointer',
                            background: evalMode === 'SURAH' ? '#fff' : 'transparent',
                            color: evalMode === 'SURAH' ? '#2e7d32' : '#666',
                            boxShadow: evalMode === 'SURAH' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        قصار السور (جزء عم)
                    </button>
                </div>
            )}

            {/* Short Surahs Selector */}
            {!isCustom && evalMode === 'SURAH' && (
                <div style={{ background: '#fff', padding: '1rem', borderRadius: '14px', border: '1px solid #eee', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#133315' }}>سور جزء عم (78-114):</span>
                        {selectedSurahs.length > 0 && (
                            <span style={{ fontSize: '0.75rem', background: '#e8f5e9', color: '#2e7d32', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                                تم اختيار {selectedSurahs.length}
                            </span>
                        )}
                    </div>

                    <input
                        type="text"
                        placeholder="ابحث عن سورة..."
                        value={surahFilter}
                        onChange={e => setSurahFilter(e.target.value)}
                        style={{
                            width: '100%', padding: '0.45rem', borderRadius: '8px',
                            border: '1px solid #ddd', fontSize: '0.82rem', marginBottom: '0.6rem',
                            outline: 'none', boxSizing: 'border-box'
                        }}
                    />

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '140px', overflowY: 'auto' }}>
                        {filteredSurahs.map(surah => {
                            const isSelected = selectedSurahs.includes(surah.number);
                            return (
                                <button
                                    key={surah.number}
                                    type="button"
                                    onClick={() => handleToggleSurah(surah)}
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: isSelected ? 'bold' : 'normal',
                                        border: `1px solid ${isSelected ? '#2e7d32' : '#ddd'}`,
                                        background: isSelected ? '#2e7d32' : '#f9f9f9',
                                        color: isSelected ? '#fff' : '#333',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {surah.name} ({surah.number})
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Target Page Selector */}
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #eee', textAlign: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>
                    {isCustom ? 'رقم الدرس / الصفحة المراد تقييمها' : 'رقم الصفحة في المصحف'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '0.5rem' }}>
                    <button
                        onClick={() => setPageNumber(prev => Math.max(1, prev - 1))}
                        style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid #ddd', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                        <Minus size={20} color="#133315" />
                    </button>
                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f57c00' }}>{pageNumber}</span>
                    <button
                        onClick={() => setPageNumber(prev => Math.min(604, prev + 1))}
                        style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid #ddd', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                        <Plus size={20} color="#133315" />
                    </button>
                </div>
                {currentStudent && (
                    <span style={{ fontSize: '0.78rem', color: '#888' }}>
                        آخر صفحة تم الوصول إليها: {currentStudent.reached_page || 1}
                    </span>
                )}
            </div>

            {/* Notes Input */}
            <div style={{ marginBottom: '1rem' }}>
                <input
                    type="text"
                    placeholder="إضافة ملاحظة على التسميع..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.7rem',
                        borderRadius: '10px',
                        border: '1px solid #ddd',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                    }}
                />
            </div>

            {/* Feedback Alerts */}
            {feedback.success && (
                <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.85rem', textAlign: 'center', fontWeight: 'bold' }}>
                    {feedback.success}
                </div>
            )}
            {feedback.error && (
                <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.85rem', textAlign: 'center' }}>
                    {feedback.error}
                </div>
            )}

            {/* Evaluation Buttons Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {gradesList.map(g => (
                    <button
                        key={g.id}
                        onClick={() => handleGradeSubmit(g)}
                        disabled={submitting || !selectedStudentId}
                        style={{
                            backgroundColor: resolveGradeColor(g.color_code),
                            color: '#fff',
                            border: 'none',
                            padding: '1rem',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '0.95rem',
                            cursor: submitting ? 'wait' : 'pointer',
                            opacity: submitting || !selectedStudentId ? 0.7 : 1,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                        }}
                    >
                        {g.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MobileRecitationGrade;
