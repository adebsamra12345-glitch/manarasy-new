import React, { useState, useEffect } from 'react';
import { Buildings, MagnifyingGlass, Plus, Pencil, Trash, CaretDown, Check, X, MapPin, Hash, ShieldCheck, User, Users, Books, UserCheck } from '@phosphor-icons/react';
import { getCentersList, createCenter, updateCenter, deleteCenter, getCenterById } from '../../../services/api/tenantService';

const MobileCentersManagement = () => {
    const [centers, setCenters] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCenter, setEditingCenter] = useState(null);
    const [formData, setFormData] = useState({ name: '', address: '', code: '', is_active: true });
    
    // Details Modal
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedCenterForDetails, setSelectedCenterForDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [activeDetailTab, setActiveDetailTab] = useState('overview');

    useEffect(() => {
        fetchCenters();
    }, []);

    const fetchCenters = async () => {
        setLoading(true);
        try {
            const res = await getCentersList();
            if (res?.data) setCenters(res.data);
        } catch (err) {} finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingCenter) {
                await updateCenter(editingCenter.id, formData);
            } else {
                await createCenter(formData);
            }
            setIsModalOpen(false);
            fetchCenters();
        } catch (err) {
            alert('فشلت العملية');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('هل أنت متأكد من الحذف؟')) {
            try {
                await deleteCenter(id);
                fetchCenters();
                setIsDetailsOpen(false);
            } catch (err) {
                alert('فشل الحذف');
            }
        }
    };

    const handleOpenDetails = async (center) => {
        setIsDetailsOpen(true);
        setActiveDetailTab('overview');
        setSelectedCenterForDetails(center);
        setDetailsLoading(true);
        try {
            const res = await getCenterById(center.id);
            if (res?.data) setSelectedCenterForDetails(res.data);
        } catch (err) {} finally {
            setDetailsLoading(false);
        }
    };

    const filteredCenters = centers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const totalCenters = centers.length;
    const totalStudents = centers.reduce((acc, c) => acc + (c.students_count || 0), 0);
    const totalTeachers = centers.reduce((acc, c) => acc + (c.teachers_count || 0), 0);
    const totalHalaqat = centers.reduce((acc, c) => acc + (c.halaqat_count || 0), 0);

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Buildings size={24} color="#558b2f" /> المراكز
                </h2>
                <button onClick={() => { setEditingCenter(null); setFormData({ name: '', address: '', code: '', is_active: true }); setIsModalOpen(true); }} style={{ background: '#133315', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}>
                    <Plus size={16} /> إضافة
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ background: '#eef6ec', padding: '0.5rem', borderRadius: '8px' }}><Buildings size={20} color="#558b2f" /></div>
                    <div><div style={{ fontSize: '0.75rem', color: '#666' }}>المراكز</div><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#133315' }}>{totalCenters}</div></div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ background: '#ebf8ff', padding: '0.5rem', borderRadius: '8px' }}><Users size={20} color="#3182ce" /></div>
                    <div><div style={{ fontSize: '0.75rem', color: '#666' }}>الطلاب</div><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2b6cb0' }}>{totalStudents}</div></div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ background: '#faf5ff', padding: '0.5rem', borderRadius: '8px' }}><UserCheck size={20} color="#805ad5" /></div>
                    <div><div style={{ fontSize: '0.75rem', color: '#666' }}>المعلمين</div><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#6b46c1' }}>{totalTeachers}</div></div>
                </div>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ background: '#fffaf0', padding: '0.5rem', borderRadius: '8px' }}><Books size={20} color="#dd6b20" /></div>
                    <div><div style={{ fontSize: '0.75rem', color: '#666' }}>الحلقات</div><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#c05621' }}>{totalHalaqat}</div></div>
                </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <input type="text" placeholder="بحث عن مركز..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none' }} />
                <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}>جاري التحميل...</div>
            ) : filteredCenters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888', background: '#fff', borderRadius: '16px', border: '1px dashed #ccc' }}>لا توجد مراكز</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {filteredCenters.map(center => (
                        <div key={center.id} onClick={() => handleOpenDetails(center)} style={{ background: '#fff', borderRadius: '16px', padding: '1rem', border: '1px solid #eee', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem', color: '#133315', fontWeight: 'bold' }}>{center.name}</h3>
                                <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <MapPin size={14} /> {center.address || 'لا يوجد عنوان'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {center.is_active ? <Check color="#558b2f" weight="bold" /> : <X color="#d32f2f" weight="bold" />}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: '#133315' }}>{editingCenter ? 'تعديل المركز' : 'إضافة مركز جديد'}</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none' }}><X size={24} color="#666" /></button>
                        </div>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontSize: '0.9rem' }}>اسم المركز</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontSize: '0.9rem' }}>العنوان</label>
                                <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontSize: '0.9rem' }}>كود المركز (اختياري)</label>
                                <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #ddd' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} id="is_active_chk" />
                                <label htmlFor="is_active_chk" style={{ color: '#333' }}>المركز مفعل</label>
                            </div>
                            <button type="submit" style={{ background: '#558b2f', color: '#fff', padding: '1rem', borderRadius: '10px', border: 'none', fontWeight: 'bold', marginTop: '1rem' }}>
                                حفظ المركز
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isDetailsOpen && selectedCenterForDetails && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: '#133315' }}>تفاصيل المركز</h3>
                            <button onClick={() => setIsDetailsOpen(false)} style={{ background: 'none', border: 'none' }}><X size={24} color="#666" /></button>
                        </div>
                        {detailsLoading ? <div style={{ textAlign: 'center', padding: '2rem' }}>جاري التحميل...</div> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '16px' }}>
                                    <Buildings size={48} color="#558b2f" style={{ marginBottom: '0.5rem' }} />
                                    <h2 style={{ margin: 0, color: '#133315' }}>{selectedCenterForDetails.name}</h2>
                                    <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}><MapPin size={14} /> {selectedCenterForDetails.address}</div>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                                    <button onClick={() => setActiveDetailTab('overview')} style={{ padding: '0.6rem 1rem', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: 'bold', border: 'none', background: activeDetailTab === 'overview' ? '#133315' : '#eee', color: activeDetailTab === 'overview' ? '#fff' : '#666' }}>نظرة عامة</button>
                                    <button onClick={() => setActiveDetailTab('managers')} style={{ padding: '0.6rem 1rem', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: 'bold', border: 'none', background: activeDetailTab === 'managers' ? '#133315' : '#eee', color: activeDetailTab === 'managers' ? '#fff' : '#666' }}>المدراء ({selectedCenterForDetails.managers?.length || 0})</button>
                                    <button onClick={() => setActiveDetailTab('halaqat')} style={{ padding: '0.6rem 1rem', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: 'bold', border: 'none', background: activeDetailTab === 'halaqat' ? '#133315' : '#eee', color: activeDetailTab === 'halaqat' ? '#fff' : '#666' }}>الحلقات ({selectedCenterForDetails.halaqat?.length || 0})</button>
                                </div>

                                {activeDetailTab === 'overview' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                        <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <Users size={24} color="#558b2f" />
                                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#133315' }}>{selectedCenterForDetails.students_count || 0}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>الطلاب</div>
                                        </div>
                                        <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <UserCheck size={24} color="#558b2f" />
                                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#133315' }}>{selectedCenterForDetails.teachers_count || 0}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>المعلمين</div>
                                        </div>
                                        <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <Books size={24} color="#558b2f" />
                                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#133315' }}>{selectedCenterForDetails.halaqat_count || 0}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>الحلقات</div>
                                        </div>
                                        <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <ShieldCheck size={24} color="#558b2f" />
                                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#133315' }}>{selectedCenterForDetails.is_active ? 'نشط' : 'غير نشط'}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>الحالة</div>
                                        </div>
                                    </div>
                                )}

                                {activeDetailTab === 'managers' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        {selectedCenterForDetails.managers?.length > 0 ? selectedCenterForDetails.managers.map(m => (
                                            <div key={m.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #eee' }}>
                                                <div style={{ fontWeight: 'bold', color: '#133315', marginBottom: '0.3rem' }}>{m.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#666' }}>{m.email}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#666' }}>{m.phone}</div>
                                            </div>
                                        )) : <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>لا يوجد مدراء</div>}
                                    </div>
                                )}

                                {activeDetailTab === 'halaqat' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        {selectedCenterForDetails.halaqat?.length > 0 ? selectedCenterForDetails.halaqat.map(h => (
                                            <div key={h.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #eee' }}>
                                                <div style={{ fontWeight: 'bold', color: '#133315', marginBottom: '0.3rem' }}>{h.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#666' }}>المعلم: {h.teacher_name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#666' }}>السعة: {h.max_students} طالب</div>
                                            </div>
                                        )) : <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>لا توجد حلقات مسجلة</div>}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                    <button onClick={() => { setIsDetailsOpen(false); setEditingCenter(selectedCenterForDetails); setFormData({ name: selectedCenterForDetails.name, address: selectedCenterForDetails.address || '', code: selectedCenterForDetails.code || '', is_active: selectedCenterForDetails.is_active }); setIsModalOpen(true); }} style={{ flex: 1, padding: '0.8rem', background: '#133315', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                                        <Pencil size={18} /> تعديل
                                    </button>
                                    <button onClick={() => handleDelete(selectedCenterForDetails.id)} style={{ flex: 1, padding: '0.8rem', background: '#ffebee', color: '#d32f2f', border: 'none', borderRadius: '10px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                                        <Trash size={18} /> حذف
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileCentersManagement;
