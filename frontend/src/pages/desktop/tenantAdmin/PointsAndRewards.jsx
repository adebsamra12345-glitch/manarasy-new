import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Bell, MapPin, CaretDown, MagnifyingGlass, Faders, Plus,
    Gift, Trophy, Medal, User, CheckCircle, Clock, Trash,
    PencilSimple, ArrowRight, X, Info, Coins, ListChecks,
    Check, Prohibit, Truck, Storefront, SlidersHorizontal, Eye
} from '@phosphor-icons/react';
import {
    getStudentsPointsList,
    grantBonusPoints,
    getPointsTransactions,
    getRewardsList,
    createReward,
    updateReward,
    deleteReward,
    redeemReward,
    getAdminRewardClaims,
    actionAdminRewardClaim,
    getStoreSettings,
    updateStoreSettings,
    getCompetitionsList,
    createCompetition,
    updateCompetition,
    deleteCompetition,
    getCompetitionDetail,
    addCompetitionQuestion,
    updateCompetitionQuestion,
    deleteCompetitionQuestion
} from '../../../services/pointsAndRewardsApi';
import useDeviceType from '../../../hooks/useDeviceType';
import MobilePointsAndRewards from '../../mobile/tenantAdmin/MobilePointsAndRewards';
import './pointsAndRewards.css';

const DesktopPointsAndRewards = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // View state: 'overview' | 'points' | 'rewards' | 'claims' | 'competitions' | 'settings'
    const [activeView, setActiveView] = useState('overview');

    // Header Date
    const todayDate = new Date();
    const hijriDate = new Intl.DateTimeFormat('ar-SA', {
        calendar: 'islamic', day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const gregorianDate = new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(todayDate);
    const dateStr = `${weekday}، ${hijriDate} | ${gregorianDate} م`;

    // Data States
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('success');

    // 1. Points State
    const [students, setStudents] = useState([]);
    const [selectedStudentForBonus, setSelectedStudentForBonus] = useState(null);
    const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
    const [bonusReason, setBonusReason] = useState('');
    const [bonusSubmitting, setBonusSubmitting] = useState(false);

    // Ledger / Transactions Modal
    const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
    const [ledgerStudent, setLedgerStudent] = useState(null);
    const [transactions, setTransactions] = useState([]);

    // Redeem Modal
    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [selectedStudentForRedeem, setSelectedStudentForRedeem] = useState(null);
    const [selectedRewardId, setSelectedRewardId] = useState('');
    const [redeemNotes, setRedeemNotes] = useState('');

    // 2. Rewards State
    const [rewards, setRewards] = useState([]);
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [editingReward, setEditingReward] = useState(null);
    const [rewardFormData, setRewardFormData] = useState({
        name: '', points_cost: 50, stock_quantity: 0, description: '', image: ''
    });

    // 3. Claims State
    const [claims, setClaims] = useState([]);
    const [claimsStats, setClaimsStats] = useState({ total: 0, pending: 0, approved: 0, delivered: 0, rejected: 0 });
    const [claimsStatusFilter, setClaimsStatusFilter] = useState('ALL');
    const [claimActionModal, setClaimActionModal] = useState({ open: false, claim: null, action: '' });
    const [claimAdminNotes, setClaimAdminNotes] = useState('');
    const [claimRejectionReason, setClaimRejectionReason] = useState('');
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);

    // 4. Store Settings State
    const [storeSettings, setStoreSettings] = useState(null);
    const [isTogglingStore, setIsTogglingStore] = useState(false);

    // 5. Competitions State
    const [competitions, setCompetitions] = useState([]);
    const [isCompetitionModalOpen, setIsCompetitionModalOpen] = useState(false);
    const [editingCompetition, setEditingCompetition] = useState(null);
    const [confirmDeleteModal, setConfirmDeleteModal] = useState({ open: false, type: '', id: null, title: '' });
    const [compFormData, setCompFormData] = useState({
        title: '', duration_minutes: 30, points_reward: 10, max_attempts: 1, description: ''
    });

    // Add Question Modal
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

    const showToast = (msg, type = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setTimeout(() => setToastMessage(''), 4000);
    };

    // Load Data according to active view
    useEffect(() => {
        loadData();
    }, [activeView, claimsStatusFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeView === 'points') {
                const res = await getStudentsPointsList({ search: searchQuery });
                if (res.status === 'success') setStudents(res.data);
                const rewRes = await getRewardsList();
                if (rewRes.status === 'success') setRewards(rewRes.data);
            } else if (activeView === 'rewards') {
                const res = await getRewardsList();
                if (res.status === 'success') setRewards(res.data);
            } else if (activeView === 'claims') {
                const res = await getAdminRewardClaims({ status: claimsStatusFilter, search: searchQuery });
                if (res.status === 'success') {
                    setClaims(res.data);
                    if (res.stats) setClaimsStats(res.stats);
                }
            } else if (activeView === 'competitions') {
                const res = await getCompetitionsList();
                if (res.status === 'success') setCompetitions(res.data);
            } else if (activeView === 'settings') {
                const res = await getStoreSettings();
                if (res.status === 'success') setStoreSettings(res.data);
            }
        } catch (err) {
            console.error(err);
            showToast('حدث خطأ أثناء تحميل البيانات', 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- Points Actions ---
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

            if (res.status === 'success') {
                showToast(res.message || 'تم منح +1 نقطة مكافأة سلوكية بنجاح');
                setIsBonusModalOpen(false);
                setBonusReason('');
                loadData();
            } else {
                showToast(res.message || 'فشلت عملية المنح', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء منح النقاط', 'error');
        } finally {
            setBonusSubmitting(false);
        }
    };

    const handleOpenLedgerModal = async (student) => {
        setLedgerStudent(student);
        setIsLedgerModalOpen(true);
        try {
            const res = await getPointsTransactions({ student_id: student.id });
            if (res.status === 'success') {
                setTransactions(res.data);
            }
        } catch (err) {
            console.error(err);
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

        try {
            const res = await redeemReward({
                student_id: selectedStudentForRedeem.id,
                reward_id: selectedRewardId,
                notes: redeemNotes
            });

            if (res.status === 'success') {
                showToast(res.message || 'تم استبدال وصرف المكافأة بنجاح');
                setIsRedeemModalOpen(false);
                loadData();
            } else {
                showToast(res.message || 'فشلت عملية الاستبدال', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء الاستبدال', 'error');
        }
    };

    // --- Rewards Actions ---
    const handleOpenRewardModal = (reward = null) => {
        if (reward) {
            setEditingReward(reward);
            setRewardFormData({
                name: reward.name,
                points_cost: reward.points_cost,
                stock_quantity: reward.stock_quantity,
                description: reward.description || '',
                image: reward.image || ''
            });
        } else {
            setEditingReward(null);
            setRewardFormData({
                name: '', points_cost: 50, stock_quantity: 0, description: '', image: ''
            });
        }
        setIsRewardModalOpen(true);
    };

    const handleSaveReward = async (e) => {
        e.preventDefault();
        try {
            if (editingReward) {
                const res = await updateReward(editingReward.id, rewardFormData);
                if (res.status === 'success') {
                    showToast('تم تحديث المكافأة بنجاح');
                    setIsRewardModalOpen(false);
                    loadData();
                }
            } else {
                const res = await createReward(rewardFormData);
                if (res.status === 'success') {
                    showToast('تمت إضافة المكافأة بنجاح');
                    setIsRewardModalOpen(false);
                    loadData();
                }
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'فشل حفظ المكافأة', 'error');
        }
    };

    const handleDeleteReward = (reward) => {
        setConfirmDeleteModal({
            open: true,
            type: 'reward',
            id: reward.id,
            title: reward.name
        });
    };

    // --- Claims Management Actions ---
    const handleOpenClaimActionModal = (claim, action) => {
        setClaimActionModal({ open: true, claim, action });
        setClaimAdminNotes(claim.admin_notes || '');
        setClaimRejectionReason(claim.rejection_reason || '');
    };

    const handleExecuteClaimAction = async (e) => {
        e.preventDefault();
        const { claim, action } = claimActionModal;
        if (!claim || !action) return;

        setIsActionSubmitting(true);
        try {
            const res = await actionAdminRewardClaim(claim.id, {
                action,
                admin_notes: claimAdminNotes,
                rejection_reason: claimRejectionReason
            });

            if (res.status === 'success') {
                showToast(res.message || 'تم تحديث حالة الطلب بنجاح');
                setClaimActionModal({ open: false, claim: null, action: '' });
                loadData();
            } else {
                showToast(res.message || 'فشل تنفيذ الإجراء', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء معالجة الطلب', 'error');
        } finally {
            setIsActionSubmitting(false);
        }
    };

    // --- Store Toggle Settings ---
    const handleToggleStore = async (scope, targetId, currentStatus) => {
        setIsTogglingStore(true);
        try {
            const newStatus = !currentStatus;
            const res = await updateStoreSettings({
                scope,
                target_id: targetId,
                is_enabled: newStatus
            });
            if (res.status === 'success') {
                showToast(res.message);
                const updated = await getStoreSettings();
                if (updated.status === 'success') setStoreSettings(updated.data);
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'فشل تحديث إعدادات المتجر', 'error');
        } finally {
            setIsTogglingStore(false);
        }
    };

    // --- Competitions Actions ---
    const handleOpenCompetitionModal = (comp = null) => {
        if (comp) {
            setEditingCompetition(comp);
            setCompFormData({
                title: comp.title || '',
                duration_minutes: comp.duration_minutes || 30,
                points_reward: comp.points_reward || 10,
                max_attempts: comp.max_attempts || 1,
                description: comp.description || ''
            });
        } else {
            setEditingCompetition(null);
            setCompFormData({
                title: '',
                duration_minutes: 30,
                points_reward: 10,
                max_attempts: 1,
                description: ''
            });
        }
        setIsCompetitionModalOpen(true);
    };

    const handleSaveCompetition = async (e) => {
        e.preventDefault();
        if (!compFormData.title.trim()) {
            showToast('يرجى إدخال عنوان المسابقة', 'error');
            return;
        }
        try {
            if (editingCompetition) {
                const res = await updateCompetition(editingCompetition.id, compFormData);
                if (res.status === 'success') {
                    showToast('تم تحديث المسابقة بنجاح');
                    setIsCompetitionModalOpen(false);
                    setEditingCompetition(null);
                    setCompFormData({ title: '', duration_minutes: 30, points_reward: 10, max_attempts: 1, description: '' });
                    loadData();
                }
            } else {
                const res = await createCompetition(compFormData);
                if (res.status === 'success') {
                    showToast('تم إنشاء المسابقة بنجاح');
                    setIsCompetitionModalOpen(false);
                    setCompFormData({ title: '', duration_minutes: 30, points_reward: 10, max_attempts: 1, description: '' });
                    loadData();
                }
            }
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'فشل حفظ المسابقة', 'error');
        }
    };

    const handleDeleteCompetition = (comp) => {
        setConfirmDeleteModal({
            open: true,
            type: 'competition',
            id: comp.id,
            title: comp.title
        });
    };

    const handleDeleteQuestion = (q, compId) => {
        setConfirmDeleteModal({
            open: true,
            type: 'question',
            id: q.id,
            title: 'هذا السؤال',
            parentId: compId
        });
    };

    const handleExecuteDelete = async () => {
        const { type, id, parentId } = confirmDeleteModal;
        if (!id) return;
        try {
            if (type === 'competition') {
                const res = await deleteCompetition(id);
                if (res.status === 'success') {
                    showToast('تم حذف المسابقة بنجاح');
                    setConfirmDeleteModal({ open: false, type: '', id: null, title: '' });
                    loadData();
                }
            } else if (type === 'reward') {
                const res = await deleteReward(id);
                if (res.status === 'success') {
                    showToast('تم حذف المكافأة بنجاح');
                    setConfirmDeleteModal({ open: false, type: '', id: null, title: '' });
                    loadData();
                }
            } else if (type === 'question') {
                const res = await deleteCompetitionQuestion(id);
                if (res.status === 'success') {
                    showToast('تم حذف السؤال بنجاح');
                    setConfirmDeleteModal({ open: false, type: '', id: null, title: '' });
                    if (parentId) loadCompQuestions(parentId);
                    loadData();
                }
            }
        } catch (err) {
            console.error(err);
            showToast('فشل تنفيذ عملية الحذف', 'error');
        }
    };

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
        }
    };

    const renderClaimBadge = (status) => {
        switch (status) {
            case 'PENDING':
                return <span className="pr-status-badge pr-status-pending"><Clock size={14} /> قيد الانتظار</span>;
            case 'APPROVED':
                return <span className="pr-status-badge pr-status-approved"><CheckCircle size={14} /> تمت الموافقة</span>;
            case 'DELIVERED':
                return <span className="pr-status-badge pr-status-delivered"><Truck size={14} /> تم التسليم</span>;
            case 'REJECTED':
                return <span className="pr-status-badge pr-status-rejected"><Prohibit size={14} /> مرفوض</span>;
            default:
                return <span className="pr-status-badge">{status}</span>;
        }
    };

    return (
        <div className="points-rewards-container">
            {/* Header */}
            <div className="pr-header">
                <div className="pr-header-right">
                    <h1>إدارة النقاط والمكافآت والمسابقات</h1>
                    <p>{dateStr}</p>
                </div>
                <div className="pr-header-left">
                    <button className="pr-dropdown-btn" onClick={() => setActiveView('settings')}>
                        <SlidersHorizontal size={18} />
                        إعدادات المتجر
                    </button>
                    <button className="pr-notification-btn" title="الإشعارات">
                        <Bell size={18} />
                        <span className="pr-notification-dot"></span>
                    </button>
                </div>
            </div>

            {/* Toast Message */}
            {toastMessage && (
                <div className={`pr-toast pr-toast-${toastType}`}>
                    {toastMessage}
                </div>
            )}

            {/* Top Navigation Tabs */}
            <div className="pr-nav-tabs">
                <button
                    className={`pr-nav-tab ${activeView === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveView('overview')}
                >
                    <Trophy size={18} />
                    نظرة عامة
                </button>
                <button
                    className={`pr-nav-tab ${activeView === 'points' ? 'active' : ''}`}
                    onClick={() => setActiveView('points')}
                >
                    <Coins size={18} />
                    نقاط الطلاب
                </button>
                <button
                    className={`pr-nav-tab ${activeView === 'rewards' ? 'active' : ''}`}
                    onClick={() => setActiveView('rewards')}
                >
                    <Gift size={18} />
                    المتجر والمكافآت
                </button>
                <button
                    className={`pr-nav-tab ${activeView === 'claims' ? 'active' : ''}`}
                    onClick={() => setActiveView('claims')}
                >
                    <ListChecks size={18} />
                    طلبات المكافآت
                    {claimsStats.pending > 0 && (
                        <span className="pr-tab-badge">{claimsStats.pending}</span>
                    )}
                </button>
                <button
                    className={`pr-nav-tab ${activeView === 'competitions' ? 'active' : ''}`}
                    onClick={() => setActiveView('competitions')}
                >
                    <Medal size={18} />
                    المسابقات التفاعلية
                </button>
                <button
                    className={`pr-nav-tab ${activeView === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveView('settings')}
                >
                    <Storefront size={18} />
                    التحكم بالمتجر
                </button>
            </div>

            {/* =========================================================
                VIEW 1: OVERVIEW
            ========================================================= */}
            {activeView === 'overview' && (
                <div className="pr-overview-grid">
                    <div className="pr-hero-card" onClick={() => setActiveView('points')}>
                        <div className="pr-hero-icon pr-icon-gold">
                            <Coins size={36} />
                        </div>
                        <h3>سجل ورصيد نقاط الطلاب</h3>
                        <p>متابعة أرصدة الطلاب ومنح مكافآت السلوك (+1 نقطة)، ونقاط التسميع، واستعراض كشف الحساب.</p>
                        <div className="pr-hero-action">
                            <span>عرض قائمة الطلاب</span>
                            <ArrowRight size={18} />
                        </div>
                    </div>

                    <div className="pr-hero-card" onClick={() => setActiveView('rewards')}>
                        <div className="pr-hero-icon pr-icon-green">
                            <Gift size={36} />
                        </div>
                        <h3>متجر الجوائز والمكافآت</h3>
                        <p>إدارة الجوائز العينية المتاحة، تحديد تكلفة النقاط والكميات المتاحة.</p>
                        <div className="pr-hero-action">
                            <span>إدارة متجر المكافآت</span>
                            <ArrowRight size={18} />
                        </div>
                    </div>

                    <div className="pr-hero-card" onClick={() => setActiveView('claims')}>
                        <div className="pr-hero-icon pr-icon-blue">
                            <ListChecks size={36} />
                        </div>
                        <h3>إدارة طلبات المكافآت</h3>
                        <p>مراجعة طلبات استبدال النقاط المقدمة من الطلاب وأولياء الأمور واعتمادها أو تسليمها.</p>
                        <div className="pr-hero-action">
                            <span>مراجعة الطلبات ({claimsStats.pending} قيد الانتظار)</span>
                            <ArrowRight size={18} />
                        </div>
                    </div>

                    <div className="pr-hero-card" onClick={() => setActiveView('competitions')}>
                        <div className="pr-hero-icon pr-icon-purple">
                            <Trophy size={36} />
                        </div>
                        <h3>المسابقات القرآنية التفاعلية</h3>
                        <p>إنشاء مسابقات شهرية وأسبوعية مع أسئلة مؤتمتة وجوائز نقاط فورية للطلاب.</p>
                        <div className="pr-hero-action">
                            <span>إدارة المسابقات</span>
                            <ArrowRight size={18} />
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================
                VIEW 2: POINTS MANAGEMENT
            ========================================================= */}
            {activeView === 'points' && (
                <div className="pr-view-section">
                    <div className="pr-table-toolbar">
                        <div className="pr-search-box">
                            <MagnifyingGlass size={18} />
                            <input
                                type="text"
                                placeholder="بحث باسم الطالب أو رقم الهوية..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                            />
                        </div>
                        <div className="pr-toolbar-actions">
                            <button className="pr-action-btn-green" onClick={() => handleOpenBonusModal()}>
                                <Plus size={18} />
                                منح مكافأة سلوكية (+1)
                            </button>
                        </div>
                    </div>

                    <div className="pr-table-wrapper">
                        <table className="pr-table">
                            <thead>
                                <tr>
                                    <th>اسم الطالب</th>
                                    <th>الحلقة</th>
                                    <th>المركز</th>
                                    <th>الرصيد الحالي</th>
                                    <th>الصفحة الحالية</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>جاري التحميل...</td>
                                    </tr>
                                ) : students.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>لا يوجد طلاب مسجلين</td>
                                    </tr>
                                ) : (
                                    students.map((student) => (
                                        <tr key={student.id}>
                                            <td>
                                                <div className="pr-student-cell">
                                                    <div className="pr-avatar-circle">
                                                        {student.full_name?.charAt(0) || 'ط'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{student.full_name}</div>
                                                        <div style={{ fontSize: 12, color: '#64748b' }}>{student.national_id || 'بدون رقم هوية'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{student.halaqa_name}</td>
                                            <td>{student.center_name}</td>
                                            <td>
                                                <span className="pr-points-badge">
                                                    <Coins size={14} weight="fill" />
                                                    {student.points} نقطة
                                                </span>
                                            </td>
                                            <td>ص {student.reached_page}</td>
                                            <td>
                                                <div className="pr-row-actions">
                                                    <button
                                                        className="pr-btn-sm pr-btn-bonus"
                                                        onClick={() => handleOpenBonusModal(student)}
                                                        title="منح +1 نقطة سلوكية"
                                                    >
                                                        +1 سلوك
                                                    </button>
                                                    <button
                                                        className="pr-btn-sm pr-btn-redeem"
                                                        onClick={() => handleOpenRedeemModal(student)}
                                                        title="صرف مكافأة"
                                                    >
                                                        صرف مكافأة
                                                    </button>
                                                    <button
                                                        className="pr-btn-sm pr-btn-ledger"
                                                        onClick={() => handleOpenLedgerModal(student)}
                                                        title="كشف حساب النقاط"
                                                    >
                                                        كشف الحساب
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* =========================================================
                VIEW 3: REWARDS STORE (ADMIN)
            ========================================================= */}
            {activeView === 'rewards' && (
                <div className="pr-view-section">
                    <div className="pr-table-toolbar">
                        <h2>قائمة المكافآت المتاحة في المتجر</h2>
                        <button className="pr-action-btn-green" onClick={() => handleOpenRewardModal()}>
                            <Plus size={18} />
                            إضافة مكافأة جديدة
                        </button>
                    </div>

                    <div className="pr-rewards-grid">
                        {loading ? (
                            <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px' }}>جاري التحميل...</p>
                        ) : rewards.length === 0 ? (
                            <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px' }}>لم يتم إضافة أي مكافآت بعد</p>
                        ) : (
                            rewards.map((reward) => (
                                <div key={reward.id} className="pr-reward-card">
                                    <div className="pr-reward-img-wrapper">
                                        {reward.image ? (
                                            <img src={reward.image?.startsWith('http') ? `/api/proxy-image/?url=${encodeURIComponent(reward.image)}` : reward.image} alt={reward.name} />
                                        ) : (
                                            <div className="pr-reward-placeholder">
                                                <Gift size={48} />
                                            </div>
                                        )}
                                        <span className="pr-reward-cost-tag">
                                            {reward.points_cost} نقطة
                                        </span>
                                    </div>
                                    <div className="pr-reward-body">
                                        <h4>{reward.name}</h4>
                                        <p>{reward.description || 'مكافأة تشجيعية لطلاب الحلقات القرآنية'}</p>
                                        <div className="pr-reward-meta">
                                            <span>المخزون: {reward.stock_quantity === -1 ? 'غير محدود' : `${reward.stock_quantity} قطعة`}</span>
                                            <span style={{ color: reward.is_active ? '#10b981' : '#ef4444' }}>
                                                {reward.is_active ? '● مفعلة' : '● معطلة'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pr-reward-actions">
                                        <button className="pr-icon-btn" onClick={() => handleOpenRewardModal(reward)} title="تعديل">
                                            <PencilSimple size={18} />
                                        </button>
                                        <button className="pr-icon-btn pr-btn-delete" onClick={() => handleDeleteReward(reward)} title="حذف">
                                            <Trash size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* =========================================================
                VIEW 4: REWARD CLAIMS (إدارة طلبات المكافآت)
            ========================================================= */}
            {activeView === 'claims' && (
                <div className="pr-view-section">
                    <div className="pr-claims-stats-bar">
                        <div
                            className={`pr-stat-pill ${claimsStatusFilter === 'ALL' ? 'active' : ''}`}
                            onClick={() => setClaimsStatusFilter('ALL')}
                        >
                            <span>الكل</span>
                            <strong>{claimsStats.total}</strong>
                        </div>
                        <div
                            className={`pr-stat-pill pill-pending ${claimsStatusFilter === 'PENDING' ? 'active' : ''}`}
                            onClick={() => setClaimsStatusFilter('PENDING')}
                        >
                            <span>قيد الانتظار</span>
                            <strong>{claimsStats.pending}</strong>
                        </div>
                        <div
                            className={`pr-stat-pill pill-approved ${claimsStatusFilter === 'APPROVED' ? 'active' : ''}`}
                            onClick={() => setClaimsStatusFilter('APPROVED')}
                        >
                            <span>تمت الموافقة</span>
                            <strong>{claimsStats.approved}</strong>
                        </div>
                        <div
                            className={`pr-stat-pill pill-delivered ${claimsStatusFilter === 'DELIVERED' ? 'active' : ''}`}
                            onClick={() => setClaimsStatusFilter('DELIVERED')}
                        >
                            <span>تم التسليم</span>
                            <strong>{claimsStats.delivered}</strong>
                        </div>
                        <div
                            className={`pr-stat-pill pill-rejected ${claimsStatusFilter === 'REJECTED' ? 'active' : ''}`}
                            onClick={() => setClaimsStatusFilter('REJECTED')}
                        >
                            <span>مرفوض</span>
                            <strong>{claimsStats.rejected}</strong>
                        </div>
                    </div>

                    <div className="pr-table-wrapper" style={{ marginTop: 20 }}>
                        <table className="pr-table">
                            <thead>
                                <tr>
                                    <th>الطالب</th>
                                    <th>المكافأة المطلوبة</th>
                                    <th>النقاط</th>
                                    <th>رصيد الطالب الحالي</th>
                                    <th>الحالة</th>
                                    <th>تاريخ الطلب</th>
                                    <th>ملاحظات</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>جاري التحميل...</td></tr>
                                ) : claims.length === 0 ? (
                                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>لا توجد طلبات مكافآت مطابقة</td></tr>
                                ) : (
                                    claims.map((claim) => (
                                        <tr key={claim.id}>
                                            <td>
                                                <strong>{claim.student_name}</strong>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>{claim.halaqa_name}</div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    {claim.reward_image ? (
                                                        <img src={claim.reward_image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                                                    ) : (
                                                        <Gift size={22} color="#133315" />
                                                    )}
                                                    <span>{claim.reward_name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="pr-points-badge">{claim.points_spent} نقطة</span>
                                            </td>
                                            <td>{claim.student_current_points} نقطة</td>
                                            <td>{renderClaimBadge(claim.status)}</td>
                                            <td>{claim.claimed_at}</td>
                                            <td style={{ maxWidth: 160, fontSize: 13 }}>
                                                {claim.notes && <div><strong>طلب:</strong> {claim.notes}</div>}
                                                {claim.admin_notes && <div style={{ color: '#047857' }}><strong>إدارة:</strong> {claim.admin_notes}</div>}
                                                {claim.rejection_reason && <div style={{ color: '#b91c1c' }}><strong>رفض:</strong> {claim.rejection_reason}</div>}
                                            </td>
                                            <td>
                                                <div className="pr-row-actions">
                                                    {claim.status === 'PENDING' && (
                                                        <>
                                                            <button
                                                                className="pr-btn-sm pr-btn-approve"
                                                                onClick={() => handleOpenClaimActionModal(claim, 'APPROVE')}
                                                                title="موافقة وخصم النقاط"
                                                            >
                                                                <Check size={14} /> موافقة
                                                            </button>
                                                            <button
                                                                className="pr-btn-sm pr-btn-reject"
                                                                onClick={() => handleOpenClaimActionModal(claim, 'REJECT')}
                                                                title="رفض الطلب"
                                                            >
                                                                <Prohibit size={14} /> رفض
                                                            </button>
                                                        </>
                                                    )}
                                                    {claim.status === 'APPROVED' && (
                                                        <button
                                                            className="pr-btn-sm pr-btn-deliver"
                                                            onClick={() => handleOpenClaimActionModal(claim, 'DELIVER')}
                                                            title="تأكيد التسليم للطالب"
                                                        >
                                                            <Truck size={14} /> تم التسليم
                                                        </button>
                                                    )}
                                                    {claim.status === 'DELIVERED' && (
                                                        <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>تم التسليم بنجاح</span>
                                                    )}
                                                    {claim.status === 'REJECTED' && (
                                                        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>مرفوض</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* =========================================================
                VIEW 5: COMPETITIONS (ADMIN)
            ========================================================= */}
            {activeView === 'competitions' && (
                <div className="pr-view-section">
                    <div className="pr-table-toolbar">
                        <h2>المسابقات القرآنية المتاحة</h2>
                        <button className="pr-action-btn-green" onClick={() => handleOpenCompetitionModal()}>
                            <Plus size={18} />
                            إنشاء مسابقة جديدة
                        </button>
                    </div>

                    <div className="pr-competitions-list">
                        {loading ? (
                            <p style={{ textAlign: 'center', padding: '30px' }}>جاري التحميل...</p>
                        ) : competitions.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: '30px' }}>لم يتم إنشاء أي مسابقات بعد</p>
                        ) : (
                            competitions.map((comp) => (
                                <div key={comp.id} className="pr-competition-card">
                                    <div className="pr-comp-header">
                                        <div className="pr-comp-icon">
                                            <Trophy size={28} />
                                        </div>
                                        <div>
                                            <h3>{comp.title}</h3>
                                            <p>{comp.description || 'مسابقة قرآنية تنافسية لتعزيز الحفظ والتثبيت'}</p>
                                        </div>
                                    </div>
                                    <div className="pr-comp-details">
                                        <div className="pr-comp-stat">
                                            <span>مدة الحل</span>
                                            <strong>{comp.duration_minutes} دقيقة</strong>
                                        </div>
                                        <div className="pr-comp-stat">
                                            <span>النقاط</span>
                                            <strong style={{ color: '#d97706' }}>+{comp.points_reward} نقطة</strong>
                                        </div>
                                        <div className="pr-comp-stat" style={{ cursor: 'pointer' }} onClick={() => handleToggleCompQuestions(comp.id)}>
                                            <span>الأسئلة <CaretDown size={14} style={{ transform: expandedCompId === comp.id ? 'rotate(180deg)' : 'none', marginLeft: 4, display: 'inline-block' }} /></span>
                                            <strong>{comp.questions_count} سؤال</strong>
                                        </div>
                                        <div className="pr-comp-stat">
                                            <span>الحالة</span>
                                            <strong style={{ color: comp.is_published ? '#10b981' : '#ef4444' }}>
                                                {comp.is_published ? 'منشورة' : 'مسودة'}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Questions Accordion */}
                                    {expandedCompId === comp.id && (
                                        <div style={{ background: '#f8fafc', padding: '1rem', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px', marginTop: '-8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <h5 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>أسئلة المسابقة ({compQuestions[comp.id]?.length || 0})</h5>
                                                <button onClick={() => handleOpenAddQuestion(comp)} style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                                                    <Plus size={16} /> إضافة سؤال
                                                </button>
                                            </div>
                                            {compQuestions[comp.id] && compQuestions[comp.id].length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                                    {compQuestions[comp.id].map((q, idx) => (
                                                        <div key={q.id} style={{ background: '#fff', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                <div style={{ flex: 1 }}>
                                                                    <strong style={{ color: '#1e293b', fontSize: '0.95rem' }}>{idx + 1}. {q.question_text}</strong>
                                                                    <div style={{ color: '#64748b', marginTop: '0.3rem', fontSize: '0.85rem' }}>النوع: {q.question_type === 'MULTIPLE_CHOICE' ? 'اختيار من متعدد' : q.question_type === 'TRUE_FALSE' ? 'صح/خطأ' : q.question_type === 'MATCHING' ? 'مطابقة' : 'مقال'} | الدرجة: {q.points}</div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '0.6rem' }}>
                                                                    <button onClick={() => handleOpenEditQuestion(comp, q)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }} title="تعديل السؤال"><PencilSimple size={18} /></button>
                                                                    <button onClick={() => handleDeleteQuestion(q, comp.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="حذف السؤال"><Trash size={18} /></button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', textAlign: 'center' }}>لا توجد أسئلة مضافة بعد.</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="pr-comp-actions">
                                        <button className="pr-action-btn-outline" onClick={() => handleOpenCompetitionModal(comp)} title="تعديل المسابقة">
                                            <PencilSimple size={16} />
                                            تعديل
                                        </button>
                                        <button className="pr-icon-btn pr-btn-delete" onClick={() => handleDeleteCompetition(comp)} title="حذف المسابقة">
                                            <Trash size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* =========================================================
                VIEW 6: STORE SETTINGS (التحكم بفتح وإغلاق المتجر)
            ========================================================= */}
            {activeView === 'settings' && (
                <div className="pr-view-section">
                    <div className="pr-settings-card">
                        <div className="pr-settings-header">
                            <Storefront size={28} color="#133315" />
                            <div>
                                <h3>التحكم بفتح وإغلاق متجر النقاط والمكافآت</h3>
                                <p>هرمية الصلاحيات: إعداد المركز له الأولوية القصوى ويليه إعداد المسجد.</p>
                            </div>
                        </div>

                        {storeSettings && (
                            <div className="pr-settings-content">
                                {/* Mosque Level Toggle */}
                                <div className="pr-setting-row">
                                    <div>
                                        <strong>إعداد المسجد بالكامل ({storeSettings.mosque?.name})</strong>
                                        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
                                            عند الإغلاق، يتم إخفاء المتجر وتعطيل الشراء لجميع طلاب المسجد في كافة المراكز.
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span className={`pr-status-pill ${storeSettings.mosque?.is_rewards_store_enabled ? 'open' : 'closed'}`}>
                                            {storeSettings.mosque?.is_rewards_store_enabled ? 'المتجر مفتوح' : 'المتجر مغلق'}
                                        </span>
                                        {storeSettings.can_manage_mosque && (
                                            <button
                                                className={`pr-toggle-btn ${storeSettings.mosque?.is_rewards_store_enabled ? 'btn-close' : 'btn-open'}`}
                                                disabled={isTogglingStore}
                                                onClick={() => handleToggleStore('MOSQUE', null, storeSettings.mosque?.is_rewards_store_enabled)}
                                            >
                                                {storeSettings.mosque?.is_rewards_store_enabled ? 'إغلاق المتجر' : 'فتح المتجر'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

                                {/* Centers Level Toggles */}
                                <h4 style={{ marginBottom: 12, fontSize: 15, color: '#334155' }}>إعدادات المراكز القرآنية:</h4>
                                <div className="pr-centers-settings-list">
                                    {storeSettings.centers?.map((center) => (
                                        <div key={center.id} className="pr-center-setting-item">
                                            <div>
                                                <strong>{center.name}</strong>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>
                                                    الحالة الفعلية: {center.status_message}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span className={`pr-status-pill ${center.effective_open ? 'open' : 'closed'}`}>
                                                    {center.effective_open ? 'متاح للشراء' : 'معطل'}
                                                </span>
                                                {storeSettings.can_manage_center && (
                                                    <button
                                                        className={`pr-toggle-btn ${center.is_rewards_store_enabled ? 'btn-close' : 'btn-open'}`}
                                                        disabled={isTogglingStore}
                                                        onClick={() => handleToggleStore('CENTER', center.id, center.is_rewards_store_enabled)}
                                                    >
                                                        {center.is_rewards_store_enabled ? 'إغلاق المركز' : 'فتح المركز'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* =========================================================
                MODALS
            ========================================================= */}

            {/* 1. Modal منح مكافأة سلوكية (+2) */}
            {isBonusModalOpen && (
                <div className="pr-modal-overlay">
                    <div className="pr-modal-box">
                        <div className="pr-modal-header">
                            <h3 className="pr-modal-title">منح مكافأة سلوكية (+2 نقاط)</h3>
                            <button className="pr-modal-close" onClick={() => setIsBonusModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleGrantBonus}>
                            <div className="pr-form-group">
                                <label className="pr-form-label">الطالب المستفيد:</label>
                                <select
                                    className="pr-form-select"
                                    value={selectedStudentForBonus?.id || ''}
                                    onChange={(e) => {
                                        const s = students.find((item) => item.id === e.target.value);
                                        setSelectedStudentForBonus(s);
                                    }}
                                    required
                                >
                                    {students.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.full_name} ({s.halaqa_name}) - الرصيد: {s.points}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-form-label">القيمة الممنوحة:</label>
                                <input
                                    type="text"
                                    className="pr-form-input"
                                    value="+1 نقطة سلوكية (وفق معايير التميز السلوكي للمنصة)"
                                    disabled
                                    style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', color: '#10b981' }}
                                />
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-form-label">سبب المكافأة السلوكية:</label>
                                <textarea
                                    className="pr-form-textarea"
                                    rows="3"
                                    placeholder="مثال: الانضباط في الحضور، حسن الاستماع، مساعدة الزملاء..."
                                    value={bonusReason}
                                    onChange={(e) => setBonusReason(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="pr-modal-footer">
                                <button type="button" className="pr-btn-secondary" onClick={() => setIsBonusModalOpen(false)}>
                                    إلغاء
                                </button>
                                <button type="submit" className="pr-action-btn-green" disabled={bonusSubmitting}>
                                    {bonusSubmitting ? 'جاري المنح...' : 'تأكيد منح +1 نقطة'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. Modal كشف حساب حركات النقاط */}
            {isLedgerModalOpen && ledgerStudent && (
                <div className="pr-modal-overlay">
                    <div className="pr-modal-box pr-modal-large">
                        <div className="pr-modal-header">
                            <h3 className="pr-modal-title">كشف حساب حركات النقاط: {ledgerStudent.full_name}</h3>
                            <button className="pr-modal-close" onClick={() => setIsLedgerModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="pr-ledger-summary">
                            <div><strong>الحلقة:</strong> {ledgerStudent.halaqa_name}</div>
                            <div>
                                <strong>الرصيد الحالي:</strong>
                                <span className="pr-points-badge" style={{ marginRight: 8 }}>{ledgerStudent.points} نقطة</span>
                            </div>
                        </div>

                        <div className="pr-table-wrapper" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                            <table className="pr-table">
                                <thead>
                                    <tr>
                                        <th>نوع الحركة</th>
                                        <th>القيمة</th>
                                        <th>البيان / السبب</th>
                                        <th>الرصيد بعد</th>
                                        <th>بواسطة</th>
                                        <th>التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>لا توجد حركات مسجلة</td></tr>
                                    ) : (
                                        transactions.map((tx) => (
                                            <tr key={tx.id}>
                                                <td>{tx.transaction_type_display}</td>
                                                <td style={{ fontWeight: 'bold', color: tx.amount > 0 ? '#10b981' : '#ef4444' }}>
                                                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                                                </td>
                                                <td>{tx.reason}</td>
                                                <td>{tx.balance_after}</td>
                                                <td>{tx.performed_by}</td>
                                                <td style={{ fontSize: 12 }}>{tx.created_at}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Modal صرف واستبدال مكافأة مباشر */}
            {isRedeemModalOpen && selectedStudentForRedeem && (
                <div className="pr-modal-overlay">
                    <div className="pr-modal-box">
                        <div className="pr-modal-header">
                            <h3 className="pr-modal-title">صرف مكافأة للطالب: {selectedStudentForRedeem.full_name}</h3>
                            <button className="pr-modal-close" onClick={() => setIsRedeemModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleRedeemSubmit}>
                            <div className="pr-form-group">
                                <label className="pr-form-label">رصيد الطالب المتاح:</label>
                                <input
                                    type="text"
                                    className="pr-form-input"
                                    value={`${selectedStudentForRedeem.points} نقطة`}
                                    disabled
                                    style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}
                                />
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-form-label">اختر المكافأة:</label>
                                <select
                                    className="pr-form-select"
                                    value={selectedRewardId}
                                    onChange={(e) => setSelectedRewardId(e.target.value)}
                                    required
                                >
                                    {rewards.map((r) => (
                                        <option key={r.id} value={r.id} disabled={selectedStudentForRedeem.points < r.points_cost}>
                                            {r.name} - ({r.points_cost} نقطة) {selectedStudentForRedeem.points < r.points_cost ? ' [الرصيد غير كافٍ]' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-form-label">ملاحظات الصرف والتسليم:</label>
                                <textarea
                                    className="pr-form-textarea"
                                    rows="2"
                                    placeholder="ملاحظات تسليم الجائزة للطالب..."
                                    value={redeemNotes}
                                    onChange={(e) => setRedeemNotes(e.target.value)}
                                />
                            </div>

                            <div className="pr-modal-footer">
                                <button type="button" className="pr-btn-secondary" onClick={() => setIsRedeemModalOpen(false)}>
                                    إلغاء
                                </button>
                                <button type="submit" className="pr-action-btn-green">
                                    تأكيد الصرف والخصم
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 4. Modal معالجة طلب المكافأة (موافقة / رفض / تسليم) */}
            {claimActionModal.open && claimActionModal.claim && (
                <div className="pr-modal-overlay">
                    <div className="pr-modal-box">
                        <div className="pr-modal-header">
                            <h3 className="pr-modal-title">
                                {claimActionModal.action === 'APPROVE' && 'الموافقة على طلب المكافأة'}
                                {claimActionModal.action === 'REJECT' && 'رفض طلب المكافأة'}
                                {claimActionModal.action === 'DELIVER' && 'تأكيد تسليم المكافأة'}
                            </h3>
                            <button className="pr-modal-close" onClick={() => setClaimActionModal({ open: false, claim: null, action: '' })}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleExecuteClaimAction}>
                            <div className="pr-form-group">
                                <label className="pr-form-label">بيانات الطلب:</label>
                                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
                                    <div><strong>الطالب:</strong> {claimActionModal.claim.student_name}</div>
                                    <div><strong>المكافأة:</strong> {claimActionModal.claim.reward_name} ({claimActionModal.claim.points_spent} نقطة)</div>
                                    <div><strong>الرصيد الحالي للطالب:</strong> {claimActionModal.claim.student_current_points} نقطة</div>
                                    {claimActionModal.claim.notes && <div><strong>ملاحظة الطالب:</strong> {claimActionModal.claim.notes}</div>}
                                </div>
                            </div>

                            {claimActionModal.action === 'REJECT' && (
                                <div className="pr-form-group">
                                    <label className="pr-form-label">سبب الرفض (سيظهر للطالب وولي الأمر):</label>
                                    <textarea
                                        className="pr-form-textarea"
                                        rows="3"
                                        placeholder="اكتب سبب الرفض هنا..."
                                        value={claimRejectionReason}
                                        onChange={(e) => setClaimRejectionReason(e.target.value)}
                                        required
                                    />
                                </div>
                            )}

                            <div className="pr-form-group">
                                <label className="pr-form-label">ملاحظات الإدارة للطالب (اختياري):</label>
                                <textarea
                                    className="pr-form-textarea"
                                    rows="2"
                                    placeholder="ملاحظات توجيهية أو تشجيعية..."
                                    value={claimAdminNotes}
                                    onChange={(e) => setClaimAdminNotes(e.target.value)}
                                />
                            </div>

                            <div className="pr-modal-footer">
                                <button
                                    type="button"
                                    className="pr-btn-secondary"
                                    onClick={() => setClaimActionModal({ open: false, claim: null, action: '' })}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className={claimActionModal.action === 'REJECT' ? 'pr-action-btn-red' : 'pr-action-btn-green'}
                                    disabled={isActionSubmitting}
                                >
                                    {isActionSubmitting ? 'جاري المعالجة...' : 'تأكيد الإجراء'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 5. Modal إضافة / تعديل مكافأة */}
            {isRewardModalOpen && (
                <div className="pr-modal-overlay">
                    <div className="pr-modal-box">
                        <div className="pr-modal-header">
                            <h3 className="pr-modal-title">{editingReward ? 'تعديل المكافأة' : 'إضافة مكافأة جديدة'}</h3>
                            <button className="pr-modal-close" onClick={() => setIsRewardModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveReward}>
                            <div className="pr-form-group">
                                <label className="pr-form-label">اسم المكافأة:</label>
                                <input
                                    type="text"
                                    className="pr-form-input"
                                    placeholder="مثال: مصحف تهجد، ساعة ذكية..."
                                    value={rewardFormData.name}
                                    onChange={(e) => setRewardFormData({ ...rewardFormData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="pr-form-group">
                                    <label className="pr-form-label">النقاط المطلوبة:</label>
                                    <input
                                        type="number"
                                        className="pr-form-input"
                                        min="1"
                                        value={rewardFormData.points_cost}
                                        onChange={(e) => setRewardFormData({ ...rewardFormData, points_cost: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="pr-form-group">
                                    <label className="pr-form-label">الكمية:</label>
                                    <input
                                        type="number"
                                        className="pr-form-input"
                                        min="0"
                                        value={rewardFormData.stock_quantity}
                                        onChange={(e) => setRewardFormData({ ...rewardFormData, stock_quantity: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-form-label">رابط صورة المكافأة:</label>
                                <input
                                    type="url"
                                    className="pr-form-input"
                                    placeholder="https://..."
                                    value={rewardFormData.image}
                                    onChange={(e) => setRewardFormData({ ...rewardFormData, image: e.target.value })}
                                />
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-form-label">وصف المكافأة:</label>
                                <textarea
                                    className="pr-form-textarea"
                                    rows="2"
                                    placeholder="شروط ومعلومات المكافأة..."
                                    value={rewardFormData.description}
                                    onChange={(e) => setRewardFormData({ ...rewardFormData, description: e.target.value })}
                                />
                            </div>

                            <div className="pr-modal-footer">
                                <button type="button" className="pr-btn-secondary" onClick={() => setIsRewardModalOpen(false)}>
                                    إلغاء
                                </button>
                                <button type="submit" className="pr-action-btn-green" disabled={rewardFormData.stock_quantity < 0}>
                                    {editingReward ? 'حفظ التعديلات' : 'إضافة المكافأة'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 6. Modal إنشاء / تعديل مسابقة */}
            {isCompetitionModalOpen && (
                <div className="pr-modal-overlay">
                    <div className="pr-modal-box">
                        <div className="pr-modal-header">
                            <h3 className="pr-modal-title">{editingCompetition ? 'تعديل المسابقة' : 'إنشاء مسابقة تفاعلية جديدة'}</h3>
                            <button className="pr-modal-close" onClick={() => setIsCompetitionModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCompetition}>
                            <div className="pr-form-group">
                                <label className="pr-form-label">عنوان المسابقة:</label>
                                <input
                                    type="text"
                                    className="pr-form-input"
                                    placeholder="مثال: مسابقة سورة الكهف، مسابقة التجويد الأسبوعية..."
                                    value={compFormData.title}
                                    onChange={(e) => setCompFormData({ ...compFormData, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="pr-form-group">
                                    <label className="pr-form-label">مدة الحل (بالدقائق):</label>
                                    <input
                                        type="number"
                                        className="pr-form-input"
                                        min="1"
                                        value={compFormData.duration_minutes}
                                        onChange={(e) => setCompFormData({ ...compFormData, duration_minutes: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="pr-form-group">
                                    <label className="pr-form-label">نقاط الجائزة:</label>
                                    <input
                                        type="number"
                                        className="pr-form-input"
                                        min="1"
                                        value={compFormData.points_reward}
                                        onChange={(e) => setCompFormData({ ...compFormData, points_reward: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-form-label">وصف المسابقة:</label>
                                <textarea
                                    className="pr-form-textarea"
                                    rows="2"
                                    placeholder="تعليمات وشروط المسابقة..."
                                    value={compFormData.description}
                                    onChange={(e) => setCompFormData({ ...compFormData, description: e.target.value })}
                                />
                            </div>

                            <div className="pr-modal-footer">
                                <button type="button" className="pr-btn-secondary" onClick={() => setIsCompetitionModalOpen(false)}>
                                    إلغاء
                                </button>
                                <button type="submit" className="pr-action-btn-green">
                                    {editingCompetition ? 'حفظ التعديلات' : 'إنشاء المسابقة'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal تأكيد الحذف */}
            {confirmDeleteModal.open && (
                <div className="pr-modal-overlay">
                    <div className="pr-modal-box" style={{ maxWidth: 420 }}>
                        <div className="pr-modal-header">
                            <h3 className="pr-modal-title" style={{ color: '#dc2626' }}>تأكيد الحذف</h3>
                            <button className="pr-modal-close" onClick={() => setConfirmDeleteModal({ open: false, type: '', id: null, title: '' })}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '1.2rem', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#334155' }}>
                                هل أنت متأكد من رغبتك في حذف{' '}
                                <strong>"{confirmDeleteModal.title}"</strong>؟
                            </p>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                لن يمكنك التراجع عن هذا الإجراء وسيتم حذف كافة السجلات المرتبطة به.
                            </p>
                        </div>
                        <div className="pr-modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
                            <button type="button" className="pr-btn-secondary" onClick={() => setConfirmDeleteModal({ open: false, type: '', id: null, title: '' })}>
                                إلغاء
                            </button>
                            <button
                                type="button"
                                style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.6rem 1.4rem', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
                                onClick={handleExecuteDelete}
                            >
                                نعم، احذف
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. Modal إضافة سؤال للمسابقة */}
            {isQuestionModalOpen && selectedCompForQuestion && (
                <div className="pr-modal-overlay">
                    <div className="pr-modal-box">
                        <div className="pr-modal-header">
                            <h3 className="pr-modal-title">إضافة سؤال إلى: {selectedCompForQuestion.title}</h3>
                            <button className="pr-modal-close" onClick={() => setIsQuestionModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuestion}>
                            <div className="pr-form-group">
                                <label className="pr-form-label">نوع السؤال:</label>
                                <select
                                    className="pr-form-select"
                                    value={questionFormData.question_type}
                                    onChange={(e) => setQuestionFormData({ ...questionFormData, question_type: e.target.value })}
                                >
                                    <option value="MULTIPLE_CHOICE">اختيار من متعدد (مؤتمت)</option>
                                    <option value="TRUE_FALSE">صح أو خطأ (مؤتمت)</option>
                                    <option value="ESSAY">سؤال تحريري / مقالي (مراجعة بشرية)</option>
                                    <option value="MATCHING">مطابقة</option>
                                </select>
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-form-label">نص السؤال:</label>
                                <textarea
                                    className="pr-form-textarea"
                                    rows="2"
                                    placeholder="اكتب نص السؤال هنا..."
                                    value={questionFormData.question_text}
                                    onChange={(e) => setQuestionFormData({ ...questionFormData, question_text: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Options for MCQ */}
                            {questionFormData.question_type === 'MULTIPLE_CHOICE' && (
                                <div className="pr-form-group">
                                    <label className="pr-form-label">الخيارات الأربعة:</label>
                                    {questionFormData.options.map((opt, idx) => (
                                        <input
                                            key={idx}
                                            type="text"
                                            className="pr-form-input"
                                            placeholder={`الخيار ${idx + 1}`}
                                            style={{ marginBottom: 6 }}
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...questionFormData.options];
                                                newOpts[idx] = e.target.value;
                                                setQuestionFormData({ ...questionFormData, options: newOpts });
                                            }}
                                            required
                                        />
                                    ))}
                                    <label className="pr-form-label" style={{ marginTop: 8 }}>الإجابة الصحيحة:</label>
                                    <input
                                        type="text"
                                        className="pr-form-input"
                                        placeholder="اكتب النص المطابق تماماً للخيار الصحيح"
                                        value={questionFormData.correct_answer}
                                        onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value })}
                                        required
                                    />
                                </div>
                            )}

                            {/* Options for True/False */}
                            {questionFormData.question_type === 'TRUE_FALSE' && (
                                <div className="pr-form-group">
                                    <label className="pr-form-label">الإجابة الصحيحة:</label>
                                    <select
                                        className="pr-form-select"
                                        value={questionFormData.correct_answer}
                                        onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value, options: ['صح', 'خطأ'] })}
                                        required
                                    >
                                        <option value="">اختر الإجابة</option>
                                        <option value="صح">صح</option>
                                        <option value="خطأ">خطأ</option>
                                    </select>
                                </div>
                            )}

                            {/* Essay guidelines */}
                            {questionFormData.question_type === 'ESSAY' && (
                                <div className="pr-form-group">
                                    <label className="pr-form-label">معيار التصحيح / الإجابة النموذجية للمراجع:</label>
                                    <textarea
                                        className="pr-form-textarea"
                                        rows="2"
                                        placeholder="المعايير المعتمدة لتقييم إجابة الطالب المقالية..."
                                        value={questionFormData.correct_answer}
                                        onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="pr-form-group">
                                <label className="pr-form-label">درجة السؤال:</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    className="pr-form-input"
                                    value={questionFormData.points}
                                    onChange={(e) => setQuestionFormData({ ...questionFormData, points: Number(e.target.value) })}
                                    required
                                />
                            </div>

                            <div className="pr-modal-footer">
                                <button type="button" className="pr-btn-secondary" onClick={() => setIsQuestionModalOpen(false)}>
                                    إلغاء
                                </button>
                                <button type="submit" className="pr-action-btn-green">
                                    {editingQuestion ? 'تحديث السؤال' : 'إضافة السؤال'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const PointsAndRewards = () => {
    const { isMobile } = useDeviceType();
    return isMobile ? <MobilePointsAndRewards /> : <DesktopPointsAndRewards />;
};

export default PointsAndRewards;
