import React, { useState, useEffect } from 'react';
import {
    Gift, Trophy, Star, Checks, MagnifyingGlass, Plus, X,
    ArrowsClockwise, PencilSimple, Trash, WarningCircle, CheckCircle,
    Coins, ListChecks, Receipt, CaretDown, User
} from '@phosphor-icons/react';
import {
    getRewardsList,
    getAdminRewardClaims,
    getStudentsPointsList,
    grantBonusPoints,
    redeemReward,
    getPointsTransactions,
    getCompetitionsList,
    createReward,
    updateReward,
    deleteReward,
    createCompetition,
    updateCompetition,
    deleteCompetition,
    getCompetitionDetail,
    addCompetitionQuestion,
    updateCompetitionQuestion,
    deleteCompetitionQuestion
} from '../../../services/pointsAndRewardsApi';

const MobilePointsAndRewards = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Data
    const [students, setStudents] = useState([]);
    const [rewards, setRewards] = useState([]);
    const [claims, setClaims] = useState([]);
    const [competitions, setCompetitions] = useState([]);

    // Toast
    const [toast, setToast] = useState({ message: '', type: 'success' });

    // Modals state - Points Operations (Unifying with Desktop)
    const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
    const [selectedStudentForBonus, setSelectedStudentForBonus] = useState(null);
    const [bonusReason, setBonusReason] = useState('');
    const [bonusSubmitting, setBonusSubmitting] = useState(false);

    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [selectedStudentForRedeem, setSelectedStudentForRedeem] = useState(null);
    const [selectedRewardId, setSelectedRewardId] = useState('');
    const [redeemNotes, setRedeemNotes] = useState('');
    const [redeemSubmitting, setRedeemSubmitting] = useState(false);

    const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
    const [ledgerStudent, setLedgerStudent] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    // Modals state - Rewards
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [editingReward, setEditingReward] = useState(null);
    const [rewardForm, setRewardForm] = useState({
        name: '',
        points_cost: 50,
        stock_quantity: 0,
        description: '',
        image: ''
    });

    // Modals state - Competitions
    const [isCompModalOpen, setIsCompModalOpen] = useState(false);
    const [editingComp, setEditingComp] = useState(null);
    const [compForm, setCompForm] = useState({
        title: '',
        duration_minutes: 30,
        points_reward: 10,
        max_attempts: 1,
        description: ''
    });

    // Modals state - Confirm Delete
    const [deleteModal, setDeleteModal] = useState({
        open: false,
        type: '', // 'reward' | 'competition' | 'question'
        id: null,
        title: ''
    });

    const [submitting, setSubmitting] = useState(false);

    // Questions State (Nested in Competitions)
    const [expandedCompId, setExpandedCompId] = useState(null);
    const [compQuestions, setCompQuestions] = useState({});
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [selectedCompForQuestion, setSelectedCompForQuestion] = useState(null);
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [questionFormData, setQuestionFormData] = useState({
        question_text: '',
        question_type: 'MULTIPLE_CHOICE',
        options: ['', '', '', ''],
        correct_answer: '',
        points: 1.0
    });

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast({ message: '', type: 'success' }), 4000);
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'points' || activeTab === 'overview') {
                const res = await getStudentsPointsList({ search: searchQuery });
                if (res?.status === 'success') {
                    setStudents(res.data || []);
                }
                // Ensure rewards are also loaded for redemption modal in points tab
                const rewRes = await getRewardsList();
                if (rewRes?.status === 'success') {
                    setRewards(rewRes.data || []);
                }
            }
            if (activeTab === 'rewards' || activeTab === 'overview') {
                const rewRes = await getRewardsList();
                if (rewRes?.status === 'success') setRewards(rewRes.data || []);
            }
            if (activeTab === 'claims' || activeTab === 'overview') {
                const claimRes = await getAdminRewardClaims({ status: 'ALL', search: searchQuery });
                if (claimRes?.status === 'success') setClaims(claimRes.data || []);
            }
            if (activeTab === 'competitions' || activeTab === 'overview') {
                const compRes = await getCompetitionsList();
                if (compRes?.status === 'success') setCompetitions(compRes.data || []);
            }
        } catch (err) {
            console.error('Error loading points data:', err);
        } finally {
            setLoading(false);
        }
    };

    // --- Points Actions (Unified with Desktop) ---
    const handleOpenBonusModal = (student = null) => {
        setSelectedStudentForBonus(student || (students.length > 0 ? students[0] : null));
        setBonusReason('');
        setIsBonusModalOpen(true);
    };

    const handleGrantBonus = async (e) => {
        e.preventDefault();
        if (!selectedStudentForBonus) return;
        if (!bonusReason.trim()) {
            showToast('يرجى كتابة سبب المكافأة', 'error');
            return;
        }

        setBonusSubmitting(true);
        try {
            const res = await grantBonusPoints({
                student_id: selectedStudentForBonus.id,
                reason: bonusReason.trim()
            });

            if (res?.status === 'success') {
                showToast(res.message || 'تم منح +1 نقطة مكافأة سلوكية بنجاح');
                setIsBonusModalOpen(false);
                setBonusReason('');
                loadData();
            } else {
                showToast(res?.message || 'فشلت عملية المنح', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء منح النقاط', 'error');
        } finally {
            setBonusSubmitting(false);
        }
    };

    const handleOpenRedeemModal = (student) => {
        setSelectedStudentForRedeem(student);
        setSelectedRewardId(rewards.length > 0 ? rewards[0].id : '');
        setRedeemNotes('');
        setIsRedeemModalOpen(true);
    };

    const handleRedeemSubmit = async (e) => {
        e.preventDefault();
        if (!selectedStudentForRedeem || !selectedRewardId) return;

        setRedeemSubmitting(true);
        try {
            const res = await redeemReward({
                student_id: selectedStudentForRedeem.id,
                reward_id: selectedRewardId,
                notes: redeemNotes
            });

            if (res?.status === 'success') {
                showToast(res.message || 'تم استبدال وصرف المكافأة بنجاح');
                setIsRedeemModalOpen(false);
                loadData();
            } else {
                showToast(res?.message || 'فشلت عملية الاستبدال', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء الاستبدال', 'error');
        } finally {
            setRedeemSubmitting(false);
        }
    };

    const handleOpenLedgerModal = async (student) => {
        setLedgerStudent(student);
        setIsLedgerModalOpen(true);
        setLedgerLoading(true);
        try {
            const res = await getPointsTransactions({ student_id: student.id });
            if (res?.status === 'success') {
                setTransactions(res.data || []);
            }
        } catch (err) {
            console.error('Error fetching transactions:', err);
        } finally {
            setLedgerLoading(false);
        }
    };

    // --- Reward Handlers ---
    const handleOpenRewardModal = (reward = null) => {
        if (reward) {
            setEditingReward(reward);
            setRewardForm({
                name: reward.name || '',
                points_cost: reward.points_cost || 50,
                stock_quantity: reward.stock_quantity ?? -1,
                description: reward.description || '',
                image: reward.image || ''
            });
        } else {
            setEditingReward(null);
            setRewardForm({
                name: '',
                points_cost: 50,
                stock_quantity: 0,
                description: '',
                image: ''
            });
        }
        setIsRewardModalOpen(true);
    };

    const handleSaveReward = async (e) => {
        e.preventDefault();
        if (!rewardForm.name.trim()) {
            showToast('يرجى كتابة اسم المكافأة', 'error');
            return;
        }
        if (rewardForm.points_cost <= 0) {
            showToast('يجب أن تكون تكلفة النقاط أكبر من الصفر', 'error');
            return;
        }

        setSubmitting(true);
        try {
            if (editingReward) {
                const res = await updateReward(editingReward.id, rewardForm);
                if (res?.status === 'success') {
                    showToast('تم تعديل المكافأة بنجاح');
                    setIsRewardModalOpen(false);
                    loadData();
                }
            } else {
                const res = await createReward(rewardForm);
                if (res?.status === 'success') {
                    showToast('تمت إضافة المكافأة بنجاح');
                    setIsRewardModalOpen(false);
                    loadData();
                }
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'فشل حفظ المكافأة', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // --- Competition Handlers ---
    const handleOpenCompModal = (comp = null) => {
        if (comp) {
            setEditingComp(comp);
            setCompForm({
                title: comp.title || '',
                duration_minutes: comp.duration_minutes || 30,
                points_reward: comp.points_reward || 10,
                max_attempts: comp.max_attempts || 1,
                description: comp.description || ''
            });
        } else {
            setEditingComp(null);
            setCompForm({
                title: '',
                duration_minutes: 30,
                points_reward: 10,
                max_attempts: 1,
                description: ''
            });
        }
        setIsCompModalOpen(true);
    };

    const handleSaveComp = async (e) => {
        e.preventDefault();
        if (!compForm.title.trim()) {
            showToast('يرجى كتابة عنوان المسابقة', 'error');
            return;
        }
        if (compForm.duration_minutes <= 0) {
            showToast('يجب أن تكون مدة المسابقة دقيقة واحدة على الأقل', 'error');
            return;
        }
        if (compForm.points_reward <= 0) {
            showToast('يجب أن تكون نقاط الجائزة أكبر من الصفر', 'error');
            return;
        }

        setSubmitting(true);
        try {
            if (editingComp) {
                const res = await updateCompetition(editingComp.id, compForm);
                if (res?.status === 'success') {
                    showToast('تم تعديل المسابقة بنجاح');
                    setIsCompModalOpen(false);
                    loadData();
                }
            } else {
                const res = await createCompetition(compForm);
                if (res?.status === 'success') {
                    showToast('تمت إضافة المسابقة بنجاح');
                    setIsCompModalOpen(false);
                    loadData();
                }
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'فشل حفظ المسابقة', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // ==================
    // Question Handlers
    // ==================
    const loadCompQuestions = async (compId) => {
        try {
            const res = await getCompetitionDetail(compId);
            if (res?.status === 'success') {
                setCompQuestions(prev => ({ ...prev, [compId]: res.data.questions }));
            }
        } catch (err) {
            console.error('Failed to load questions', err);
        }
    };

    const handleToggleCompQuestions = (compId) => {
        if (expandedCompId === compId) {
            setExpandedCompId(null);
            return;
        }
        setExpandedCompId(compId);
        if (!compQuestions[compId]) {
            loadCompQuestions(compId);
        }
    };

    const handleOpenAddQuestion = (comp) => {
        setSelectedCompForQuestion(comp);
        setEditingQuestion(null);
        setQuestionFormData({
            question_text: '',
            question_type: 'MULTIPLE_CHOICE',
            options: ['', '', '', ''],
            correct_answer: '',
            points: 1.0
        });
        setIsQuestionModalOpen(true);
    };

    const handleOpenEditQuestion = (comp, q) => {
        setSelectedCompForQuestion(comp);
        setEditingQuestion(q);
        setQuestionFormData({
            question_text: q.question_text || '',
            question_type: q.question_type || 'MULTIPLE_CHOICE',
            options: q.options && q.options.length === 4 ? q.options : ['', '', '', ''],
            correct_answer: q.correct_answer || '',
            points: q.points || 1.0
        });
        setIsQuestionModalOpen(true);
    };

    const handleSaveQuestion = async (e) => {
        e.preventDefault();
        if (!selectedCompForQuestion) return;
        setSubmitting(true);
        try {
            if (editingQuestion) {
                await updateCompetitionQuestion(editingQuestion.id, questionFormData);
                showToast('تم تحديث السؤال بنجاح');
            } else {
                await addCompetitionQuestion(selectedCompForQuestion.id, questionFormData);
                showToast('تمت إضافة السؤال بنجاح');
            }
            setIsQuestionModalOpen(false);
            loadCompQuestions(selectedCompForQuestion.id);
            loadData(); // To update total question counts
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'فشل حفظ السؤال', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // --- Delete Handlers ---
    const confirmDelete = (type, item, compId = null) => {
        setDeleteModal({
            open: true,
            type,
            id: item.id,
            title: type === 'reward' ? item.name : type === 'question' ? 'السؤال المحدد' : item.title,
            parentId: compId
        });
    };

    const handleExecuteDelete = async () => {
        const { type, id, parentId } = deleteModal;
        if (!id) return;
        setSubmitting(true);
        try {
            if (type === 'reward') {
                const res = await deleteReward(id);
                if (res?.status === 'success') {
                    showToast('تم حذف المكافأة بنجاح');
                    setDeleteModal({ open: false, type: '', id: null, title: '' });
                    loadData();
                }
            } else if (type === 'competition') {
                const res = await deleteCompetition(id);
                if (res?.status === 'success') {
                    showToast('تم حذف المسابقة بنجاح');
                    setDeleteModal({ open: false, type: '', id: null, title: '' });
                    loadData();
                }
            } else if (type === 'question') {
                const res = await deleteCompetitionQuestion(id);
                if (res?.status === 'success') {
                    showToast('تم حذف السؤال بنجاح');
                    setDeleteModal({ open: false, type: '', id: null, title: '' });
                    if (parentId) loadCompQuestions(parentId);
                    loadData();
                }
            }
        } catch (err) {
            showToast('حدث خطأ أثناء تنفيذ الحذف', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'نظرة عامة' },
        { id: 'points', label: 'النقاط' },
        { id: 'rewards', label: 'المتجر' },
        { id: 'claims', label: 'الطلبات' },
        { id: 'competitions', label: 'المسابقات' }
    ];

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit', background: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box', width: '100%', overflowX: 'hidden' }}>
            {/* Toast Feedback */}
            {toast.message && (
                <div style={{
                    position: 'fixed',
                    top: '1rem',
                    left: '1rem',
                    right: '1rem',
                    zIndex: 9999,
                    padding: '0.8rem 1rem',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    color: toast.type === 'error' ? '#991b1b' : '#166534',
                    border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                }}>
                    {toast.type === 'error' ? <WarningCircle size={20} /> : <CheckCircle size={20} />}
                    <span style={{ flex: 1 }}>{toast.message}</span>
                    <button onClick={() => setToast({ message: '', type: 'success' })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.3rem', color: '#133315', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Star size={24} color="#558b2f" weight="fill" /> النقاط والمكافآت
                </h2>
            </div>

            {/* Dynamic Wrapped Tabs */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '0.55rem 0.95rem',
                            borderRadius: '20px',
                            border: 'none',
                            background: activeTab === tab.id ? '#133315' : '#e2e8f0',
                            color: activeTab === tab.id ? '#fff' : '#334155',
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#558b2f' }}>
                    <ArrowsClockwise size={32} className="spin-animation" />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* 1. OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.8rem' }}>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                <Coins size={28} color="#f59e0b" weight="fill" style={{ marginBottom: '0.4rem' }} />
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#133315' }}>
                                    {students.reduce((acc, s) => acc + (s.points || s.total_points || 0), 0)}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>إجمالي النقاط</div>
                            </div>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                <Gift size={28} color="#16a34a" style={{ marginBottom: '0.4rem' }} />
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#133315' }}>{rewards.length}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>المكافآت المتاحة</div>
                            </div>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                <Checks size={28} color="#2563eb" style={{ marginBottom: '0.4rem' }} />
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#133315' }}>
                                    {claims.filter(c => c.status === 'PENDING').length}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>طلبات معلقة</div>
                            </div>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                <Trophy size={28} color="#9333ea" style={{ marginBottom: '0.4rem' }} />
                                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#133315' }}>{competitions?.length || 0}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>مسابقات فعالة</div>
                            </div>
                        </div>
                    )}

                    {/* 2. POINTS TAB (Unified functionally with Desktop) */}
                    {activeTab === 'points' && (
                        <>
                            {/* Toolbar: Search + Add Bonus */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="بحث باسم الطالب أو رقم الهوية..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && loadData()}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 2.4rem 0.75rem 0.9rem',
                                            borderRadius: '12px',
                                            border: '1px solid #cbd5e1',
                                            boxSizing: 'border-box',
                                            fontSize: '0.9rem',
                                            outline: 'none'
                                        }}
                                    />
                                    <MagnifyingGlass size={18} color="#94a3b8" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                                </div>
                                <button
                                    onClick={() => handleOpenBonusModal()}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem',
                                        background: '#133315',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.65rem 1rem',
                                        borderRadius: '12px',
                                        fontSize: '0.9rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 8px rgba(19, 51, 21, 0.15)'
                                    }}
                                >
                                    <Plus size={18} weight="bold" />
                                    منح مكافأة سلوكية (+1)
                                </button>
                            </div>

                            {/* Students List Cards */}
                            {students.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>لا يوجد طلاب مطابقين للبحث</p>
                            ) : (
                                students.map(student => (
                                    <div
                                        key={student.id}
                                        style={{
                                            background: '#fff',
                                            padding: '1rem',
                                            borderRadius: '14px',
                                            border: '1px solid #e2e8f0',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                                        }}
                                    >
                                        {/* Card Header: Avatar, Name, National ID, Points Badge */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    borderRadius: '50%',
                                                    background: '#ecfdf5',
                                                    color: '#047857',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 'bold',
                                                    fontSize: '1rem',
                                                    flexShrink: 0
                                                }}>
                                                    {student.full_name?.charAt(0) || 'ط'}
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: '0 0 0.15rem 0', color: '#133315', fontSize: '0.98rem' }}>{student.full_name}</h4>
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                        {student.national_id ? `هوية: ${student.national_id}` : (student.registration_number ? `قيد: ${student.registration_number}` : 'بدون رقم هوية')}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{
                                                background: '#fef3c7',
                                                color: '#b45309',
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '20px',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                                fontSize: '0.9rem',
                                                flexShrink: 0
                                            }}>
                                                <Coins size={15} weight="fill" />
                                                <span>{student.points ?? student.total_points ?? 0} نقطة</span>
                                            </div>
                                        </div>

                                        {/* Card Body Details: Halaqa, Center, Reached Page */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                            gap: '0.4rem',
                                            background: '#f8fafc',
                                            padding: '0.5rem 0.6rem',
                                            borderRadius: '8px',
                                            fontSize: '0.78rem',
                                            color: '#475569',
                                            textAlign: 'center'
                                        }}>
                                            <div>
                                                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>الحلقة</span>
                                                <strong style={{ color: '#1e293b' }}>{student.halaqa_name || student.ring_name || 'بدون حلقة'}</strong>
                                            </div>
                                            <div>
                                                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>المركز</span>
                                                <strong style={{ color: '#1e293b' }}>{student.center_name || 'بدون مركز'}</strong>
                                            </div>
                                            <div>
                                                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>الصفحة الحالية</span>
                                                <strong style={{ color: '#047857' }}>ص {student.reached_page || 1}</strong>
                                            </div>
                                        </div>

                                        {/* Card Action Buttons (Identical to Desktop) */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(3, 1fr)',
                                            gap: '0.4rem',
                                            borderTop: '1px solid #f1f5f9',
                                            paddingTop: '0.6rem'
                                        }}>
                                            <button
                                                onClick={() => handleOpenBonusModal(student)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.25rem',
                                                    background: '#ecfdf5',
                                                    border: '1px solid #a7f3d0',
                                                    color: '#065f46',
                                                    padding: '0.45rem 0.3rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                                title="منح +1 نقطة سلوكية"
                                            >
                                                <Plus size={14} weight="bold" />
                                                +1 سلوك
                                            </button>

                                            <button
                                                onClick={() => handleOpenRedeemModal(student)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.25rem',
                                                    background: '#eff6ff',
                                                    border: '1px solid #bfdbfe',
                                                    color: '#1e40af',
                                                    padding: '0.45rem 0.3rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                                title="صرف مكافأة للطالب"
                                            >
                                                <Gift size={14} weight="fill" />
                                                صرف مكافأة
                                            </button>

                                            <button
                                                onClick={() => handleOpenLedgerModal(student)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.25rem',
                                                    background: '#faf5ff',
                                                    border: '1px solid #e9d5ff',
                                                    color: '#6b21a8',
                                                    padding: '0.45rem 0.3rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer'
                                                }}
                                                title="كشف حساب النقاط"
                                            >
                                                <Receipt size={14} weight="fill" />
                                                كشف الحساب
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {/* 3. REWARDS TAB (CRUD Supported) */}
                    {activeTab === 'rewards' && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.95rem' }}>قائمة المكافآت ({rewards.length})</span>
                                <button
                                    onClick={() => handleOpenRewardModal()}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        background: '#133315',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.5rem 0.9rem',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={16} /> إضافة مكافأة
                                </button>
                            </div>

                            {rewards.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>لم يتم إضافة مكافآت بعد</p>
                            ) : (
                                rewards.map(reward => (
                                    <div key={reward.id} style={{ background: '#fff', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                                            <div style={{ width: '52px', height: '52px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                                {reward.image ? (
                                                    <img src={reward.image?.startsWith('http') ? `/api/proxy-image/?url=${encodeURIComponent(reward.image)}` : reward.image} alt={reward.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <Gift size={26} color="#16a34a" />
                                                )}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: '0 0 0.2rem 0', color: '#133315', fontSize: '0.95rem' }}>{reward.name}</h4>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                    المخزون: {reward.stock_quantity === -1 ? 'غير محدود' : reward.stock_quantity}
                                                </div>
                                            </div>
                                            <div style={{ color: '#d97706', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.95rem' }}>
                                                {reward.points_cost} <Star size={14} weight="fill" />
                                            </div>
                                        </div>

                                        {reward.description && (
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                                                {reward.description}
                                            </p>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                                            <button
                                                onClick={() => handleOpenRewardModal(reward)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: '#334155', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                <PencilSimple size={14} /> تعديل
                                            </button>
                                            <button
                                                onClick={() => confirmDelete('reward', reward)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                <Trash size={14} /> حذف
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {/* 4. CLAIMS TAB */}
                    {activeTab === 'claims' && (
                        <>
                            {claims.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>لا توجد طلبات مكافآت</p>
                            ) : (
                                claims.map(claim => (
                                    <div key={claim.id} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 0.2rem 0', color: '#133315', fontSize: '0.95rem' }}>{claim.student_name}</h4>
                                                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{claim.reward_name} ({claim.points_spent} نقطة)</div>
                                            </div>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '20px',
                                                background: claim.status === 'PENDING' ? '#fef3c7' : claim.status === 'APPROVED' ? '#dcfce7' : claim.status === 'DELIVERED' ? '#e0f2fe' : '#fee2e2',
                                                color: claim.status === 'PENDING' ? '#b45309' : claim.status === 'APPROVED' ? '#15803d' : claim.status === 'DELIVERED' ? '#0369a1' : '#b91c1c',
                                                fontWeight: 'bold'
                                            }}>
                                                {claim.status === 'PENDING' ? 'قيد الانتظار' : claim.status === 'APPROVED' ? 'مقبول' : claim.status === 'DELIVERED' ? 'تم التسليم' : 'مرفوض'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {/* 5. COMPETITIONS TAB (CRUD Supported) */}
                    {activeTab === 'competitions' && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.95rem' }}>المسابقات المتاحة ({competitions.length})</span>
                                <button
                                    onClick={() => handleOpenCompModal()}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        background: '#133315',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.5rem 0.9rem',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={16} /> إضافة مسابقة
                                </button>
                            </div>

                            {competitions.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>لم يتم إنشاء أي مسابقات بعد</p>
                            ) : (
                                competitions.map(comp => (
                                    <div key={comp.id} style={{ background: '#fff', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                                            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Trophy size={20} color="#9333ea" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: '0 0 0.2rem 0', color: '#133315', fontSize: '0.95rem' }}>{comp.title}</h4>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                                                    {comp.description || 'مسابقة قرآنية تنافسية لتعزيز الحفظ والتثبيت'}
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                                            <span>المدة: <strong>{comp.duration_minutes} دقيقة</strong></span>
                                            <span>الجائزة: <strong style={{ color: '#d97706' }}>+{comp.points_reward} نقطة</strong></span>
                                            <span style={{ cursor: 'pointer', color: '#3b82f6', fontWeight: 600 }} onClick={() => handleToggleCompQuestions(comp.id)}>
                                                الأسئلة: <strong>{comp.questions_count || 0}</strong> {expandedCompId === comp.id ? <CaretDown size={14} style={{ transform: 'rotate(180deg)' }} /> : <CaretDown size={14} />}
                                            </span>
                                        </div>

                                        {expandedCompId === comp.id && (
                                            <div style={{ background: '#f8fafc', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <h5 style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>الأسئلة ({compQuestions[comp.id]?.length || 0})</h5>
                                                    <button onClick={() => handleOpenAddQuestion(comp)} style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                                                        <Plus size={14} /> إضافة سؤال
                                                    </button>
                                                </div>
                                                {compQuestions[comp.id] && compQuestions[comp.id].length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {compQuestions[comp.id].map((q, idx) => (
                                                            <div key={q.id} style={{ background: '#fff', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                    <div style={{ flex: 1, paddingLeft: '0.5rem' }}>
                                                                        <strong style={{ color: '#1e293b' }}>{idx + 1}. {q.question_text}</strong>
                                                                        <div style={{ color: '#64748b', marginTop: '0.2rem', fontSize: '0.75rem' }}>النوع: {q.question_type === 'MULTIPLE_CHOICE' ? 'اختيار من متعدد' : q.question_type === 'TRUE_FALSE' ? 'صح/خطأ' : q.question_type === 'MATCHING' ? 'مطابقة' : 'مقال'} | الدرجة: {q.points}</div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                                        <button onClick={() => handleOpenEditQuestion(comp, q)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}><PencilSimple size={16} /></button>
                                                                        <button onClick={() => confirmDelete('question', q, comp.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><Trash size={16} /></button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>لا توجد أسئلة بعد</p>
                                                )}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                                            <button
                                                onClick={() => handleOpenCompModal(comp)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: '#334155', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                <PencilSimple size={14} /> تعديل
                                            </button>
                                            <button
                                                onClick={() => confirmDelete('competition', comp)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                <Trash size={14} /> حذف
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
            )}

            {/* =========================================================
                MODALS FOR POINTS OPERATIONS (Identical to Desktop)
            ========================================================= */}

            {/* 1. Modal منح مكافأة سلوكية (+1) */}
            {isBonusModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', padding: '1.2rem', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#133315', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Coins size={20} color="#16a34a" weight="fill" />
                                منح مكافأة سلوكية (+1 نقطة)
                            </h3>
                            <button onClick={() => setIsBonusModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleGrantBonus} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>الطالب المستفيد:</label>
                                <select
                                    value={selectedStudentForBonus?.id || ''}
                                    onChange={(e) => {
                                        const s = students.find((item) => item.id === e.target.value);
                                        setSelectedStudentForBonus(s);
                                    }}
                                    required
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem', background: '#fff' }}
                                >
                                    {students.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.full_name} ({s.halaqa_name || s.ring_name || 'بدون حلقة'}) - الرصيد: {s.points ?? s.total_points ?? 0}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>القيمة الممنوحة:</label>
                                <input
                                    type="text"
                                    value="+1 نقطة سلوكية (وفق معايير التميز السلوكي)"
                                    disabled
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#f1f5f9', fontWeight: 'bold', color: '#10b981' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>سبب المكافأة السلوكية:</label>
                                <textarea
                                    rows="3"
                                    placeholder="مثال: الانضباط في الحضور، حسن الاستماع، مساعدة الزملاء..."
                                    value={bonusReason}
                                    onChange={(e) => setBonusReason(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsBonusModalOpen(false)}
                                    style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={bonusSubmitting}
                                    style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#133315', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    {bonusSubmitting ? 'جاري المنح...' : 'تأكيد منح +1 نقطة'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. Modal صرف واستبدال مكافأة مباشر */}
            {isRedeemModalOpen && selectedStudentForRedeem && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', padding: '1.2rem', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#133315', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Gift size={20} color="#2563eb" weight="fill" />
                                صرف مكافأة: {selectedStudentForRedeem.full_name}
                            </h3>
                            <button onClick={() => setIsRedeemModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleRedeemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>رصيد الطالب المتاح:</label>
                                <input
                                    type="text"
                                    value={`${selectedStudentForRedeem.points ?? selectedStudentForRedeem.total_points ?? 0} نقطة`}
                                    disabled
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#f1f5f9', fontWeight: 'bold', color: '#d97706' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>اختر المكافأة:</label>
                                <select
                                    value={selectedRewardId}
                                    onChange={(e) => setSelectedRewardId(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem', background: '#fff' }}
                                >
                                    {rewards.length === 0 ? (
                                        <option value="" disabled>لا توجد مكافآت مسجلة في المتجر</option>
                                    ) : (
                                        rewards.map((r) => {
                                            const studentPts = selectedStudentForRedeem.points ?? selectedStudentForRedeem.total_points ?? 0;
                                            const isInsufficient = studentPts < r.points_cost;
                                            return (
                                                <option key={r.id} value={r.id} disabled={isInsufficient}>
                                                    {r.name} - ({r.points_cost} نقطة) {isInsufficient ? ' [الرصيد غير كافٍ]' : ''}
                                                </option>
                                            );
                                        })
                                    )}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>ملاحظات الصرف والتسليم:</label>
                                <textarea
                                    rows="2"
                                    placeholder="ملاحظات تسليم الجائزة للطالب..."
                                    value={redeemNotes}
                                    onChange={(e) => setRedeemNotes(e.target.value)}
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsRedeemModalOpen(false)}
                                    style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={redeemSubmitting || rewards.length === 0}
                                    style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#133315', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    {redeemSubmitting ? 'جاري الصرف...' : 'تأكيد الصرف والخصم'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. Modal كشف حساب حركات النقاط */}
            {isLedgerModalOpen && ledgerStudent && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.8rem', boxSizing: 'border-box' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '1.2rem', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.05rem', color: '#133315' }}>
                                    كشف حساب النقاط
                                </h3>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{ledgerStudent.full_name}</div>
                            </div>
                            <button onClick={() => setIsLedgerModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Summary Pill */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '10px', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
                            <span>الحلقة: <strong>{ledgerStudent.halaqa_name || ledgerStudent.ring_name || 'بدون حلقة'}</strong></span>
                            <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Coins size={14} weight="fill" />
                                {ledgerStudent.points ?? ledgerStudent.total_points ?? 0} نقطة
                            </span>
                        </div>

                        {/* Transactions List */}
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {ledgerLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}>
                                    <ArrowsClockwise size={28} className="spin-animation" />
                                </div>
                            ) : transactions.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.9rem' }}>لا توجد حركات مسجلة للطالب</p>
                            ) : (
                                transactions.map((tx) => (
                                    <div key={tx.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.65rem 0.8rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                            <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>
                                                {tx.transaction_type_display || tx.transaction_type}
                                            </span>
                                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: tx.amount > 0 ? '#10b981' : '#ef4444' }}>
                                                {tx.amount > 0 ? `+${tx.amount}` : tx.amount} نقطة
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.2rem' }}>
                                            {tx.reason || 'بدون بيان'}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8' }}>
                                            <span>الرصيد بعد: {tx.balance_after}</span>
                                            <span>{tx.created_at}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ marginTop: '0.8rem', paddingTop: '0.6rem', borderTop: '1px solid #e2e8f0' }}>
                            <button
                                type="button"
                                onClick={() => setIsLedgerModalOpen(false)}
                                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================
                MODALS FOR REWARDS & COMPETITIONS CRUD
            ========================================================= */}

            {/* REWARD MODAL (Add / Edit) */}
            {isRewardModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', padding: '1.2rem', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#133315' }}>
                                {editingReward ? 'تعديل المكافأة' : 'إضافة مكافأة جديدة'}
                            </h3>
                            <button onClick={() => setIsRewardModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveReward} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>اسم المكافأة:</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: مصحف مذهب، قسيمة شراء..."
                                    value={rewardForm.name}
                                    onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>تكلفة النقاط:</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={rewardForm.points_cost}
                                        onChange={(e) => setRewardForm({ ...rewardForm, points_cost: Number(e.target.value) })}
                                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>الكمية:</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={rewardForm.stock_quantity}
                                        onChange={(e) => setRewardForm({ ...rewardForm, stock_quantity: Number(e.target.value) })}
                                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>رابط صورة المكافأة (اختياري):</label>
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    value={rewardForm.image}
                                    onChange={(e) => setRewardForm({ ...rewardForm, image: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>وصف المكافأة:</label>
                                <textarea
                                    rows="2"
                                    placeholder="وصف ومواصفات المكافأة..."
                                    value={rewardForm.description}
                                    onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsRewardModalOpen(false)}
                                    style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || rewardForm.stock_quantity < 0}
                                    style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#133315', color: '#fff', fontWeight: 'bold', cursor: 'pointer', opacity: (submitting || rewardForm.stock_quantity < 0) ? 0.7 : 1 }}
                                >
                                    {submitting ? 'جاري الحفظ...' : editingReward ? 'حفظ التعديلات' : 'إضافة المكافأة'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* COMPETITION MODAL (Add / Edit) */}
            {isCompModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', padding: '1.2rem', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#133315' }}>
                                {editingComp ? 'تعديل المسابقة' : 'إنشاء مسابقة تفاعلية جديدة'}
                            </h3>
                            <button onClick={() => setIsCompModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveComp} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>عنوان المسابقة:</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: مسابقة سورة البقرة، مسابقة أحكام النون..."
                                    value={compForm.title}
                                    onChange={(e) => setCompForm({ ...compForm, title: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>المدة (دقائق):</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={compForm.duration_minutes}
                                        onChange={(e) => setCompForm({ ...compForm, duration_minutes: Number(e.target.value) })}
                                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>نقاط الجائزة:</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={compForm.points_reward}
                                        onChange={(e) => setCompForm({ ...compForm, points_reward: Number(e.target.value) })}
                                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>وصف المسابقة:</label>
                                <textarea
                                    rows="2"
                                    placeholder="شروط وتوجيهات المسابقة..."
                                    value={compForm.description}
                                    onChange={(e) => setCompForm({ ...compForm, description: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsCompModalOpen(false)}
                                    style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#133315', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    {submitting ? 'جاري الحفظ...' : editingComp ? 'حفظ التعديلات' : 'إنشاء المسابقة'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONFIRM DELETE MODAL */}
            {deleteModal.open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '380px', padding: '1.4rem', textAlign: 'center', boxSizing: 'border-box' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                            <Trash size={28} />
                        </div>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#133315', fontSize: '1.15rem' }}>تأكيد الحذف</h3>
                        <p style={{ margin: '0 0 1.2rem 0', color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            هل أنت متأكد من رغبتك في حذف <strong>"{deleteModal.title}"</strong>؟<br />
                            لن يمكنك التراجع عن هذا الإجراء.
                        </p>
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <button
                                type="button"
                                onClick={() => setDeleteModal({ open: false, type: '', id: null, title: '' })}
                                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={handleExecuteDelete}
                                style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {submitting ? 'جاري الحذف...' : 'نعم، احذف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal إضافة / تعديل سؤال */}
            {isQuestionModalOpen && selectedCompForQuestion && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', padding: '1.2rem', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#133315' }}>{editingQuestion ? 'تعديل السؤال' : 'إضافة سؤال'}</h3>
                            <button onClick={() => setIsQuestionModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>نوع السؤال:</label>
                                <select
                                    value={questionFormData.question_type}
                                    onChange={(e) => setQuestionFormData({ ...questionFormData, question_type: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem', background: '#fff' }}
                                >
                                    <option value="MULTIPLE_CHOICE">اختيار من متعدد (مؤتمت)</option>
                                    <option value="TRUE_FALSE">صح أو خطأ (مؤتمت)</option>
                                    <option value="ESSAY">مقال (مراجعة بشرية)</option>
                                    <option value="MATCHING">مطابقة</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>نص السؤال:</label>
                                <textarea
                                    rows="2"
                                    placeholder="اكتب نص السؤال..."
                                    value={questionFormData.question_text}
                                    onChange={(e) => setQuestionFormData({ ...questionFormData, question_text: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
                                />
                            </div>

                            {/* Options for MCQ */}
                            {questionFormData.question_type === 'MULTIPLE_CHOICE' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>الخيارات الأربعة:</label>
                                    {questionFormData.options.map((opt, idx) => (
                                        <input
                                            key={idx}
                                            type="text"
                                            placeholder={`الخيار ${idx + 1}`}
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...questionFormData.options];
                                                newOpts[idx] = e.target.value;
                                                setQuestionFormData({ ...questionFormData, options: newOpts });
                                            }}
                                            required
                                            style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem', marginBottom: '0.4rem' }}
                                        />
                                    ))}
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginTop: '0.5rem', marginBottom: '0.3rem' }}>الإجابة الصحيحة:</label>
                                    <input
                                        type="text"
                                        placeholder="النص المطابق للخيار الصحيح"
                                        value={questionFormData.correct_answer}
                                        onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                    />
                                </div>
                            )}

                            {/* Options for True/False */}
                            {questionFormData.question_type === 'TRUE_FALSE' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>الإجابة الصحيحة:</label>
                                    <select
                                        value={questionFormData.correct_answer}
                                        onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value, options: ['صح', 'خطأ'] })}
                                        required
                                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem', background: '#fff' }}
                                    >
                                        <option value="">اختر الإجابة</option>
                                        <option value="صح">صح</option>
                                        <option value="خطأ">خطأ</option>
                                    </select>
                                </div>
                            )}

                            {/* Essay guidelines */}
                            {questionFormData.question_type === 'ESSAY' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>الإجابة النموذجية:</label>
                                    <textarea
                                        rows="2"
                                        placeholder="المعايير المعتمدة..."
                                        value={questionFormData.correct_answer}
                                        onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value })}
                                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
                                    />
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>درجة السؤال:</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    value={questionFormData.points}
                                    onChange={(e) => setQuestionFormData({ ...questionFormData, points: Number(e.target.value) })}
                                    required
                                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsQuestionModalOpen(false)}
                                    style={{ flex: 1, padding: '0.8rem', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '10px', fontWeight: 'bold', color: '#64748b', cursor: 'pointer' }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{ flex: 1, padding: '0.8rem', border: 'none', background: '#16a34a', borderRadius: '10px', fontWeight: 'bold', color: '#fff', cursor: 'pointer' }}
                                >
                                    {submitting ? 'جاري...' : editingQuestion ? 'تحديث السؤال' : 'إضافة السؤال'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobilePointsAndRewards;
