import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CalendarBlank, Plus, X, FloppyDisk, PencilSimple, Trash, WarningCircle
} from '@phosphor-icons/react';
import {
    getCentersList, getProjects, getMosqueSchedules,
    createMosqueSchedule, updateMosqueSchedule, deleteMosqueSchedule, saveMosqueBulkSchedule
} from '../../../services/api/tenantService';

const DAYS_OF_WEEK = [
    { id: 0, name: 'الأحد' }, { id: 1, name: 'الإثنين' }, { id: 2, name: 'الثلاثاء' },
    { id: 3, name: 'الأربعاء' }, { id: 4, name: 'الخميس' }, { id: 5, name: 'الجمعة' }, { id: 6, name: 'السبت' },
];

const WEEKS_LIST = [
    { id: 1, name: 'الأول' }, { id: 2, name: 'الثاني' }, { id: 3, name: 'الثالث' }, { id: 4, name: 'الرابع' },
];

const MobileAdminSessions = () => {
    const navigate = useNavigate();

    const [centers, setCenters] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedCenter, setSelectedCenter] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    
    // Default month logic
    const d = new Date();
    const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        week_number: 1, day_of_week: 1, start_time: '09:00', end_time: '11:00', session_title: 'جلسة دوام قرآني', notes: ''
    });

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const [centersRes, projectsRes] = await Promise.all([getCentersList(), getProjects()]);
                if (centersRes?.data) setCenters(centersRes.data);
                if (projectsRes?.data) setProjects(projectsRes.data);
            } catch (err) { console.error(err); }
        };
        fetchInitial();
    }, []);

    useEffect(() => {
        fetchSchedulesData();
    }, [selectedCenter, selectedProject, selectedMonth]);

    const fetchSchedulesData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getMosqueSchedules(selectedCenter, selectedProject, selectedMonth);
            if (res?.status === 'success') {
                setSchedules(res.data || []);
            }
        } catch (err) {
            setError('فشل في جلب الجلسات');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        let hr = parseInt(h, 10);
        const ampm = hr >= 12 ? 'م' : 'ص';
        if (hr === 0) hr = 12;
        if (hr > 12) hr -= 12;
        return `${hr}:${m} ${ampm}`;
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setEditingItem(null);
        setFormData({ week_number: 1, day_of_week: 1, start_time: '09:00', end_time: '11:00', session_title: 'جلسة دوام قرآني', notes: '' });
        setIsAddEditModalOpen(true);
    };

    const handleOpenEditModal = (item) => {
        setModalMode('edit');
        setEditingItem(item);
        setFormData({
            week_number: item.week_number,
            day_of_week: item.day_of_week,
            start_time: item.start_time || '09:00',
            end_time: item.end_time || '11:00',
            session_title: item.session_title || 'جلسة دوام قرآني',
            notes: item.notes || ''
        });
        setIsAddEditModalOpen(true);
    };

    const handleSaveSession = async () => {
        try {
            if (modalMode === 'add') {
                const payload = {
                    center_id: selectedCenter || null, project_id: selectedProject || null, month: selectedMonth,
                    week_number: Number(formData.week_number), day_of_week: Number(formData.day_of_week),
                    start_time: formData.start_time, end_time: formData.end_time, session_title: formData.session_title, notes: formData.notes
                };
                await createMosqueSchedule(payload);
            } else {
                const payload = {
                    start_time: formData.start_time, end_time: formData.end_time, session_title: formData.session_title,
                    notes: formData.notes, week_number: Number(formData.week_number), day_of_week: Number(formData.day_of_week)
                };
                await updateMosqueSchedule(editingItem.id, payload);
            }
            setIsAddEditModalOpen(false);
            fetchSchedulesData();
        } catch (err) {
            console.error('Error saving session', err);
        }
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteMosqueSchedule(itemToDelete.id);
            setIsDeleteModalOpen(false);
            fetchSchedulesData();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', fontWeight: 'bold', margin: 0 }}>جدول الجلسات</h2>
                <button
                    onClick={handleOpenAddModal}
                    style={{ background: '#133315', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}
                >
                    <Plus size={16} weight="bold" /><span>إضافة</span>
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexDirection: 'column' }}>
                <input
                    type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none' }}
                />
                <select value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none', background: '#fff' }}>
                    <option value="">جميع المراكز</option>
                    {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}>جاري التحميل...</div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#c62828' }}>{error}</div>
            ) : schedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888', background: '#fff', borderRadius: '16px', border: '1px dashed #ccc' }}>لا يوجد جلسات في هذا الشهر</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {schedules.map(session => (
                        <div key={session.id} style={{ background: '#fff', borderRadius: '16px', padding: '1rem', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', background: '#558b2f' }}></div>
                            <div style={{ paddingRight: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#133315', fontWeight: 'bold' }}>{session.session_title}</h3>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '8px', background: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold' }}>
                                        الأسبوع {WEEKS_LIST.find(w => w.id === session.week_number)?.name}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.8rem' }}>
                                    <div>اليوم: <strong style={{ color: '#333' }}>{DAYS_OF_WEEK.find(d => d.id === session.day_of_week)?.name}</strong></div>
                                    <div>الوقت: <strong style={{ color: '#f57c00' }} dir="ltr">{formatTime(session.start_time)} - {formatTime(session.end_time)}</strong></div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleOpenEditModal(session)} style={{ flex: 1, padding: '0.5rem', background: '#f1f8e9', border: '1px solid #a5d6a7', borderRadius: '8px', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold' }}><PencilSimple size={16} /> تعديل</button>
                                    <button onClick={() => { setItemToDelete(session); setIsDeleteModalOpen(true); }} style={{ flex: 1, padding: '0.5rem', background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px', color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold' }}><Trash size={16} /> حذف</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isAddEditModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#133315' }}>{modalMode === 'add' ? 'إضافة جلسة' : 'تعديل جلسة'}</h3>
                            <button onClick={() => setIsAddEditModalOpen(false)} style={{ background: 'none', border: 'none' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>عنوان الجلسة</label>
                                <input type="text" value={formData.session_title} onChange={(e) => setFormData({ ...formData, session_title: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>الأسبوع</label>
                                    <select value={formData.week_number} onChange={(e) => setFormData({ ...formData, week_number: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                                        {WEEKS_LIST.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>اليوم</label>
                                    <select value={formData.day_of_week} onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                                        {DAYS_OF_WEEK.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>من</label>
                                    <input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>إلى</label>
                                    <input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                                </div>
                            </div>
                        </div>
                        <button onClick={handleSaveSession} style={{ width: '100%', padding: '1rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', marginTop: '1.5rem' }}>حفظ</button>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', width: '100%', borderRadius: '20px', padding: '1.5rem', textAlign: 'center' }}>
                        <WarningCircle size={48} color="#c62828" weight="fill" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ fontSize: '1.2rem', color: '#133315', margin: '0 0 0.5rem 0' }}>تأكيد الحذف</h3>
                        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>سيتم حذف هذه الجلسة نهائياً.</p>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button onClick={() => setIsDeleteModalOpen(false)} style={{ flex: 1, padding: '0.8rem', background: '#f5f5f5', color: '#333', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>إلغاء</button>
                            <button onClick={handleConfirmDelete} style={{ flex: 1, padding: '0.8rem', background: '#c62828', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>حذف</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileAdminSessions;
