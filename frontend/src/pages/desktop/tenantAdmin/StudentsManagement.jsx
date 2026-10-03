import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    MagnifyingGlass, PhoneCall, Star, CaretDown, CaretLeft, CaretRight, Users, Bell, Plus, PencilSimple, Trash, SquaresFour, ListBullets, CheckCircle, XCircle, MapPin, Books, GraduationCap, ArrowsClockwise, X, Eye, WhatsappLogo, Heart, Wheelchair, ClockCounterClockwise, UserPlus, UserSwitch, Check, Prohibit, WarningCircle, Checks
} from '@phosphor-icons/react';
import {
    getStudents, getStudentById, createStudent, updateStudent, deleteStudent, getHalaqat, getProjects, getProjectStages, getMosqueAdminDashboardData, getStudentRegistrationRequests, getStudentDeletionRequests, approveStudentRegistrationRequest, rejectStudentRegistrationRequest, approveStudentDeletionRequest, rejectStudentDeletionRequest, bulkApproveStudentRequests
} from '../../../services/api/tenantService';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileStudentsManagement from '../../mobile/tenantAdmin/MobileStudentsManagement';

const StudentsManagement = () => {
    const { isMobile } = useDeviceType();
    const navigate = useNavigate();
    const location = useLocation();

    // Navigation Tab (Main View: 'students' or 'requests')
    const [mainView, setMainView] = useState('students');
    const [bulkConfirmModal, setBulkConfirmModal] = useState({ isOpen: false, type: '', label: '', count: 0 });

    // Data States
    const [students, setStudents] = useState([]);
    const [halaqat, setHalaqat] = useState([]);
    const [centers, setCenters] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters and Search for Students
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCenterId, setSelectedCenterId] = useState('all');
    const [selectedRingId, setSelectedRingId] = useState('all');
    const [selectedGender, setSelectedGender] = useState('all');
    const [selectedSocialStatus, setSelectedSocialStatus] = useState('all');
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'name', 'points', 'reached_page'
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

    // Modals
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [studentToEdit, setStudentToEdit] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);

    // Dynamic Stages & Parts for Add Student Wizard
    const [projectStages, setProjectStages] = useState([]);
    const [stageParts, setStageParts] = useState([]);
    const [loadingStages, setLoadingStages] = useState(false);

    // Requests Panel States (Task 6)
    const [addRequests, setAddRequests] = useState([]);
    const [updateRequests, setUpdateRequests] = useState([]);
    const [deleteRequests, setDeleteRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [requestsTab, setRequestsTab] = useState('ADD'); // 'ADD' | 'UPDATE' | 'DELETE'
    const [requestSearchQuery, setRequestSearchQuery] = useState('');
    const [requestStatusFilter, setRequestStatusFilter] = useState('ALL');

    // Rejection Modal State
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [requestToReject, setRequestToReject] = useState(null); // { id, requestType: 'REGISTRATION'|'DELETION' }
    const [rejectionReasonInput, setRejectionReasonInput] = useState('');
    const [actionProcessing, setActionProcessing] = useState(false);

    // Submission & Feedback
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    // Wizard Form Data (Enhanced with project, stage, part for Task 3, 4, 5)
    const initialFormData = {
        full_name: '',
        gender: 'M',
        birth_date: '',
        national_id: '',
        registration_number: '',
        current_residence: '',
        is_orphan: false,
        has_special_needs: false,
        special_needs_notes: '',
        parent_name: '',
        parent_phone: '',
        mother_name: '',
        mother_phone: '',
        income_level: '',
        general_notes: '',
        halaqa_id: '',
        project_id: '',
        stage_id: '',
        part_id: '',
        reached_page: 1,
        points: 0
    };
    const [formData, setFormData] = useState(initialFormData);

    // Date String
    const currentUserName = localStorage.getItem('username') || 'مدير النظام';
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    if (isMobile) {
        return <MobileStudentsManagement />;
    }

    useEffect(() => {
        loadInitialData();
        fetchRequestsData();
    }, []);

    // Deep-linking from Dashboard (Phase 5: Student Navigation)
    useEffect(() => {
        const targetStudentId = location.state?.targetStudentId;
        if (targetStudentId) {
            setMainView('students');
            const found = students.find(s => String(s.id) === String(targetStudentId));
            if (found) {
                setSelectedStudentDetails(found);
                setIsDetailsModalOpen(true);
            } else {
                getStudentById(targetStudentId).then(res => {
                    if (res && res.data) {
                        setSelectedStudentDetails(res.data);
                        setIsDetailsModalOpen(true);
                    }
                }).catch(err => console.warn('Could not fetch student by id:', err));
            }
        }
    }, [location.state, students]);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 4000);
    };

    const loadInitialData = async (isManual = false) => {
        try {
            if (isManual) setRefreshing(true);
            else setLoading(true);

            const [studentsRes, halaqatRes, centersRes, projectsRes] = await Promise.all([
                getStudents().catch(() => ({ data: [] })),
                getHalaqat().catch(() => ({ data: [] })),
                getMosqueAdminDashboardData('all').catch(() => ({ data: { centers: [] } })),
                getProjects().catch(() => ({ data: [] }))
            ]);

            if (studentsRes && studentsRes.data) {
                setStudents(studentsRes.data);
            }
            if (halaqatRes && halaqatRes.data) {
                setHalaqat(halaqatRes.data);
            }
            if (centersRes && centersRes.data && centersRes.data.centers) {
                setCenters(centersRes.data.centers);
            }
            if (projectsRes && projectsRes.data) {
                setProjects(projectsRes.data);
            }
        } catch (error) {
            console.error('Error fetching students data:', error);
            showToast('حدث خطأ أثناء تحميل بيانات الطلاب');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchRequestsData = useCallback(async () => {
        setRequestsLoading(true);
        try {
            const [regRes, delRes] = await Promise.all([
                getStudentRegistrationRequests().catch(() => ({ data: [] })),
                getStudentDeletionRequests().catch(() => ({ data: [] }))
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
            console.error('Failed to fetch requests data:', err);
        } finally {
            setRequestsLoading(false);
        }
    }, []);

    // Helper: Dynamic Stage & Part Loading (Task 5)
    const loadProjectStagesData = async (projectId) => {
        if (!projectId) {
            setProjectStages([]);
            setStageParts([]);
            setFormData(prev => ({ ...prev, stage_id: '', part_id: '' }));
            return;
        }

        setLoadingStages(true);
        try {
            const res = await getProjectStages(projectId);
            const stagesList = res?.data || res || [];
            setProjectStages(Array.isArray(stagesList) ? stagesList : []);

            // Check if current stage belongs to new project, if not reset
            setFormData(prev => {
                const stageExists = stagesList.some(s => String(s.id) === String(prev.stage_id));
                return {
                    ...prev,
                    stage_id: stageExists ? prev.stage_id : '',
                    part_id: stageExists ? prev.part_id : ''
                };
            });
        } catch (err) {
            console.error('Error fetching project stages:', err);
            setProjectStages([]);
            setStageParts([]);
        } finally {
            setLoadingStages(false);
        }
    };

    // Task 4: Auto-link Halaqa -> Project
    const handleHalaqaChangeInWizard = (halaqaId) => {
        const selectedHalaqa = halaqat.find(h => String(h.id) === String(halaqaId));

        if (selectedHalaqa && selectedHalaqa.project_id) {
            const autoProjectId = selectedHalaqa.project_id;
            setFormData(prev => ({
                ...prev,
                halaqa_id: halaqaId,
                project_id: autoProjectId,
                stage_id: '',
                part_id: ''
            }));
            loadProjectStagesData(autoProjectId);
        } else {
            setFormData(prev => ({
                ...prev,
                halaqa_id: halaqaId
            }));
        }
    };

    // Manual Project Change (Task 5)
    const handleProjectChangeInWizard = (projectId) => {
        setFormData(prev => ({
            ...prev,
            project_id: projectId,
            stage_id: '',
            part_id: ''
        }));
        loadProjectStagesData(projectId);
    };

    // Stage Change
    const handleStageChangeInWizard = (stageId) => {
        const selectedStage = projectStages.find(s => String(s.id) === String(stageId));
        const parts = selectedStage?.parts || [];
        setStageParts(parts);
        setFormData(prev => ({
            ...prev,
            stage_id: stageId,
            part_id: ''
        }));
    };

    // Format Date Helper
    const formatDate = (isoString) => {
        if (!isoString) return 'غير متوفر';
        try {
            return new Date(isoString).toLocaleDateString('ar-SA');
        } catch (e) {
            return isoString;
        }
    };

    // Initials Helper
    const getInitials = (name) => {
        if (!name) return 'ط';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
        return parts[0][0] || 'ط';
    };

    // Filter Students List
    const filteredStudents = students
        .filter(st => {
            const q = searchQuery.trim().toLowerCase();
            const nameMatch = !q || (st.full_name || '').toLowerCase().includes(q) || (st.national_id || '').includes(q) || (st.parent_name || '').toLowerCase().includes(q);
            const centerMatch = selectedCenterId === 'all' || String(st.center_id) === String(selectedCenterId);
            const ringMatch = selectedRingId === 'all' || String(st.halaqa_id) === String(selectedRingId);
            const genderMatch = selectedGender === 'all' || st.gender === selectedGender;

            let socialMatch = true;
            if (selectedSocialStatus === 'orphan') socialMatch = st.is_orphan === true;
            else if (selectedSocialStatus === 'special_needs') socialMatch = st.has_special_needs === true;

            return nameMatch && centerMatch && ringMatch && genderMatch && socialMatch;
        })
        .sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            }
            if (sortBy === 'name') {
                return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
            }
            if (sortBy === 'points') {
                return (b.points || 0) - (a.points || 0);
            }
            if (sortBy === 'reached_page') {
                return (b.reached_page || 0) - (a.reached_page || 0);
            }
            return 0;
        });

    // Count pending requests
    const pendingAddCount = addRequests.filter(r => r.status === 'PENDING').length;
    const pendingUpdateCount = updateRequests.filter(r => r.status === 'PENDING').length;
    const pendingDeleteCount = deleteRequests.filter(r => r.status === 'PENDING').length;
    const totalPendingRequestsCount = pendingAddCount + pendingUpdateCount + pendingDeleteCount;

    // Open Wizard for Add
    const handleOpenAddWizard = () => {
        setStudentToEdit(null);
        setFormData(initialFormData);
        setProjectStages([]);
        setStageParts([]);
        setWizardStep(1);
        setModalError('');
        setIsWizardOpen(true);
    };

    // Open Wizard for Edit
    const handleOpenEditWizard = (student) => {
        setStudentToEdit(student);
        const editFormData = {
            full_name: student.full_name || '',
            gender: student.gender || 'M',
            birth_date: student.birth_date ? student.birth_date.split('T')[0] : '',
            national_id: student.national_id || '',
            registration_number: student.registration_number || '',
            current_residence: student.current_residence || '',
            is_orphan: !!student.is_orphan,
            has_special_needs: !!student.has_special_needs,
            special_needs_notes: student.special_needs_notes || '',
            parent_name: student.parent_name || '',
            parent_phone: student.parent_phone || '',
            mother_name: student.mother_name || '',
            mother_phone: student.mother_phone || '',
            income_level: student.income_level || '',
            general_notes: student.general_notes || '',
            halaqa_id: student.halaqa_id || '',
            project_id: student.project_id || '',
            stage_id: student.stage_id || '',
            part_id: student.part_id || '',
            reached_page: student.reached_page || 1,
            points: student.points || 0
        };
        setFormData(editFormData);
        if (student.project_id) {
            loadProjectStagesData(student.project_id);
        }
        setWizardStep(1);
        setModalError('');
        setIsWizardOpen(true);
    };

    // Open Delete Confirmation
    const handleOpenDeleteModal = (student) => {
        setStudentToDelete(student);
        setIsDeleteModalOpen(true);
    };

    // Confirm Delete
    const handleConfirmDelete = async () => {
        if (!studentToDelete) return;
        try {
            setSubmitting(true);
            await deleteStudent(studentToDelete.id);
            showToast(`تم حذف ملف الطالب "${studentToDelete.full_name}" بنجاح`);
            setIsDeleteModalOpen(false);
            setStudentToDelete(null);
            await loadInitialData(true);
        } catch (error) {
            console.error('Error deleting student:', error);
            showToast('حدث خطأ أثناء حذف ملف الطالب');
        } finally {
            setSubmitting(false);
        }
    };

    // Open Details Modal
    const handleOpenDetailsModal = (student) => {
        setSelectedStudentDetails(student);
        setIsDetailsModalOpen(true);
    };

    // Submit Wizard (Add / Edit)
    const handleWizardSubmit = async (e) => {
        e.preventDefault();
        setModalError('');

        if (!formData.full_name.trim()) {
            setModalError('الاسم الكامل للطالب مطلوب');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                ...formData,
                full_name: formData.full_name.trim(),
                reached_page: parseInt(formData.reached_page) || 1,
                points: parseInt(formData.points) || 0
            };

            if (studentToEdit) {
                await updateStudent(studentToEdit.id, payload);
                showToast(`تم تحديث بيانات الطالب "${payload.full_name}" بنجاح`);
            } else {
                await createStudent(payload);
                showToast(`تمت إضافة الطالب "${payload.full_name}" بنجاح إلى قاعدة البيانات`);
            }

            setIsWizardOpen(false);
            await loadInitialData(true);
        } catch (error) {
            console.error('Error saving student:', error);
            const msg = error.response?.data?.message || 'حدث خطأ أثناء حفظ بيانات الطالب. يرجى التحقق من البيانات';
            setModalError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Task 6 Actions: Approve Request
    const handleApproveRequest = async (requestObj, type) => {
        setActionProcessing(true);
        try {
            let res;
            if (type === 'DELETION') {
                res = await approveStudentDeletionRequest(requestObj.id);
            } else {
                res = await approveStudentRegistrationRequest(requestObj.id);
            }

            if (res.status === 'success') {
                showToast(res.message || 'تمت الموافقة على الطلب وتنفيذ الإجراء وإرسال الإشعار بنجاح');
                fetchRequestsData();
                loadInitialData(true);
            } else {
                showToast(res.message || 'فشلت عملية الموافقة على الطلب');
            }
        } catch (err) {
            console.error('Error approving request:', err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء الموافقة على الطلب');
        } finally {
            setActionProcessing(false);
        }
    };

    // Task 6 Actions: Open Reject Modal
    const handleOpenRejectModal = (requestObj, type) => {
        setRequestToReject({ ...requestObj, type });
        setRejectionReasonInput('');
        setIsRejectModalOpen(true);
    };

    // Confirm Reject Request
    const handleConfirmRejectRequest = async () => {
        if (!requestToReject) return;
        setActionProcessing(true);
        try {
            let res;
            const payload = { rejection_reason: rejectionReasonInput.trim() };
            if (requestToReject.type === 'DELETION') {
                res = await rejectStudentDeletionRequest(requestToReject.id, payload);
            } else {
                res = await rejectStudentRegistrationRequest(requestToReject.id, payload);
            }

            if (res.status === 'success') {
                showToast(res.message || 'تم رفض الطلب وتسجيل السبب وإرسال الإشعار للمعلم');
                setIsRejectModalOpen(false);
                setRequestToReject(null);
                setRejectionReasonInput('');
                fetchRequestsData();
            } else {
                showToast(res.message || 'فشلت عملية رفض الطلب');
            }
        } catch (err) {
            console.error('Error rejecting request:', err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء رفض الطلب');
        } finally {
            setActionProcessing(false);
        }
    };

    // Bulk Approval Handler (Phase 7)
    const handleConfirmBulkApprove = async () => {
        if (!bulkConfirmModal.type) return;
        setActionProcessing(true);
        try {
            const res = await bulkApproveStudentRequests({ request_type: bulkConfirmModal.type });
            if (res.status === 'success') {
                const countApproved = res.count !== undefined ? res.count : bulkConfirmModal.count;
                showToast(`تمت الموافقة بنجاح على ${countApproved} من ${bulkConfirmModal.label}`);
                setBulkConfirmModal({ isOpen: false, type: '', label: '', count: 0 });
                fetchRequestsData();
                loadInitialData(true);
            } else {
                showToast(res.message || 'فشلت عملية الموافقة الجماعية');
            }
        } catch (err) {
            console.error('Error during bulk approval:', err);
            showToast(err.response?.data?.message || 'حدث خطأ أثناء الموافقة الجماعية');
        } finally {
            setActionProcessing(false);
        }
    };

    // Get Filtered List for Requests Panel
    const getFilteredRequestsList = () => {
        let list = [];
        if (requestsTab === 'ADD') list = addRequests;
        else if (requestsTab === 'UPDATE') list = updateRequests;
        else if (requestsTab === 'DELETE') list = deleteRequests;

        return list.filter(r => {
            const q = requestSearchQuery.trim().toLowerCase();
            const nameMatch = !q ||
                (r.full_name || r.student_name || '').toLowerCase().includes(q) ||
                (r.parent_name || '').toLowerCase().includes(q) ||
                (r.halaqa_name || '').toLowerCase().includes(q) ||
                (r.reason || '').toLowerCase().includes(q);

            const statusMatch = requestStatusFilter === 'ALL' || r.status === requestStatusFilter;
            return nameMatch && statusMatch;
        });
    };

    const currentRequestsList = getFilteredRequestsList();

    return (
        <div className="dashboard-container" style={{
            padding: '1.5rem 2rem',
            maxWidth: '1240px',
            margin: '0 auto',
            direction: 'rtl',
            minHeight: '100vh',
            background: '#fcfcfc'
        }}>
            {/* Toast Notification */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    left: '24px',
                    zIndex: 9999,
                    background: '#133315',
                    color: '#fff',
                    padding: '0.85rem 1.75rem',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    direction: 'rtl'
                }}>
                    <CheckCircle size={22} color="#7cb342" weight="fill" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header */}
            <div className="dashboard-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.5rem', fontWeight: 800 }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
                        {dateStr}
                    </p>
                </div>

                <div className="header-actions" style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Refresh Button */}
                    <button
                        onClick={() => { loadInitialData(true); fetchRequestsData(); }}
                        disabled={refreshing || requestsLoading}
                        title="تحديث البيانات"
                        style={{
                            width: '42px',
                            height: '42px',
                            background: '#ffffff',
                            border: '1px solid #eee',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            color: '#133315',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                        }}
                    >
                        <ArrowsClockwise size={18} className={(refreshing || requestsLoading) ? 'spin-animation' : ''} />
                    </button>

                    {/* Center Filter Dropdown */}
                    <div className="select-center" style={{ position: 'relative' }}>
                        <select
                            value={selectedCenterId}
                            onChange={(e) => {
                                const newCenterId = e.target.value;
                                setSelectedCenterId(newCenterId);
                                if (newCenterId !== 'all' && selectedRingId !== 'all') {
                                    const currentRing = halaqat.find(r => String(r.id) === String(selectedRingId));
                                    const ringCenterId = currentRing?.center_id || currentRing?.center?.id || currentRing?.center;
                                    if (ringCenterId && String(ringCenterId) !== String(newCenterId)) {
                                        setSelectedRingId('all');
                                    }
                                }
                            }}
                            style={{
                                appearance: 'none',
                                border: '1px solid #eee',
                                padding: '0.55rem 2.4rem 0.55rem 1rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#133315',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit',
                                minWidth: '150px',
                                fontSize: '0.9rem',
                                direction: 'rtl'
                            }}
                        >
                            <option value="all">جميع المراكز</option>
                            {centers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <MapPin size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <CaretDown size={14} color="#888" style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* Halaqa Filter Dropdown */}
                    <div className="select-halaqa" style={{ position: 'relative' }}>
                        <select
                            value={selectedRingId}
                            onChange={(e) => {
                                const newRingId = e.target.value;
                                setSelectedRingId(newRingId);
                                if (newRingId !== 'all') {
                                    const targetHalaqa = halaqat.find(r => String(r.id) === String(newRingId));
                                    const ringCenterId = targetHalaqa?.center_id || targetHalaqa?.center?.id || targetHalaqa?.center;
                                    if (ringCenterId) {
                                        setSelectedCenterId(String(ringCenterId));
                                    }
                                }
                            }}
                            style={{
                                appearance: 'none',
                                border: '1px solid #eee',
                                padding: '0.55rem 2.4rem 0.55rem 1rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#133315',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit',
                                minWidth: '150px',
                                fontSize: '0.9rem',
                                direction: 'rtl'
                            }}
                        >
                            <option value="all">كل الحلقات</option>
                            {halaqat
                                .filter(r => selectedCenterId === 'all' || String(r.center_id || r.center?.id || r.center) === String(selectedCenterId))
                                .map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))
                            }
                        </select>
                        <Users size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <CaretDown size={14} color="#888" style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* Notification Bell */}
                    <div className="icon-btn" style={{
                        position: 'relative',
                        background: '#fff',
                        border: '1px solid #eee',
                        padding: '0.55rem',
                        borderRadius: '50%',
                        cursor: 'pointer'
                    }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Main Navigation Tabs: Students vs Requests (Task 6) */}
            <div style={{
                display: 'flex',
                gap: '1rem',
                borderBottom: '2px solid #e2e8f0',
                marginBottom: '1.5rem',
                paddingBottom: '0.2rem'
            }}>
                <button
                    onClick={() => setMainView('students')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        background: 'transparent',
                        borderBottom: mainView === 'students' ? '3px solid #133315' : '3px solid transparent',
                        color: mainView === 'students' ? '#133315' : '#64748b',
                        fontWeight: mainView === 'students' ? 800 : 600,
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <Users size={22} weight={mainView === 'students' ? 'bold' : 'regular'} />
                    <span>دليل الطلاب ({students.length})</span>
                </button>

                <button
                    onClick={() => setMainView('requests')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        background: 'transparent',
                        borderBottom: mainView === 'requests' ? '3px solid #133315' : '3px solid transparent',
                        color: mainView === 'requests' ? '#133315' : '#64748b',
                        fontWeight: mainView === 'requests' ? 800 : 600,
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <ClockCounterClockwise size={22} weight={mainView === 'requests' ? 'bold' : 'regular'} />
                    <span>طلبات المعلمين</span>
                    {totalPendingRequestsCount > 0 && (
                        <span style={{
                            background: '#e65100',
                            color: '#fff',
                            borderRadius: '12px',
                            padding: '0.15rem 0.55rem',
                            fontSize: '0.78rem',
                            fontWeight: 800
                        }}>
                            {totalPendingRequestsCount} معلقة
                        </span>
                    )}
                </button>
            </div>

            {/* =========================================================================
                MAIN VIEW 1: STUDENTS LIST (قائمة الطلاب)
            ========================================================================== */}
            {mainView === 'students' && (
                <>
                    {/* Title & Actions Bar */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1.5rem',
                        flexWrap: 'wrap',
                        gap: '1rem'
                    }}>
                        <div>
                            <h2 style={{ fontSize: '1.75rem', color: '#133315', fontWeight: 800, margin: '0 0 0.2rem 0' }}>
                                إدارة ملفات الطلاب
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                                عرض وتعديل وإضافة الطلاب المسجلين بالحلقات القرآنية والمشروعات
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            {/* View Switcher */}
                            <div style={{
                                background: '#f1f5f9',
                                padding: '3px',
                                borderRadius: '8px',
                                display: 'flex',
                                gap: '2px'
                            }}>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    style={{
                                        border: 'none',
                                        background: viewMode === 'grid' ? '#fff' : 'transparent',
                                        color: viewMode === 'grid' ? '#133315' : '#64748b',
                                        padding: '0.4rem 0.7rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="عرض شبكي"
                                >
                                    <SquaresFour size={18} />
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    style={{
                                        border: 'none',
                                        background: viewMode === 'table' ? '#fff' : 'transparent',
                                        color: viewMode === 'table' ? '#133315' : '#64748b',
                                        padding: '0.4rem 0.7rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="عرض جدولي"
                                >
                                    <ListBullets size={18} />
                                </button>
                            </div>

                            {/* Add Student Button */}
                            <button
                                onClick={handleOpenAddWizard}
                                style={{
                                    background: '#133315',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '0.65rem 1.4rem',
                                    fontWeight: 700,
                                    fontSize: '0.92rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 4px 12px rgba(19, 51, 21, 0.25)'
                                }}
                            >
                                <Plus size={18} weight="bold" />
                                <span>إضافة طالب جديد</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div style={{
                        background: '#ffffff',
                        padding: '1.25rem',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '1.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Search Field */}
                            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                                <input
                                    type="text"
                                    placeholder="ابحث باسم الطالب، الهوية، أو ولي الأمر..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 2.4rem 0.65rem 1rem',
                                        borderRadius: '10px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.9rem',
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <MagnifyingGlass size={18} color="#94a3b8" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)' }} />
                            </div>

                            {/* Gender Filter */}
                            <select
                                value={selectedGender}
                                onChange={(e) => setSelectedGender(e.target.value)}
                                style={{
                                    padding: '0.65rem 1rem',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.88rem',
                                    background: '#fff',
                                    outline: 'none',
                                    color: '#334155',
                                    fontWeight: 600
                                }}
                            >
                                <option value="all">جميع الجنسين</option>
                                <option value="M">طلاب (ذكور)</option>
                                <option value="F">طالبات (إناث)</option>
                            </select>

                            {/* Social Status Filter */}
                            <select
                                value={selectedSocialStatus}
                                onChange={(e) => setSelectedSocialStatus(e.target.value)}
                                style={{
                                    padding: '0.65rem 1rem',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.88rem',
                                    background: '#fff',
                                    outline: 'none',
                                    color: '#334155',
                                    fontWeight: 600
                                }}
                            >
                                <option value="all">كافة الحالات الاجتماعية</option>
                                <option value="orphan">الطلاب الأيتام</option>
                                <option value="special_needs">ذوي الاحتياجات الخاصة</option>
                            </select>

                            {/* Sort By */}
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                style={{
                                    padding: '0.65rem 1rem',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.88rem',
                                    background: '#fff',
                                    outline: 'none',
                                    color: '#334155',
                                    fontWeight: 600
                                }}
                            >
                                <option value="newest">الأحدث تسجيلاً</option>
                                <option value="name">أبجدياً بالاسم</option>
                                <option value="points">الأعلى نقاطاً</option>
                                <option value="reached_page">الأكثر إنجازاً (صفحة الوصول)</option>
                            </select>
                        </div>
                    </div>

                    {/* Students List Display */}
                    {loading ? (
                        <div style={{ padding: '4rem', textAlign: 'center', color: '#133315', fontWeight: 700, fontSize: '1.1rem' }}>
                            <ArrowsClockwise size={32} className="spin-animation" style={{ marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem auto' }} />
                            جاري تحميل دليل الطلاب...
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div style={{
                            padding: '4rem 2rem',
                            textAlign: 'center',
                            background: '#ffffff',
                            borderRadius: '16px',
                            border: '1px dashed #cbd5e1'
                        }}>
                            <GraduationCap size={56} color="#94a3b8" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.4rem', fontWeight: 700 }}>
                                {searchQuery ? 'لا يوجد طلاب يطابقون خيارات البحث' : 'لا يوجد طلاب مسجلون حالياً'}
                            </h3>
                            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                يمكنك إضافة طالب جديد مباشرة بالنقر على زر "إضافة طالب جديد" أعلاه
                            </p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* GRID VIEW */
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '1.25rem'
                        }}>
                            {filteredStudents.map(student => (
                                <div
                                    key={student.id}
                                    style={{
                                        background: '#ffffff',
                                        borderRadius: '16px',
                                        border: '1px solid #e2e8f0',
                                        padding: '1.25rem',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        position: 'relative',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div>
                                        {/* Card Top Info */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: '44px',
                                                    height: '44px',
                                                    borderRadius: '50%',
                                                    background: student.gender === 'F' ? '#fce4ec' : '#e8f5e9',
                                                    color: student.gender === 'F' ? '#c2185b' : '#2e7d32',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 800,
                                                    fontSize: '1.1rem'
                                                }}>
                                                    {getInitials(student.full_name)}
                                                </div>
                                                <div>
                                                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                                                        {student.full_name}
                                                    </h3>
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        رقم التسجيل: {student.registration_number || '—'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Social Badges */}
                                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                {student.is_orphan && (
                                                    <span title="طالب يتيم" style={{ background: '#fef3c7', color: '#d97706', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        يتيم
                                                    </span>
                                                )}
                                                {student.has_special_needs && (
                                                    <span title="احتياجات خاصة" style={{ background: '#e0f2fe', color: '#0284c7', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        خاصة
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Halaqa & Center */}
                                        <div style={{
                                            background: '#f8fafc',
                                            borderRadius: '10px',
                                            padding: '0.75rem',
                                            marginBottom: '0.85rem',
                                            fontSize: '0.85rem',
                                            color: '#334155',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.3rem'
                                        }}>
                                            <div>
                                                <strong>الحلقة:</strong> <span style={{ color: '#133315', fontWeight: 700 }}>{student.halaqa_name || 'غير مسند لحلقة'}</span>
                                            </div>
                                            {student.center_name && (
                                                <div>
                                                    <strong>المركز:</strong> {student.center_name}
                                                </div>
                                            )}
                                            {student.parent_name && (
                                                <div>
                                                    <strong>ولي الأمر:</strong> {student.parent_name} {student.parent_phone ? `(${student.parent_phone})` : ''}
                                                </div>
                                            )}
                                        </div>

                                        {/* Stats Row */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr 1fr',
                                            gap: '0.5rem',
                                            textAlign: 'center',
                                            borderTop: '1px solid #f1f5f9',
                                            paddingTop: '0.75rem',
                                            marginBottom: '0.85rem'
                                        }}>
                                            <div>
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>صفحة الوصول</span>
                                                <strong style={{ fontSize: '1rem', color: '#e65100' }}>{student.reached_page || 1}</strong>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>النقاط</span>
                                                <strong style={{ fontSize: '1rem', color: '#558b2f' }}>{student.points || 0}</strong>
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>التقييم</span>
                                                <strong style={{ fontSize: '1rem', color: '#f57c00' }}>{student.rating || '0.0'}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                                        <button
                                            onClick={() => handleOpenDetailsModal(student)}
                                            style={{
                                                flex: 1,
                                                background: '#f1f5f9',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '0.45rem',
                                                color: '#334155',
                                                fontWeight: 700,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.3rem'
                                            }}
                                        >
                                            <Eye size={15} />
                                            <span>التفاصيل</span>
                                        </button>

                                        <button
                                            onClick={() => handleOpenEditWizard(student)}
                                            style={{
                                                background: '#e8f5e9',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '0.45rem 0.75rem',
                                                color: '#2e7d32',
                                                fontWeight: 700,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem'
                                            }}
                                            title="تعديل ملف الطالب"
                                        >
                                            <PencilSimple size={15} />
                                        </button>

                                        <button
                                            onClick={() => handleOpenDeleteModal(student)}
                                            style={{
                                                background: '#ffebee',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '0.45rem 0.75rem',
                                                color: '#c62828',
                                                fontWeight: 700,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem'
                                            }}
                                            title="حذف ملف الطالب"
                                        >
                                            <Trash size={15} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* TABLE VIEW */
                        <div style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                        <th style={{ padding: '0.85rem 1rem' }}>اسم الطالب</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>الحلقة والمركز</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>ولي الأمر والهاتف</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>صفحة الوصول</th>
                                        <th style={{ padding: '0.85rem 1rem' }}>النقاط</th>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map(student => (
                                        <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                                                {student.full_name}
                                                {student.is_orphan && <span style={{ marginRight: '6px', fontSize: '0.72rem', color: '#d97706', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>يتيم</span>}
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                                                {student.halaqa_name || '—'} {student.center_name ? `(${student.center_name})` : ''}
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                                                {student.parent_name || '—'} {student.parent_phone ? `• ${student.parent_phone}` : ''}
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#e65100' }}>
                                                {student.reached_page || 1}
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#558b2f' }}>
                                                {student.points || 0}
                                            </td>
                                            <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                    <button onClick={() => handleOpenDetailsModal(student)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '0.35rem 0.6rem', cursor: 'pointer' }} title="عرض الملف"><Eye size={16} color="#334155" /></button>
                                                    <button onClick={() => handleOpenEditWizard(student)} style={{ background: '#e8f5e9', border: 'none', borderRadius: '6px', padding: '0.35rem 0.6rem', cursor: 'pointer' }} title="تعديل"><PencilSimple size={16} color="#2e7d32" /></button>
                                                    <button onClick={() => handleOpenDeleteModal(student)} style={{ background: '#ffebee', border: 'none', borderRadius: '6px', padding: '0.35rem 0.6rem', cursor: 'pointer' }} title="حذف"><Trash size={16} color="#c62828" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* =========================================================================
                MAIN VIEW 2: REQUESTS PANEL FOR ADMIN & CENTER MANAGER (Task 6)
            ========================================================================== */}
            {mainView === 'requests' && (
                <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '1.5rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', color: '#133315', fontWeight: 800, margin: '0 0 0.2rem 0' }}>
                                قسم طلبت التسجيل والتعديل والحذف
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
                                استعراض طلبات المعلمين واتخاذ القرارات بالموافقة أو الرفض
                            </p>
                        </div>
                    </div>

                    {/* Bulk Approval Actions Bar (Phase 7) */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '1rem 1.25rem',
                        marginBottom: '1.25rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{
                                width: '38px', height: '38px', borderRadius: '10px',
                                background: '#f0fdf4', color: '#16a34a',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Checks size={22} weight="bold" />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#1e293b' }}>
                                    إجراءات الموافقة الجماعية (Bulk Approval)
                                </h4>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    اعتماد كافة الطلبات المعلقة لكل نوع دفعة واحدة مع تحديث السجلات آلياً وإشعار المعلمين
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setBulkConfirmModal({
                                    isOpen: true,
                                    type: 'CREATE',
                                    label: 'طلبات الإنشاء والتسجيل الجديد',
                                    count: pendingAddCount
                                })}
                                disabled={pendingAddCount === 0 || actionProcessing}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                                    padding: '0.55rem 1.15rem',
                                    borderRadius: '10px',
                                    border: '1px solid #bbf7d0',
                                    background: pendingAddCount > 0 ? '#15803d' : '#f1f5f9',
                                    color: pendingAddCount > 0 ? '#ffffff' : '#94a3b8',
                                    fontWeight: 700,
                                    fontSize: '0.84rem',
                                    cursor: pendingAddCount > 0 && !actionProcessing ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s ease',
                                    boxShadow: pendingAddCount > 0 ? '0 2px 6px rgba(21,128,61,0.2)' : 'none'
                                }}
                            >
                                <Check size={16} weight="bold" />
                                <span>الموافقة على جميع طلبات الإنشاء ({pendingAddCount})</span>
                            </button>

                            <button
                                onClick={() => setBulkConfirmModal({
                                    isOpen: true,
                                    type: 'UPDATE',
                                    label: 'طلبات تعديل البيانات',
                                    count: pendingUpdateCount
                                })}
                                disabled={pendingUpdateCount === 0 || actionProcessing}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                                    padding: '0.55rem 1.15rem',
                                    borderRadius: '10px',
                                    border: '1px solid #bfdbfe',
                                    background: pendingUpdateCount > 0 ? '#1d4ed8' : '#f1f5f9',
                                    color: pendingUpdateCount > 0 ? '#ffffff' : '#94a3b8',
                                    fontWeight: 700,
                                    fontSize: '0.84rem',
                                    cursor: pendingUpdateCount > 0 && !actionProcessing ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s ease',
                                    boxShadow: pendingUpdateCount > 0 ? '0 2px 6px rgba(29,78,216,0.2)' : 'none'
                                }}
                            >
                                <Check size={16} weight="bold" />
                                <span>الموافقة على جميع طلبات التعديل ({pendingUpdateCount})</span>
                            </button>

                            <button
                                onClick={() => setBulkConfirmModal({
                                    isOpen: true,
                                    type: 'DELETE',
                                    label: 'طلبات حذف الطلاب',
                                    count: pendingDeleteCount
                                })}
                                disabled={pendingDeleteCount === 0 || actionProcessing}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                                    padding: '0.55rem 1.15rem',
                                    borderRadius: '10px',
                                    border: '1px solid #fecaca',
                                    background: pendingDeleteCount > 0 ? '#b91c1c' : '#f1f5f9',
                                    color: pendingDeleteCount > 0 ? '#ffffff' : '#94a3b8',
                                    fontWeight: 700,
                                    fontSize: '0.84rem',
                                    cursor: pendingDeleteCount > 0 && !actionProcessing ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s ease',
                                    boxShadow: pendingDeleteCount > 0 ? '0 2px 6px rgba(185,28,28,0.2)' : 'none'
                                }}
                            >
                                <Check size={16} weight="bold" />
                                <span>الموافقة على جميع طلبات الحذف ({pendingDeleteCount})</span>
                            </button>
                        </div>
                    </div>

                    {/* Sub-tabs Row */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '0.75rem',
                        marginBottom: '1rem',
                        overflowX: 'auto'
                    }}>
                        <button
                            onClick={() => setRequestsTab('ADD')}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '10px',
                                border: 'none',
                                background: requestsTab === 'ADD' ? '#e6f4ea' : '#f8fafc',
                                color: requestsTab === 'ADD' ? '#1b382b' : '#64748b',
                                fontWeight: requestsTab === 'ADD' ? 800 : 600,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            <UserPlus size={18} color={requestsTab === 'ADD' ? '#2e7d32' : '#64748b'} />
                            <span>طلبات الإضافة ({addRequests.length})</span>
                        </button>

                        <button
                            onClick={() => setRequestsTab('UPDATE')}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '10px',
                                border: 'none',
                                background: requestsTab === 'UPDATE' ? '#e3f2fd' : '#f8fafc',
                                color: requestsTab === 'UPDATE' ? '#1565c0' : '#64748b',
                                fontWeight: requestsTab === 'UPDATE' ? 800 : 600,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            <UserSwitch size={18} color={requestsTab === 'UPDATE' ? '#1565c0' : '#64748b'} />
                            <span>طلبات التعديل ({updateRequests.length})</span>
                        </button>

                        <button
                            onClick={() => setRequestsTab('DELETE')}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '10px',
                                border: 'none',
                                background: requestsTab === 'DELETE' ? '#ffebee' : '#f8fafc',
                                color: requestsTab === 'DELETE' ? '#c62828' : '#64748b',
                                fontWeight: requestsTab === 'DELETE' ? 800 : 600,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            <Trash size={18} color={requestsTab === 'DELETE' ? '#c62828' : '#64748b'} />
                            <span>طلبات الحذف ({deleteRequests.length})</span>
                        </button>
                    </div>

                    {/* Request Filters Row */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                            <input
                                type="text"
                                placeholder="بحث باسم الطالب أو المعلم..."
                                value={requestSearchQuery}
                                onChange={(e) => setRequestSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.55rem 2.2rem 0.55rem 1rem',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.88rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <MagnifyingGlass size={16} color="#94a3b8" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)' }} />
                        </div>

                        <select
                            value={requestStatusFilter}
                            onChange={(e) => setRequestStatusFilter(e.target.value)}
                            style={{
                                padding: '0.55rem 1rem',
                                borderRadius: '10px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.88rem',
                                background: '#fff',
                                outline: 'none'
                            }}
                        >
                            <option value="ALL">جميع الحالات</option>
                            <option value="PENDING">قيد الانتظار</option>
                            <option value="APPROVED">مقبول</option>
                            <option value="REJECTED">مرفوض</option>
                            <option value="CANCELLED">ملغى بواسطة المعلم</option>
                        </select>
                    </div>

                    {/* Requests List Cards */}
                    {requestsLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#133315' }}>
                            <ArrowsClockwise size={32} className="spin-animation" style={{ marginBottom: '0.5rem' }} />
                            <div>جاري تحميل الطلبات...</div>
                        </div>
                    ) : currentRequestsList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
                            <ClockCounterClockwise size={48} color="#cbd5e1" style={{ marginBottom: '0.8rem' }} />
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>لا توجد طلبات مسجلة في هذا التبويب</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {currentRequestsList.map(req => {
                                const isPending = req.status === 'PENDING' || req.status === 'UNDER_REVIEW';
                                return (
                                    <div
                                        key={req.id}
                                        style={{
                                            background: '#f8fafc',
                                            borderRadius: '14px',
                                            border: '1px solid #e2e8f0',
                                            padding: '1.25rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                                    {req.full_name || req.student_name}
                                                </h3>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                    تاريخ الطلب: {formatDate(req.created_at)} • بواسطة المعلم: <strong style={{ color: '#133315' }}>{req.requested_by_name || 'غير معروف'}</strong>
                                                </span>
                                            </div>

                                            {/* Status Badge */}
                                            <div>
                                                {req.status === 'APPROVED' && <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.3rem 0.8rem', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700 }}>مقبول</span>}
                                                {req.status === 'REJECTED' && <span style={{ background: '#ffebee', color: '#c62828', padding: '0.3rem 0.8rem', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700 }}>مرفوض</span>}
                                                {(req.status === 'CANCELLED' || req.status === 'CANCELLED_BY_TEACHER') && <span style={{ background: '#f5f5f5', color: '#616161', padding: '0.3rem 0.8rem', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700 }}>ملغى بواسطة المعلم</span>}
                                                {isPending && <span style={{ background: '#fff8e1', color: '#f57f17', padding: '0.3rem 0.8rem', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 700 }}>قيد الانتظار</span>}
                                            </div>
                                        </div>

                                        {/* Details Details Grid */}
                                        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.85rem', fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
                                            {requestsTab === 'ADD' && (
                                                <>
                                                    {req.halaqa_name && <div><strong>الحلقة:</strong> {req.halaqa_name}</div>}
                                                    {req.project_title && <div><strong>المشروع:</strong> {req.project_title}</div>}
                                                    {req.stage_title && <div><strong>المرحلة والجزء:</strong> {req.stage_title} {req.part_title ? `• ${req.part_title}` : ''}</div>}
                                                    {req.parent_name && <div><strong>ولي الأمر:</strong> {req.parent_name} {req.parent_phone ? `(${req.parent_phone})` : ''}</div>}
                                                    {req.national_id && <div><strong>الهوية الوطنية:</strong> {req.national_id}</div>}
                                                    {req.general_notes && <div><strong>ملاحظات الطلب:</strong> {req.general_notes}</div>}
                                                </>
                                            )}
                                            {requestsTab === 'UPDATE' && (
                                                <>
                                                    <div><strong>نوع الطلب:</strong> تعديل بيانات طالب قائم</div>
                                                    {req.parent_name && <div><strong>اسم الأب:</strong> {req.parent_name}</div>}
                                                    {req.parent_phone && <div><strong>هاتف الأب:</strong> {req.parent_phone}</div>}
                                                    {req.general_notes && <div><strong>بيانات التعديل:</strong> {req.general_notes}</div>}
                                                </>
                                            )}
                                            {requestsTab === 'DELETE' && (
                                                <>
                                                    <div><strong>سبب طلب الحذف:</strong> {req.reason || 'لم يذكر المعلم سبباً'}</div>
                                                </>
                                            )}

                                            {req.reviewed_by_name && (
                                                <div style={{ marginTop: '0.4rem', color: '#475569', fontSize: '0.82rem' }}>
                                                    تمت المراجعة بواسطة: <strong>{req.reviewed_by_name}</strong>
                                                </div>
                                            )}
                                            {req.rejection_reason && (
                                                <div style={{ marginTop: '0.4rem', color: '#c62828', fontWeight: 700 }}>
                                                    سبب الرفض: {req.rejection_reason}
                                                </div>
                                            )}
                                        </div>

                                         {/* Action Buttons for Requests */}
                                         <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                             <button
                                                 type="button"
                                                 onClick={() => {
                                                     let matchedStudent = students.find(s => String(s.id) === String(req.student_id || req.student?.id));
                                                     if (!matchedStudent) {
                                                         matchedStudent = {
                                                             id: req.id,
                                                             full_name: req.full_name || req.student_name,
                                                             gender: req.gender || 'M',
                                                             birth_date: req.birth_date,
                                                             national_id: req.national_id,
                                                             registration_number: req.registration_number || 'معلق',
                                                             parent_name: req.parent_name,
                                                             parent_phone: req.parent_phone,
                                                             mother_name: req.mother_name,
                                                             mother_phone: req.mother_phone,
                                                             income_level: req.income_level,
                                                             is_orphan: req.is_orphan,
                                                             has_special_needs: req.has_special_needs,
                                                             special_needs_notes: req.special_needs_notes,
                                                             halaqa_name: req.halaqa_name,
                                                             center_name: req.center_name,
                                                             reached_page: req.reached_page || 1,
                                                             points: 0,
                                                             rating: '0.0',
                                                             enrollments: [
                                                                 {
                                                                     enrollment_id: req.id,
                                                                     halaqa_name: req.halaqa_name,
                                                                     project_title: req.project_title,
                                                                     stage_title: req.stage_title,
                                                                     part_title: req.part_title
                                                                 }
                                                             ]
                                                         };
                                                     }
                                                     setSelectedStudentDetails(matchedStudent);
                                                     setIsDetailsModalOpen(true);
                                                 }}
                                                 style={{
                                                     background: '#e8f5e9',
                                                     color: '#2e7d32',
                                                     border: '1px solid #a5d6a7',
                                                     borderRadius: '8px',
                                                     padding: '0.5rem 1rem',
                                                     fontWeight: 700,
                                                     fontSize: '0.85rem',
                                                     cursor: 'pointer',
                                                     display: 'flex',
                                                     alignItems: 'center',
                                                     gap: '0.4rem'
                                                 }}
                                             >
                                                 <Eye size={16} />
                                                 <span>عرض تفاصيل الطالب</span>
                                             </button>

                                             {isPending && (
                                                 <>
                                                     <button
                                                         onClick={() => handleOpenRejectModal(req, requestsTab === 'DELETE' ? 'DELETION' : 'REGISTRATION')}
                                                         disabled={actionProcessing}
                                                         style={{
                                                             background: '#ffebee',
                                                             color: '#c62828',
                                                             border: '1px solid #ffcdd2',
                                                             borderRadius: '8px',
                                                             padding: '0.5rem 1.25rem',
                                                             fontWeight: 700,
                                                             fontSize: '0.85rem',
                                                             cursor: actionProcessing ? 'not-allowed' : 'pointer',
                                                             display: 'flex',
                                                             alignItems: 'center',
                                                             gap: '0.4rem'
                                                         }}
                                                     >
                                                         <Prohibit size={16} />
                                                         <span>رفض الطلب</span>
                                                     </button>

                                                     <button
                                                         onClick={() => handleApproveRequest(req, requestsTab === 'DELETE' ? 'DELETION' : 'REGISTRATION')}
                                                         disabled={actionProcessing}
                                                         style={{
                                                             background: '#133315',
                                                             color: '#fff',
                                                             border: 'none',
                                                             borderRadius: '8px',
                                                             padding: '0.5rem 1.5rem',
                                                             fontWeight: 700,
                                                             fontSize: '0.85rem',
                                                             cursor: actionProcessing ? 'not-allowed' : 'pointer',
                                                             display: 'flex',
                                                             alignItems: 'center',
                                                             gap: '0.4rem',
                                                             boxShadow: '0 2px 6px rgba(19, 51, 21, 0.25)'
                                                         }}
                                                     >
                                                         <Check size={16} />
                                                         <span>موافقة واعتماد</span>
                                                     </button>
                                                 </>
                                             )}
                                         </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* =========================================================================
                ADD / EDIT STUDENT WIZARD MODAL (Tasks 3, 4, 5)
            ========================================================================== */}
            {isWizardOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, direction: 'rtl', padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '680px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        overflow: 'hidden',
                        maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#133315' }}>
                                    {studentToEdit ? `تعديل بيانات الطالب: ${studentToEdit.full_name}` : 'إضافة طالب جديد'}
                                </h3>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    الخطوة {wizardStep} من 3
                                </span>
                            </div>
                            <button
                                onClick={() => setIsWizardOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#718096', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Step Indicator */}
                        <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.75rem 1.75rem', gap: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ flex: 1, textAlign: 'center', padding: '0.4rem', borderRadius: '8px', background: wizardStep === 1 ? '#133315' : 'transparent', color: wizardStep === 1 ? '#fff' : '#64748b', fontWeight: 700, fontSize: '0.82rem' }}>1. البيانات الشخصية</div>
                            <div style={{ flex: 1, textAlign: 'center', padding: '0.4rem', borderRadius: '8px', background: wizardStep === 2 ? '#133315' : 'transparent', color: wizardStep === 2 ? '#fff' : '#64748b', fontWeight: 700, fontSize: '0.82rem' }}>2. البيانات العائلية</div>
                            <div style={{ flex: 1, textAlign: 'center', padding: '0.4rem', borderRadius: '8px', background: wizardStep === 3 ? '#133315' : 'transparent', color: wizardStep === 3 ? '#fff' : '#64748b', fontWeight: 700, fontSize: '0.82rem' }}>3. التسكين والمشروع</div>
                        </div>

                        {/* Form Content */}
                        <form onSubmit={handleWizardSubmit} style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
                            {modalError && (
                                <div style={{ padding: '0.75rem 1rem', background: '#ffebee', color: '#c62828', borderRadius: '10px', fontSize: '0.88rem', marginBottom: '1.25rem', border: '1px solid #ef9a9a' }}>
                                    {modalError}
                                </div>
                            )}

                            {/* STEP 1: Personal Info */}
                            {wizardStep === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>الاسم الكامل للطالب *</label>
                                        <input
                                            type="text"
                                            placeholder="الاسم الثلاثي أو الرباعي"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>الجنس</label>
                                            <select
                                                value={formData.gender}
                                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                            >
                                                <option value="M">ذكر</option>
                                                <option value="F">أنثى</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>تاريخ الميلاد</label>
                                            <input
                                                type="date"
                                                value={formData.birth_date}
                                                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>رقم الهوية الوطنية / السجل</label>
                                            <input
                                                type="text"
                                                placeholder="مثال: 1029384756"
                                                value={formData.national_id}
                                                onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>السكن الحالي</label>
                                            <input
                                                type="text"
                                                placeholder="الحي / المنطقة"
                                                value={formData.current_residence}
                                                onChange={(e) => setFormData({ ...formData, current_residence: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Social checkboxes */}
                                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', gap: '2rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.is_orphan}
                                                    onChange={(e) => setFormData({ ...formData, is_orphan: e.target.checked })}
                                                    style={{ width: '18px', height: '18px', accentColor: '#558b2f' }}
                                                />
                                                <span>هل الطالب يتيم؟</span>
                                            </label>

                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.has_special_needs}
                                                    onChange={(e) => setFormData({ ...formData, has_special_needs: e.target.checked })}
                                                    style={{ width: '18px', height: '18px', accentColor: '#558b2f' }}
                                                />
                                                <span>هل يعاني من احتياجات خاصة؟</span>
                                            </label>
                                        </div>

                                        {formData.has_special_needs && (
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>ملاحظات الحالة الصحية:</label>
                                                <input
                                                    type="text"
                                                    placeholder="تحديد نوع الاحتياج الخاص"
                                                    value={formData.special_needs_notes}
                                                    onChange={(e) => setFormData({ ...formData, special_needs_notes: e.target.value })}
                                                    style={{ width: '100%', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Parent Info */}
                            {wizardStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>اسم الأب / ولي الأمر</label>
                                            <input
                                                type="text"
                                                placeholder="اسم الأب الكامل"
                                                value={formData.parent_name}
                                                onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>رقم هاتف الأب</label>
                                            <input
                                                type="text"
                                                placeholder="0501234567"
                                                value={formData.parent_phone}
                                                onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', direction: 'ltr', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>اسم الأم والكنية</label>
                                            <input
                                                type="text"
                                                placeholder="اسم الأم الكامل"
                                                value={formData.mother_name}
                                                onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>رقم هاتف الأم</label>
                                            <input
                                                type="text"
                                                placeholder="0507654321"
                                                value={formData.mother_phone}
                                                onChange={(e) => setFormData({ ...formData, mother_phone: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', direction: 'ltr', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>المستوى المادي للأسرة</label>
                                        <select
                                            value={formData.income_level}
                                            onChange={(e) => setFormData({ ...formData, income_level: e.target.value })}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                        >
                                            <option value="">-- غير محدد --</option>
                                            <option value="محدود">محدود / بحاجة لدعم</option>
                                            <option value="متوسط">متوسط</option>
                                            <option value="جيد">جيد / ميسور</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>ملاحظات عامة</label>
                                        <textarea
                                            rows="3"
                                            placeholder="أي ملاحظات إضافية تهم الإدارة والمعلم"
                                            value={formData.general_notes}
                                            onChange={(e) => setFormData({ ...formData, general_notes: e.target.value })}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                        ></textarea>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Halaqa, Project, Stage, Part (Tasks 3, 4, 5) */}
                            {wizardStep === 3 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {/* Field 1: Halaqa */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                            الحلقة القرآنية المسند إليها
                                        </label>
                                        <select
                                            value={formData.halaqa_id}
                                            onChange={(e) => handleHalaqaChangeInWizard(e.target.value)}
                                            style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', background: '#fff' }}
                                        >
                                            <option value="">-- بدون حلقة حالياً (تسجيل حر) --</option>
                                            {halaqat.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name} {r.teacher_name ? `(معلم: ${r.teacher_name})` : ''} {r.project_title ? `• مشروع: ${r.project_title}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {formData.halaqa_id && (
                                            <span style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.25rem', display: 'block' }}>
                                                ✓ تم تحديث المشروع المرتبط بهذه الحلقة تلقائياً
                                            </span>
                                        )}
                                    </div>

                                    {/* Task 3: Dropdown Project */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                            المشروع المعتمد *
                                        </label>
                                        <select
                                            value={formData.project_id}
                                            onChange={(e) => handleProjectChangeInWizard(e.target.value)}
                                            disabled={Boolean(formData.halaqa_id)}
                                            style={{
                                                width: '100%',
                                                padding: '0.65rem 0.9rem',
                                                borderRadius: '10px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.92rem',
                                                outline: 'none',
                                                background: formData.halaqa_id ? '#f1f5f9' : '#fff',
                                                cursor: formData.halaqa_id ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            <option value="">-- اختر المشروع --</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.title} {p.project_type === 'QURAN' ? '(قرآني)' : '(منهجي)'}</option>
                                            ))}
                                        </select>
                                        {formData.halaqa_id && (
                                            <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                                                ملاحظة: لا يمكن تعديل المشروع يدويًا طالما تم تحديد حلقة. لتغيير المشروع، قم بتغيير الحلقة أو إلغاء تحديدها.
                                            </span>
                                        )}
                                    </div>

                                    {/* Task 3 & 5: Dropdown Stage */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                مرحلة المشروع
                                            </label>
                                            <select
                                                value={formData.stage_id}
                                                onChange={(e) => handleStageChangeInWizard(e.target.value)}
                                                disabled={!formData.project_id || loadingStages}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.65rem 0.9rem',
                                                    borderRadius: '10px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '0.92rem',
                                                    outline: 'none',
                                                    background: (!formData.project_id || loadingStages) ? '#f1f5f9' : '#fff'
                                                }}
                                            >
                                                <option value="">
                                                    {loadingStages ? 'جاري التحميل...' : (!formData.project_id ? '-- اختر المشروع أولاً --' : (projectStages.length === 0 ? '-- لا توجد مراحل مضافة لهذا المشروع --' : '-- اختر مرحلة المشروع --'))}
                                                </option>
                                                {projectStages.map(stg => (
                                                    <option key={stg.id} value={stg.id}>{stg.title}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Task 3 & 5: Dropdown Part */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                جزء المشروع
                                            </label>
                                            <select
                                                value={formData.part_id}
                                                onChange={(e) => setFormData({ ...formData, part_id: e.target.value })}
                                                disabled={!formData.stage_id}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.65rem 0.9rem',
                                                    borderRadius: '10px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '0.92rem',
                                                    outline: 'none',
                                                    background: !formData.stage_id ? '#f1f5f9' : '#fff'
                                                }}
                                            >
                                                <option value="">
                                                    {!formData.stage_id ? '-- اختر المرحلة أولاً --' : (stageParts.length === 0 ? '-- لا توجد أجزاء لهذه المرحلة --' : '-- اختر جزء المرحلة --')}
                                                </option>
                                                {stageParts.map(prt => (
                                                    <option key={prt.id} value={prt.id}>{prt.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Reached page and points */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                صفحة الوصول الحالية (1 - 604)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="604"
                                                value={formData.reached_page}
                                                onChange={(e) => setFormData({ ...formData, reached_page: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                                                رصيد النقاط الافتتاحي
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.points}
                                                onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Wizard Footer Controls */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: '1.25rem',
                                marginTop: '1.5rem'
                            }}>
                                <div>
                                    {wizardStep > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => setWizardStep(wizardStep - 1)}
                                            style={{
                                                background: '#f1f5f9',
                                                border: 'none',
                                                borderRadius: '10px',
                                                padding: '0.65rem 1.25rem',
                                                color: '#475569',
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                        >
                                            <CaretRight size={16} />
                                            <span>السابق</span>
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsWizardOpen(false)}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            padding: '0.65rem 1.25rem',
                                            color: '#64748b',
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        إلغاء
                                    </button>

                                    {wizardStep < 3 ? (
                                        <button
                                            type="button"
                                            onClick={() => setWizardStep(wizardStep + 1)}
                                            style={{
                                                background: '#558b2f',
                                                border: 'none',
                                                borderRadius: '10px',
                                                padding: '0.65rem 1.5rem',
                                                color: '#fff',
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}
                                        >
                                            <span>التالي</span>
                                            <CaretLeft size={16} />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            style={{
                                                background: '#133315',
                                                border: 'none',
                                                borderRadius: '10px',
                                                padding: '0.65rem 1.75rem',
                                                color: '#fff',
                                                fontWeight: 700,
                                                fontSize: '0.92rem',
                                                cursor: submitting ? 'not-allowed' : 'pointer',
                                                boxShadow: '0 2px 6px rgba(19, 51, 21, 0.3)'
                                            }}
                                        >
                                            {submitting ? 'جاري الحفظ...' : (studentToEdit ? 'حفظ التعديلات' : 'إنشاء ملف الطالب')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                STUDENT DETAILS MODAL
            ========================================================================== */}
            {isDetailsModalOpen && selectedStudentDetails && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, direction: 'rtl', padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '620px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                        overflow: 'hidden',
                        maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    background: '#e8f5e9',
                                    color: '#2e7d32',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: '1.1rem'
                                }}>
                                    {getInitials(selectedStudentDetails.full_name)}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#133315' }}>
                                        الملف الشامل: {selectedStudentDetails.full_name}
                                    </h3>
                                    <span style={{ fontSize: '0.85rem', color: '#718096' }}>
                                        {selectedStudentDetails.halaqa_name || 'بدون حلقة'} • {selectedStudentDetails.center_name || 'بدون مركز'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsDetailsModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#718096', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem',
                                background: '#f8fafc', padding: '1rem', borderRadius: '12px', textAlign: 'center'
                            }}>
                                <div>
                                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>صفحة الوصول</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#e65100' }}>{selectedStudentDetails.reached_page || 1}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>رصيد النقاط</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#558b2f' }}>{selectedStudentDetails.points || 0}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#718096', fontSize: '0.8rem', display: 'block' }}>التقييم العام</span>
                                    <strong style={{ fontSize: '1.2rem', color: '#f57c00' }}>{selectedStudentDetails.rating || '0.0'} / 5</strong>
                                </div>
                            </div>

                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#133315', fontWeight: 700 }}>
                                    التسكين والمراحل المسجلة
                                </h4>
                                {selectedStudentDetails.enrollments && selectedStudentDetails.enrollments.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {selectedStudentDetails.enrollments.map(en => (
                                            <div key={en.enrollment_id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.88rem' }}>
                                                <div style={{ fontWeight: 700, color: '#133315', marginBottom: '0.2rem' }}>{en.halaqa_name || 'حلقة غير مسماة'}</div>
                                                <div style={{ color: '#64748b', fontSize: '0.82rem' }}>
                                                    {en.project_title ? `المشروع: ${en.project_title} • ` : ''}
                                                    {en.stage_title ? `المرحلة: ${en.stage_title} • ` : ''}
                                                    {en.part_title ? `الجزء: ${en.part_title}` : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>لا توجد تفاصيل تسكين مسجلة</p>
                                )}
                            </div>

                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#133315', fontWeight: 700 }}>
                                    البيانات العائلية والاجتماعية
                                </h4>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
                                    background: '#f8fafc', padding: '1rem', borderRadius: '12px', fontSize: '0.88rem'
                                }}>
                                    <div><span style={{ color: '#718096' }}>الأب:</span> <strong>{selectedStudentDetails.parent_name || '—'}</strong></div>
                                    <div><span style={{ color: '#718096' }}>هاتف الأب:</span> <span style={{ direction: 'ltr' }}>{selectedStudentDetails.parent_phone || '—'}</span></div>
                                    <div><span style={{ color: '#718096' }}>الأم:</span> <strong>{selectedStudentDetails.mother_name || '—'}</strong></div>
                                    <div><span style={{ color: '#718096' }}>هاتف الأم:</span> <span style={{ direction: 'ltr' }}>{selectedStudentDetails.mother_phone || '—'}</span></div>
                                    <div><span style={{ color: '#718096' }}>الحالة:</span> <strong>{selectedStudentDetails.is_orphan ? 'يتيم' : 'طبيعي'}</strong></div>
                                    <div><span style={{ color: '#718096' }}>الدخل:</span> <strong>{selectedStudentDetails.income_level || '—'}</strong></div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
                            <button onClick={() => setIsDetailsModalOpen(false)} style={{ background: '#558b2f', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}>إغلاق</button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                DELETE CONFIRMATION DIALOG
            ========================================================================== */}
            {isDeleteModalOpen && studentToDelete && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, direction: 'rtl', padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '440px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', padding: '1.75rem', textAlign: 'center'
                    }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto'
                        }}>
                            <Trash size={28} weight="bold" />
                        </div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: 800 }}>
                            حذف ملف الطالب نهائياً؟
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
                            هل أنت متأكد من رغبتك في حذف ملف الطالب <strong>"{studentToDelete.full_name}"</strong>؟
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button onClick={() => setIsDeleteModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '0.65rem 1.4rem', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>تراجع</button>
                            <button onClick={handleConfirmDelete} disabled={submitting} style={{ background: '#dc2626', border: 'none', borderRadius: '10px', padding: '0.65rem 1.75rem', color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? 'جاري الحذف...' : 'نعم، احذف الطالب'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                REJECTION REASON MODAL (Task 6)
            ========================================================================== */}
            {isRejectModalOpen && requestToReject && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, direction: 'rtl', padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '460px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)', padding: '1.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Prohibit size={24} weight="bold" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#111827', fontWeight: 800 }}>
                                    تأكيد رفض الطلب
                                </h3>
                                <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                                    الطالب: {requestToReject.full_name || requestToReject.student_name}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>
                                سبب الرفض (سيتم إرساله كإشعار للمعلم):
                            </label>
                            <textarea
                                rows="3"
                                placeholder="اكتب سبب الرفض هنا..."
                                value={rejectionReasonInput}
                                onChange={(e) => setRejectionReasonInput(e.target.value)}
                                style={{ width: '100%', padding: '0.65rem 0.9rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                            ></textarea>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setIsRejectModalOpen(false); setRequestToReject(null); }}
                                disabled={actionProcessing}
                                style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '10px', padding: '0.6rem 1.2rem', color: '#374151', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleConfirmRejectRequest}
                                disabled={actionProcessing}
                                style={{ background: '#c62828', border: 'none', borderRadius: '10px', padding: '0.6rem 1.5rem', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: actionProcessing ? 'not-allowed' : 'pointer' }}
                            >
                                {actionProcessing ? 'جاري التنفيذ...' : 'تأكيد الرفض والإشعار'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                BULK APPROVAL CONFIRMATION MODAL (Phase 7)
            ========================================================================== */}
            {bulkConfirmModal.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, direction: 'rtl', padding: '1rem'
                }}>
                    <div style={{
                        background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '480px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)', padding: '1.85rem', textAlign: 'center'
                    }}>
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '50%',
                            background: bulkConfirmModal.type === 'DELETE' ? '#fee2e2' : '#f0fdf4',
                            color: bulkConfirmModal.type === 'DELETE' ? '#dc2626' : '#16a34a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto'
                        }}>
                            <Checks size={32} weight="bold" />
                        </div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: 800 }}>
                            تأكيد الموافقة الجماعية على {bulkConfirmModal.label}
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '0 0 1.5rem 0', lineHeight: '1.6' }}>
                            هل أنت متأكد من رغبتك في الموافقة الجماعية على جميع <strong>{bulkConfirmModal.label}</strong> المعلقة حالياً؟
                            <br />
                            سيتم اعتماد <strong style={{ color: '#15803d' }}>{bulkConfirmModal.count} طلب</strong> فورياً وتحديث سجلات الطلاب وإشعار المعلمين المعنيين.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => setBulkConfirmModal({ isOpen: false, type: '', label: '', count: 0 })}
                                disabled={actionProcessing}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '0.65rem 1.4rem', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleConfirmBulkApprove}
                                disabled={actionProcessing}
                                style={{
                                    background: bulkConfirmModal.type === 'DELETE' ? '#dc2626' : '#16a34a',
                                    border: 'none', borderRadius: '10px', padding: '0.65rem 1.75rem', color: '#fff',
                                    fontWeight: 700, cursor: actionProcessing ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                                }}
                            >
                                <Check size={18} weight="bold" />
                                <span>{actionProcessing ? 'جاري التنفيذ...' : 'نعم، موافقة جماعية'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentsManagement;
