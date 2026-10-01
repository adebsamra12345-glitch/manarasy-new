import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, CaretDown, MapPin, MagnifyingGlass, Clock,
    Plus, PencilSimple, Trash, Eye, X, FloppyDisk,
    CheckCircle, WarningCircle, FolderStar, CalendarBlank
} from '@phosphor-icons/react';
import {
    getCentersList,
    getProjects,
    getMosqueSchedules,
    createMosqueSchedule,
    updateMosqueSchedule,
    deleteMosqueSchedule,
    saveMosqueBulkSchedule
} from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';

const DAYS_OF_WEEK = [
    { id: 0, name: 'الأحد' },
    { id: 1, name: 'الإثنين' },
    { id: 2, name: 'الثلاثاء' },
    { id: 3, name: 'الأربعاء' },
    { id: 4, name: 'الخميس' },
    { id: 5, name: 'الجمعة' },
    { id: 6, name: 'السبت' },
];

const WEEKS_LIST = [
    { id: 1, name: 'الأول' },
    { id: 2, name: 'الثاني' },
    { id: 3, name: 'الثالث' },
    { id: 4, name: 'الرابع' },
];

const AdminSessions = () => {
    const navigate = useNavigate();
    const { user } = useAuthContext();

    // User display name & date header matching platform aesthetic
    const userStr = localStorage.getItem('user');
    let userObj = null;
    try { userObj = JSON.parse(userStr); } catch (e) { }
    const currentUserName = (userObj?.first_name || userObj?.last_name)
        ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim()
        : (user?.full_name || user?.username || localStorage.getItem('username') || 'محمد العمري');

    const todayDate = new Date();
    const hijriDate = new Intl.DateTimeFormat('ar-SA', {
        calendar: 'islamic', day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const gregorianDate = new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(todayDate);
    const dateHeaderStr = `${weekday}، ${hijriDate} | ${gregorianDate} م`;

    // Dropdown filters & data states
    const [centers, setCenters] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedCenter, setSelectedCenter] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('2026-02');

    // Schedules matrix state (stored items from DB)
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Modals state
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        week_number: 1,
        day_of_week: 1,
        start_time: '09:00',
        end_time: '11:00',
        session_title: 'جلسة دوام قرآني',
        notes: ''
    });

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedDetailItem, setSelectedDetailItem] = useState(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Initial load: centers & projects
    useEffect(() => {
        const fetchInitialMetadata = async () => {
            try {
                const [centersRes, projectsRes] = await Promise.all([
                    getCentersList(),
                    getProjects()
                ]);

                if (centersRes?.status === 'success' && Array.isArray(centersRes.data)) {
                    setCenters(centersRes.data);
                }

                if (projectsRes?.status === 'success' && Array.isArray(projectsRes.data)) {
                    setProjects(projectsRes.data);
                }
            } catch (err) {
                console.error('Error fetching centers or projects:', err);
            }
        };
        fetchInitialMetadata();
    }, []);

    // Fetch schedules whenever center, project, or month changes
    const fetchSchedulesData = async () => {
        setLoading(true);
        try {
            const res = await getMosqueSchedules(selectedCenter, selectedProject, selectedMonth);
            if (res?.status === 'success') {
                setSchedules(res.data || []);
            }
        } catch (err) {
            console.error('Error fetching schedules:', err);
            showToast('فشل في جلب جدول الجلسات من الخادم', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedulesData();
    }, [selectedCenter, selectedProject, selectedMonth]);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast({ show: false, message: '', type: 'success' });
        }, 4000);
    };

    // Helper: format 24h time into Arabic 12h representation e.g. "9:00 - 11:00 ص"
    const formatDisplayTimeRange = (startTimeStr, endTimeStr) => {
        const formatSingle = (timeStr) => {
            if (!timeStr) return '';
            const [hStr, mStr] = timeStr.split(':');
            let h = parseInt(hStr, 10);
            const m = mStr || '00';
            const suffix = h >= 12 ? 'م' : 'ص';
            if (h === 0) h = 12;
            else if (h > 12) h -= 12;
            return { timeText: m === '00' ? `${h}:00` : `${h}:${m}`, suffix };
        };

        const start = formatSingle(startTimeStr);
        const end = formatSingle(endTimeStr);

        if (!start.timeText) return '-';
        if (start.suffix === end.suffix) {
            return `${start.timeText} - ${end.timeText} ${end.suffix}`;
        }
        return `${start.timeText} ${start.suffix} - ${end.timeText} ${end.suffix}`;
    };

    // Matrix lookup mapping: key -> `${week_number}_${day_of_week}`
    const schedulesMap = useMemo(() => {
        const map = {};
        schedules.forEach(item => {
            const key = `${item.week_number}_${item.day_of_week}`;
            map[key] = item;
        });
        return map;
    }, [schedules]);

    // Handle Cell Click (Add or View/Edit)
    const handleCellClick = (weekNum, dayId) => {
        const key = `${weekNum}_${dayId}`;
        const existing = schedulesMap[key];
        if (existing) {
            setSelectedDetailItem(existing);
            setIsDetailModalOpen(true);
        } else {
            setModalMode('add');
            setEditingItem(null);
            setFormData({
                week_number: weekNum,
                day_of_week: dayId,
                start_time: '09:00',
                end_time: '11:00',
                session_title: 'جلسة دوام قرآني',
                notes: ''
            });
            setIsAddEditModalOpen(true);
        }
    };

    // Open Edit from Detail Modal
    const handleOpenEditFromDetail = () => {
        if (!selectedDetailItem) return;
        setIsDetailModalOpen(false);
        setModalMode('edit');
        setEditingItem(selectedDetailItem);
        setFormData({
            week_number: selectedDetailItem.week_number,
            day_of_week: selectedDetailItem.day_of_week,
            start_time: selectedDetailItem.start_time || '09:00',
            end_time: selectedDetailItem.end_time || '11:00',
            session_title: selectedDetailItem.session_title || 'جلسة دوام قرآني',
            notes: selectedDetailItem.notes || ''
        });
        setIsAddEditModalOpen(true);
    };

    // Save Individual Schedule Item (Add / Edit)
    const handleSaveAddEditModal = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'add') {
                const payload = {
                    center_id: selectedCenter || null,
                    project_id: selectedProject || null,
                    month: selectedMonth,
                    week_number: Number(formData.week_number),
                    day_of_week: Number(formData.day_of_week),
                    start_time: formData.start_time,
                    end_time: formData.end_time,
                    session_title: formData.session_title,
                    notes: formData.notes
                };
                const res = await createMosqueSchedule(payload);
                if (res?.status === 'success') {
                    showToast('تمت إضافة موعد الجلسة في الجدول بنجاح', 'success');
                    setIsAddEditModalOpen(false);
                    fetchSchedulesData();
                } else {
                    showToast(res?.message || 'فشل إضافة موعد الجلسة', 'error');
                }
            } else if (modalMode === 'edit' && editingItem) {
                const payload = {
                    start_time: formData.start_time,
                    end_time: formData.end_time,
                    session_title: formData.session_title,
                    notes: formData.notes,
                    week_number: Number(formData.week_number),
                    day_of_week: Number(formData.day_of_week)
                };
                const res = await updateMosqueSchedule(editingItem.id, payload);
                if (res?.status === 'success') {
                    showToast('تم تحديث موعد الجلسة بنجاح', 'success');
                    setIsAddEditModalOpen(false);
                    fetchSchedulesData();
                } else {
                    showToast(res?.message || 'فشل تحديث موعد الجلسة', 'error');
                }
            }
        } catch (err) {
            console.error('Error saving schedule slot:', err);
            showToast('حدث خطأ أثناء حفظ الجلسة', 'error');
        }
    };

    // Delete item handler
    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            const res = await deleteMosqueSchedule(itemToDelete.id);
            if (res?.status === 'success') {
                showToast('تم حذف الجلسة من الجدول بنجاح', 'success');
                setIsDeleteModalOpen(false);
                setIsDetailModalOpen(false);
                setItemToDelete(null);
                fetchSchedulesData();
            } else {
                showToast(res?.message || 'فشل حذف الجلسة', 'error');
            }
        } catch (err) {
            console.error('Error deleting schedule item:', err);
            showToast('حدث خطأ أثناء حذف الجلسة', 'error');
        }
    };

    // Save Whole Schedule Matrix (حفظ الجدول)
    const handleSaveEntireSchedule = async () => {
        setSaving(true);
        try {
            const payload = {
                center_id: selectedCenter || null,
                project_id: selectedProject || null,
                month: selectedMonth,
                schedules: schedules.map(s => ({
                    week_number: s.week_number,
                    day_of_week: s.day_of_week,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    session_title: s.session_title,
                    notes: s.notes
                }))
            };
            const res = await saveMosqueBulkSchedule(payload);
            if (res?.status === 'success') {
                showToast('تم حفظ كامل جدول الجلسات بنجاح في قاعدة البيانات', 'success');
                fetchSchedulesData();
            } else {
                showToast(res?.message || 'فشل في حفظ جدول الجلسات', 'error');
            }
        } catch (err) {
            console.error('Error saving bulk schedule:', err);
            showToast('حدث خطأ أثناء حفظ جدول الجلسات', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '1.5rem 2rem', backgroundColor: '#fcfdfc', minHeight: '100vh', direction: 'rtl', fontFamily: 'inherit' }}>
            
            {/* Toast Notification */}
            {toast.show && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    zIndex: 9999,
                    backgroundColor: toast.type === 'success' ? '#2e7d32' : '#c62828',
                    color: '#fff',
                    padding: '0.85rem 1.4rem',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontWeight: 'bold',
                    fontSize: '0.95rem'
                }}>
                    {toast.type === 'success' ? <CheckCircle size={22} weight="fill" /> : <WarningCircle size={22} weight="fill" />}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Top Bar: Greetings & Date on RIGHT; Selectors & Bell on LEFT */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                
                {/* Right: User Welcome & Date */}
                <div style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '1.75rem', color: '#133315', fontWeight: 'bold', margin: '0 0 0.25rem 0' }}>
                        السلام عليكم، أ. {currentUserName}
                    </h1>
                    <p style={{ color: '#757575', fontSize: '0.85rem', margin: 0 }}>
                        {dateHeaderStr}
                    </p>
                </div>

                {/* Left: Center Selector, Project Selector, Bell */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    
                    {/* Center / Mosque Selector */}
                    <div style={{ position: 'relative', minWidth: '170px' }}>
                        <select
                            value={selectedCenter}
                            onChange={(e) => setSelectedCenter(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 2.2rem 0.6rem 2rem',
                                borderRadius: '24px',
                                border: '1px solid #d4d4d4',
                                backgroundColor: '#ffffff',
                                color: '#2e3a2f',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                appearance: 'none',
                                cursor: 'pointer',
                                outline: 'none',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}
                        >
                            <option value="">جميع المراكز</option>
                            {centers.map(c => (
                                <option key={c.id} value={c.id}>{c.name || 'المركز الرئيسي'}</option>
                            ))}
                        </select>
                        <MapPin size={18} color="#558b2f" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <CaretDown size={14} color="#666" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* Project Selector */}
                    <div style={{ position: 'relative', minWidth: '190px' }}>
                        <select
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 2.2rem 0.6rem 2rem',
                                borderRadius: '24px',
                                border: '1px solid #d4d4d4',
                                backgroundColor: '#ffffff',
                                color: '#2e3a2f',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                appearance: 'none',
                                cursor: 'pointer',
                                outline: 'none',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                            }}
                        >
                            <option value="">جميع المشاريع</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.title || 'مشروع الضبط والإتقان'}</option>
                            ))}
                        </select>
                        <FolderStar size={18} color="#558b2f" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <CaretDown size={14} color="#666" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* Notification Bell */}
                    <button
                        type="button"
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '1px solid #e0e0e0',
                            backgroundColor: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            position: 'relative',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                        }}
                    >
                        <Bell size={20} color="#444" />
                        <span style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#e65100',
                            borderRadius: '50%'
                        }} />
                    </button>
                </div>
            </div>

            {/* Header Controls: Title on RIGHT, Month Input & Days Tag & Save Button on LEFT */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2rem 0 1rem 0', flexWrap: 'wrap', gap: '1rem' }}>
                
                {/* Right: Section Title */}
                <div>
                    <h2 style={{ fontSize: '2.4rem', color: '#133315', fontWeight: 'bold', margin: 0, letterSpacing: '-0.5px' }}>
                        جدول الجلسات
                    </h2>
                </div>

                {/* Left: Controls & Save Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    
                    {/* Month Picker / Search Input */}
                    <div style={{ position: 'relative', width: '220px' }}>
                        <input
                            type="text"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            placeholder="اختر الشهر ....."
                            style={{
                                width: '100%',
                                padding: '0.65rem 2.4rem 0.65rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid #d4d4d4',
                                backgroundColor: '#ffffff',
                                color: '#333',
                                fontSize: '0.95rem',
                                outline: 'none',
                                textAlign: 'right',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                        />
                        <MagnifyingGlass size={18} color="#777" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    {/* Days Tag / Selector */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1.25rem',
                        borderRadius: '8px',
                        border: '1px solid #d4d4d4',
                        backgroundColor: '#ffffff',
                        color: '#444',
                        fontSize: '0.95rem',
                        fontWeight: '500',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}>
                        <Clock size={18} color="#666" />
                        <span>أيام</span>
                    </div>

                    {/* "حفظ الجدول" Button */}
                    <button
                        onClick={handleSaveEntireSchedule}
                        disabled={saving}
                        style={{
                            backgroundColor: '#558b2f',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.75rem 2rem',
                            fontSize: '1.05rem',
                            fontWeight: 'bold',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            boxShadow: '0 2px 6px rgba(85, 139, 47, 0.28)',
                            transition: 'all 0.2s ease',
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        <FloppyDisk size={20} weight="bold" />
                        <span>{saving ? 'جاري الحفظ...' : 'حفظ الجدول'}</span>
                    </button>
                </div>
            </div>

            {/* Horizontal Line Divider */}
            <div style={{ height: '1px', backgroundColor: '#e2e8e2', margin: '1rem 0 2rem 0' }} />

            {/* Schedule Matrix Card Container */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #d5dbd5',
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
            }}>
                {loading ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#558b2f', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        جاري تحميل جدول الجلسات من قاعدة البيانات...
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', tableLayout: 'fixed', minWidth: '850px' }}>
                            <tbody>
                                {WEEKS_LIST.map((week) => (
                                    <React.Fragment key={week.id}>
                                        
                                        {/* Week Header Row */}
                                        <tr style={{ backgroundColor: '#dde2e5' }}>
                                            <th style={{
                                                padding: '0.9rem 0.5rem',
                                                border: '1px solid #cfd6dc',
                                                color: '#37474f',
                                                fontWeight: 'bold',
                                                fontSize: '0.95rem',
                                                width: '12.5%'
                                            }}>
                                                الأسبوع {week.name}
                                            </th>
                                            {DAYS_OF_WEEK.map((day) => (
                                                <th
                                                    key={day.id}
                                                    style={{
                                                        padding: '0.9rem 0.5rem',
                                                        border: '1px solid #cfd6dc',
                                                        color: '#37474f',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.95rem',
                                                        width: '12.5%'
                                                    }}
                                                >
                                                    {day.name}
                                                </th>
                                            ))}
                                        </tr>

                                        {/* Session Times Row */}
                                        <tr style={{ backgroundColor: '#ffffff' }}>
                                            <td style={{
                                                padding: '1.1rem 0.5rem',
                                                border: '1px solid #e0e6eb',
                                                color: '#455a64',
                                                fontWeight: 'bold',
                                                fontSize: '0.9rem',
                                                backgroundColor: '#f8fafc'
                                            }}>
                                                أوقات الجلسات
                                            </td>

                                            {DAYS_OF_WEEK.map((day) => {
                                                const key = `${week.id}_${day.id}`;
                                                const slot = schedulesMap[key];

                                                return (
                                                    <td
                                                        key={day.id}
                                                        onClick={() => handleCellClick(week.id, day.id)}
                                                        style={{
                                                            padding: '0.75rem 0.4rem',
                                                            border: '1px solid #e0e6eb',
                                                            cursor: 'pointer',
                                                            transition: 'background-color 0.15s ease',
                                                            verticalAlign: 'middle'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!slot) e.currentTarget.style.backgroundColor = '#f1f8e9';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!slot) e.currentTarget.style.backgroundColor = '#ffffff';
                                                        }}
                                                    >
                                                        {slot ? (
                                                            <div style={{
                                                                backgroundColor: '#a3c485',
                                                                color: '#133315',
                                                                borderRadius: '6px',
                                                                padding: '0.55rem 0.25rem',
                                                                fontWeight: 'bold',
                                                                fontSize: '0.88rem',
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '0.3rem'
                                                            }}>
                                                                <span>{formatDisplayTimeRange(slot.start_time, slot.end_time)}</span>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#888', fontSize: '1.2rem', fontWeight: 'bold' }}>-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* Modal: Add or Edit Session Slot                                           */}
            {/* ========================================================================= */}
            {isAddEditModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(3px)'
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '520px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        overflow: 'hidden',
                        direction: 'rtl'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.2rem 1.5rem',
                            backgroundColor: '#f4f7f4',
                            borderBottom: '1px solid #e0e0e0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{ margin: 0, color: '#133315', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                {modalMode === 'add' ? 'إضافة موعد جلسة جديد' : 'تعديل موعد الجلسة'}
                            </h3>
                            <button
                                onClick={() => setIsAddEditModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveAddEditModal} style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#444', marginBottom: '0.4rem' }}>
                                        الأسبوع
                                    </label>
                                    <select
                                        value={formData.week_number}
                                        onChange={(e) => setFormData({ ...formData, week_number: e.target.value })}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ccc' }}
                                    >
                                        {WEEKS_LIST.map(w => (
                                            <option key={w.id} value={w.id}>الأسبوع {w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#444', marginBottom: '0.4rem' }}>
                                        اليوم
                                    </label>
                                    <select
                                        value={formData.day_of_week}
                                        onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ccc' }}
                                    >
                                        {DAYS_OF_WEEK.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#444', marginBottom: '0.4rem' }}>
                                        وقت البدء
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ccc' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#444', marginBottom: '0.4rem' }}>
                                        وقت الانتهاء
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ccc' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#444', marginBottom: '0.4rem' }}>
                                    عنوان الجلسة / النشاط
                                </label>
                                <input
                                    type="text"
                                    value={formData.session_title}
                                    onChange={(e) => setFormData({ ...formData, session_title: e.target.value })}
                                    placeholder="مثال: حلقة تحفيظ قرآنية"
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ccc' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: '#444', marginBottom: '0.4rem' }}>
                                    ملاحظات إضافية
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                    placeholder="أي تفاصيل أو تعليمات خاصة بالجلسة..."
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ccc', resize: 'vertical' }}
                                />
                            </div>

                            {/* Modal Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsAddEditModalOpen(false)}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        borderRadius: '8px',
                                        border: '1px solid #ccc',
                                        backgroundColor: '#fff',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        color: '#555'
                                    }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '0.6rem 1.5rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#558b2f',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    <FloppyDisk size={18} />
                                    <span>حفظ الموعد</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* Modal: View Session Slot Detail                                           */}
            {/* ========================================================================= */}
            {isDetailModalOpen && selectedDetailItem && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(3px)'
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '480px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        overflow: 'hidden',
                        direction: 'rtl'
                    }}>
                        <div style={{
                            padding: '1.2rem 1.5rem',
                            backgroundColor: '#e8f5e9',
                            borderBottom: '1px solid #c8e6c9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{ margin: 0, color: '#1b5e20', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                تفاصيل موعد الجلسة
                            </h3>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ backgroundColor: '#f9f9f9', padding: '0.75rem', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>الأسبوع</span>
                                    <strong style={{ color: '#2e3a2f', fontSize: '1rem' }}>
                                        الأسبوع {WEEKS_LIST.find(w => w.id === selectedDetailItem.week_number)?.name || selectedDetailItem.week_number}
                                    </strong>
                                </div>
                                <div style={{ backgroundColor: '#f9f9f9', padding: '0.75rem', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>اليوم</span>
                                    <strong style={{ color: '#2e3a2f', fontSize: '1rem' }}>
                                        {selectedDetailItem.day_name || DAYS_OF_WEEK.find(d => d.id === selectedDetailItem.day_of_week)?.name}
                                    </strong>
                                </div>
                            </div>

                            <div style={{ backgroundColor: '#f9f9f9', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>الوقت</span>
                                <strong style={{ color: '#133315', fontSize: '1.1rem' }}>
                                    {formatDisplayTimeRange(selectedDetailItem.start_time, selectedDetailItem.end_time)}
                                </strong>
                            </div>

                            {selectedDetailItem.session_title && (
                                <div style={{ backgroundColor: '#f9f9f9', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>عنوان الجلسة</span>
                                    <span style={{ color: '#333' }}>{selectedDetailItem.session_title}</span>
                                </div>
                            )}

                            {selectedDetailItem.notes && (
                                <div style={{ backgroundColor: '#f9f9f9', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>ملاحظات</span>
                                    <span style={{ color: '#555' }}>{selectedDetailItem.notes}</span>
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                                <button
                                    onClick={() => {
                                        setItemToDelete(selectedDetailItem);
                                        setIsDeleteModalOpen(true);
                                    }}
                                    style={{
                                        padding: '0.55rem 1rem',
                                        borderRadius: '8px',
                                        border: '1px solid #ffcdd2',
                                        backgroundColor: '#ffebee',
                                        color: '#c62828',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    <Trash size={16} />
                                    <span>حذف</span>
                                </button>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={handleOpenEditFromDetail}
                                        style={{
                                            padding: '0.55rem 1.2rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: '#558b2f',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}
                                    >
                                        <PencilSimple size={16} />
                                        <span>تعديل</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* Modal: Confirm Delete                                                     */}
            {/* ========================================================================= */}
            {isDeleteModalOpen && itemToDelete && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1100,
                    backdropFilter: 'blur(3px)'
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '420px',
                        padding: '1.5rem',
                        textAlign: 'center',
                        direction: 'rtl'
                    }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            backgroundColor: '#ffebee',
                            color: '#c62828',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem auto'
                        }}>
                            <Trash size={28} />
                        </div>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#133315', fontSize: '1.2rem', fontWeight: 'bold' }}>
                            تأكيد حذف موعد الجلسة
                        </h3>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            هل أنت متأكد من رغبتك في حذف هذا الموعد من جدول الدوام الأسبوعي؟
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                style={{
                                    padding: '0.6rem 1.4rem',
                                    borderRadius: '8px',
                                    border: '1px solid #ccc',
                                    backgroundColor: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    color: '#555'
                                }}
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                style={{
                                    padding: '0.6rem 1.4rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: '#c62828',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                نعم، حذف
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AdminSessions;
