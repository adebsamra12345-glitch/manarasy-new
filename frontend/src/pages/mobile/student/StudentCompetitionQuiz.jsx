import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, Warning, ArrowRight, ArrowLeft } from '@phosphor-icons/react';
import { startStudentCompetition, submitStudentCompetition } from '../../../services/pointsAndRewardsApi';
import './studentCompetitions.css';

const StudentCompetitionQuiz = ({ competitionId, onFinished }) => {
    const [loading, setLoading] = useState(true);
    const [quizData, setQuizData] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resultData, setResultData] = useState(null);

    useEffect(() => {
        initQuiz();
    }, [competitionId]);

    const initQuiz = async () => {
        try {
            const res = await startStudentCompetition(competitionId);
            if (res.status === 'success') {
                setQuizData(res.data);
                setSecondsLeft((res.data.duration_minutes || 30) * 60);
            }
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'تعذر بدء المسابقة');
            onFinished();
        } finally {
            setLoading(false);
        }
    };

    // Countdown Timer
    useEffect(() => {
        if (secondsLeft <= 0 || resultData) return;
        const interval = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    handleSubmitQuiz(); // Auto submit
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [secondsLeft, resultData]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleSelectOption = (questionId, option) => {
        setAnswers({ ...answers, [questionId]: option });
    };

    const handleTextChange = (questionId, text) => {
        setAnswers({ ...answers, [questionId]: text });
    };

    const handleSubmitQuiz = async () => {
        if (isSubmitting || !quizData) return;
        setIsSubmitting(true);

        const answersPayload = quizData.questions.map((q) => ({
            question_id: q.id,
            student_answer: answers[q.id] || ''
        }));

        try {
            const res = await submitStudentCompetition(competitionId, {
                participation_id: quizData.participation_id,
                answers: answersPayload
            });
            if (res.status === 'success') {
                setResultData(res.data);
            }
        } catch (err) {
            console.error('Submit error:', err);
            alert('حدث خطأ أثناء تسليم الإجابات');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="m-comp-container" style={{ textAlign: 'center', padding: 40 }}>
                <p>جاري تحضير أسئلة المسابقة والعداد الزمني...</p>
            </div>
        );
    }

    if (resultData) {
        return (
            <div className="m-comp-container">
                <div style={{
                    background: '#ffffff', borderRadius: 20, padding: 32,
                    textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}>
                    <CheckCircle size={60} color="#15803d" weight="fill" style={{ marginBottom: 16 }} />
                    <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                        تم تسليم المسابقة بنجاح!
                    </h2>
                    <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
                        شكراً لمشاركتك المتميزة في المسابقة.
                    </p>

                    <div style={{
                        background: '#f8fafc', padding: 20, borderRadius: 16,
                        display: 'flex', justifyContent: 'space-around', marginBottom: 24
                    }}>
                        <div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>درجة الأسئلة المؤتمتة</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                                {resultData.score} / {resultData.total_possible}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>النقاط المكتسبة</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>
                                +{resultData.points_gained}
                            </div>
                        </div>
                    </div>

                    {resultData.has_essay_under_review && (
                        <div style={{
                            backgroundColor: '#fffbeb', border: '1px solid #fde68a',
                            color: '#92400e', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 24
                        }}>
                            <Warning size={18} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                            تتضمن المسابقة أسئلة تحريرية/مقالية وهي حالياً قيد مراجعة وتصحيح المعلم.
                        </div>
                    )}

                    <button
                        className="m-comp-btn-start"
                        onClick={onFinished}
                    >
                        العودة للمسابقات
                    </button>
                </div>
            </div>
        );
    }

    const currentQ = quizData?.questions[currentIndex];
    const totalQuestions = quizData?.questions?.length || 0;

    return (
        <div className="m-comp-container">
            {/* Top Bar */}
            <div className="m-quiz-header">
                <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{quizData.title}</h3>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                        السؤال {currentIndex + 1} من {totalQuestions}
                    </span>
                </div>
                <div className="m-timer-box">
                    <Clock size={18} />
                    <span>{formatTime(secondsLeft)}</span>
                </div>
            </div>

            {/* Question Card */}
            {currentQ && (
                <div className="m-question-card">
                    <div className="m-question-number">سؤال ({currentQ.points} درجات)</div>
                    <div className="m-question-text">{currentQ.question_text}</div>

                    {/* Multiple Choice Options */}
                    {currentQ.question_type === 'MULTIPLE_CHOICE' && currentQ.options && (
                        <div>
                            {currentQ.options.map((opt, idx) => (
                                <div
                                    key={idx}
                                    className={`m-option-item ${answers[currentQ.id] === opt ? 'selected' : ''}`}
                                    onClick={() => handleSelectOption(currentQ.id, opt)}
                                >
                                    <div style={{
                                        width: 20, height: 20, borderRadius: '50%',
                                        border: answers[currentQ.id] === opt ? '6px solid #15803d' : '2px solid #cbd5e1'
                                    }} />
                                    <span>{opt}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* True/False Options */}
                    {currentQ.question_type === 'TRUE_FALSE' && (
                        <div>
                            {['صح', 'خطأ'].map((opt, idx) => (
                                <div
                                    key={idx}
                                    className={`m-option-item ${answers[currentQ.id] === opt ? 'selected' : ''}`}
                                    onClick={() => handleSelectOption(currentQ.id, opt)}
                                >
                                    <div style={{
                                        width: 20, height: 20, borderRadius: '50%',
                                        border: answers[currentQ.id] === opt ? '6px solid #15803d' : '2px solid #cbd5e1'
                                    }} />
                                    <span>{opt}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Essay/Text Answer */}
                    {currentQ.question_type === 'ESSAY' && (
                        <div>
                            <textarea
                                rows="5"
                                placeholder="اكتب إجابتك التحريرية والشرح هنا بالتفصيل..."
                                style={{
                                    width: '100%', padding: 12, borderRadius: 12,
                                    border: '1px solid #cbd5e1', outline: 'none', fontFamily: 'inherit', fontSize: 14
                                }}
                                value={answers[currentQ.id] || ''}
                                onChange={(e) => handleTextChange(currentQ.id, e.target.value)}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Footer Navigation */}
            <div className="m-quiz-footer">
                <button
                    className="m-btn-nav"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    style={{ opacity: currentIndex === 0 ? 0.5 : 1 }}
                >
                    <ArrowRight size={16} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                    السابق
                </button>

                {currentIndex < totalQuestions - 1 ? (
                    <button
                        className="m-btn-nav primary"
                        onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                    >
                        التالي
                        <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    </button>
                ) : (
                    <button
                        className="m-btn-nav primary"
                        onClick={handleSubmitQuiz}
                        disabled={isSubmitting}
                        style={{ backgroundColor: '#047857' }}
                    >
                        {isSubmitting ? 'جاري التسليم...' : 'تسليم الحل وإنهاء المسابقة'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default StudentCompetitionQuiz;
