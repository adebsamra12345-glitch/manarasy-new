import React, { useState, useEffect } from 'react';
import { Gift, Clock, Trophy, CheckCircle, Play, ArrowLeft } from '@phosphor-icons/react';
import { getStudentCompetitions } from '../../../services/pointsAndRewardsApi';
import StudentCompetitionQuiz from './StudentCompetitionQuiz';
import './studentCompetitions.css';

const StudentCompetitions = () => {
    const [competitions, setCompetitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeQuizId, setActiveQuizId] = useState(null);

    useEffect(() => {
        loadCompetitions();
    }, []);

    const loadCompetitions = async () => {
        setLoading(true);
        try {
            const res = await getStudentCompetitions();
            if (res.status === 'success') {
                setCompetitions(res.data);
            }
        } catch (err) {
            console.error('Error loading student competitions:', err);
        } finally {
            setLoading(false);
        }
    };

    if (activeQuizId) {
        return (
            <StudentCompetitionQuiz
                competitionId={activeQuizId}
                onFinished={() => {
                    setActiveQuizId(null);
                    loadCompetitions();
                }}
            />
        );
    }

    return (
        <div className="m-comp-container">
            <div className="m-comp-header">
                <div className="m-comp-title">
                    <Gift size={26} color="#15803d" />
                    <span>المسابقات التفاعلية</span>
                </div>
            </div>

            {loading ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>جاري تحميل المسابقات...</p>
            ) : competitions.length === 0 ? (
                <div style={{ textAlign: 'center', background: '#ffffff', padding: 32, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', margin: 0 }}>لا توجد مسابقات متاحة حالياً</p>
                </div>
            ) : (
                competitions.map((c) => (
                    <div className="m-comp-card" key={c.id}>
                        <div className="m-comp-card-top">
                            <div className="m-comp-card-title">{c.title}</div>
                            <div className="m-comp-points-badge">
                                <Trophy size={16} />
                                <span>+{c.points_reward} نقطة</span>
                            </div>
                        </div>

                        <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                            {c.description || 'مسابقة تفاعلية لاختبار الحفظ والمعلومات العامة'}
                        </p>

                        <div className="m-comp-meta">
                            <span><Clock size={16} style={{ verticalAlign: 'middle', marginLeft: 4 }} /> {c.duration_minutes} دقيقة</span>
                            <span>الأسئلة: {c.questions_count}</span>
                        </div>

                        {c.has_attempted ? (
                            <div style={{
                                backgroundColor: '#f1f5f9', padding: 10, borderRadius: 10,
                                textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#047857'
                            }}>
                                <CheckCircle size={16} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                                تم التسليم (النتيجة: {c.score} من {c.total_possible_score}) {c.points_awarded > 0 && `| +${c.points_awarded} نقاط`}
                            </div>
                        ) : (
                            <button
                                className="m-comp-btn-start"
                                onClick={() => setActiveQuizId(c.id)}
                            >
                                <Play size={18} weight="fill" />
                                <span>ابدأ المسابقة الآن</span>
                            </button>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

export default StudentCompetitions;
