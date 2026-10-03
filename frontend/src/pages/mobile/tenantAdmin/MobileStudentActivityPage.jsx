import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, CalendarBlank, ChartLineUp, BookOpen, Clock, ShieldCheck, ArrowsClockwise } from '@phosphor-icons/react';
import { getStudentActivityData } from '../../../services/api/tenantService';

const MobileStudentActivityPage = () => {
    const { studentId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [activityData, setActivityData] = useState(null);
    const [activeTab, setActiveTab] = useState('recitations'); // 'recitations' | 'attendance'

    useEffect(() => {
        const fetchActivity = async () => {
            setLoading(true);
            try {
                const res = await getStudentActivityData(studentId, { time_filter: 'all' });
                if (res?.status === 'success' && res.data) {
                    setActivityData(res.data);
                }
            } catch (err) {} finally {
                setLoading(false);
            }
        };
        fetchActivity();
    }, [studentId]);

    const studentInfo = activityData?.student_info || {};
    const stats = activityData?.summary_stats || {};

    return (
        <div style={{ padding: '1rem', paddingBottom: '2rem', direction: 'rtl', fontFamily: 'inherit', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button onClick={() => navigate(-1)} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
                    <ArrowRight size={18} />
                </button>
                <h2 style={{ fontSize: '1.2rem', color: '#133315', fontWeight: 'bold', margin: 0 }}>سجل نشاط الطالب</h2>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#558b2f' }}><ArrowsClockwise size={32} className="spin-animation" /></div>
            ) : activityData ? (
                <>
                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #eee', marginBottom: '1.5rem', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        <div style={{ background: '#f0fdf4', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                            <GraduationCap size={32} color="#558b2f" weight="duotone" />
                        </div>
                        <h2 style={{ margin: '0 0 0.5rem 0', color: '#133315', fontSize: '1.3rem' }}>{studentInfo.full_name}</h2>
                        <div style={{ fontSize: '0.9rem', color: '#666', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                            <span style={{ background: '#f5f5f5', padding: '0.3rem 0.8rem', borderRadius: '20px' }}>الحلقة: {studentInfo.halaqa_name}</span>
                            <span style={{ background: '#f5f5f5', padding: '0.3rem 0.8rem', borderRadius: '20px' }}>المعلم: {studentInfo.teacher_name}</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#133315' }}>{stats.total_attendance || 0}%</div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>نسبة الحضور</div>
                        </div>
                        <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#133315' }}>{stats.total_pages_memorized || 0}</div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>صفحات الحفظ</div>
                        </div>
                        <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#133315' }}>{stats.total_pages_reviewed || 0}</div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>صفحات المراجعة</div>
                        </div>
                        <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#133315' }}>{stats.rating || 'مستمر'}</div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>التقييم العام</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: '1rem' }}>
                        <button onClick={() => setActiveTab('recitations')} style={{ flex: 1, padding: '0.8rem', background: 'none', border: 'none', borderBottom: activeTab === 'recitations' ? '3px solid #558b2f' : '3px solid transparent', color: activeTab === 'recitations' ? '#558b2f' : '#666', fontWeight: 'bold', fontSize: '1rem' }}>
                            التسميع
                        </button>
                        <button onClick={() => setActiveTab('attendance')} style={{ flex: 1, padding: '0.8rem', background: 'none', border: 'none', borderBottom: activeTab === 'attendance' ? '3px solid #558b2f' : '3px solid transparent', color: activeTab === 'attendance' ? '#558b2f' : '#666', fontWeight: 'bold', fontSize: '1rem' }}>
                            الحضور والسلوك
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {activeTab === 'recitations' ? (
                            (activityData.recitations_history?.length > 0) ? (
                                activityData.recitations_history.map((rec, idx) => (
                                    <div key={idx} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 'bold', color: '#133315' }}>{rec.recitation_type}</span>
                                            <span style={{ fontSize: '0.85rem', color: '#888' }}>{rec.date}</span>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
                                            من: {rec.from_surah} ({rec.from_ayah}) - إلى: {rec.to_surah} ({rec.to_ayah})
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>الصفحة: {rec.page_number}</span>
                                            <span style={{ fontWeight: 'bold', color: '#2e7d32', background: '#e8f5e9', padding: '0.2rem 0.6rem', borderRadius: '8px' }}>{rec.grade}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>لا توجد سجلات تسميع</div>
                            )
                        ) : (
                            (activityData.attendance_history?.length > 0) ? (
                                activityData.attendance_history.map((att, idx) => (
                                    <div key={idx} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 'bold', color: att.status === 'حاضر' || att.status === 'PRESENT' ? '#2e7d32' : '#c62828' }}>{att.status === 'PRESENT' ? 'حاضر' : att.status === 'ABSENT' ? 'غائب' : att.status}</span>
                                            <span style={{ fontSize: '0.85rem', color: '#888' }}>{att.session_date}</span>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: '#555' }}>
                                            السلوك: {att.behavior || 'غير محدد'} ({att.behavior_score}/10)
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>لا توجد سجلات حضور</div>
                            )
                        )}
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default MobileStudentActivityPage;
