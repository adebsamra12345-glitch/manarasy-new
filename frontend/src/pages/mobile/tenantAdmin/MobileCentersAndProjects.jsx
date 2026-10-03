import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, MagnifyingGlass, CaretDown, MapPin, Check, WarningCircle } from '@phosphor-icons/react';
import { getProjects, getCentersList } from '../../../services/api/tenantService';

const MobileCentersAndProjects = () => {
    const [projects, setProjects] = useState([]);
    const [centersList, setCentersList] = useState([{ id: 'all', name: 'المركز الرئيسي' }]);
    const [selectedCenterId, setSelectedCenterId] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [projRes, centersRes] = await Promise.all([
                    getProjects().catch(() => ({ data: [] })),
                    getCentersList().catch(() => ({ data: [] }))
                ]);
                if (projRes?.data) setProjects(projRes.data);
                if (centersRes?.data?.length > 0) {
                    setCentersList([{ id: 'all', name: 'المركز الرئيسي' }, ...centersRes.data]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const filteredProjects = projects.filter(p => {
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery = query === '' || (p.title && p.title.toLowerCase().includes(query));
        const matchesCenter = selectedCenterId === 'all' || p.is_global || (p.centers && p.centers.some(c => String(c.id) === String(selectedCenterId)));
        return matchesQuery && matchesCenter;
    });

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={24} color="#558b2f" /> المشاريع
                </h2>
                <button style={{ background: '#133315', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    <Plus size={16} weight="bold" /><span>مشروع جديد</span>
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexDirection: 'column' }}>
                <select value={selectedCenterId} onChange={(e) => setSelectedCenterId(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none', background: '#fff' }}>
                    {centersList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ position: 'relative' }}>
                    <input type="text" placeholder="بحث عن مشروع..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '12px', border: '1px solid #eee', fontSize: '0.9rem', outline: 'none' }} />
                    <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}>جاري التحميل...</div>
            ) : filteredProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#888', background: '#fff', borderRadius: '16px', border: '1px dashed #ccc' }}>لا توجد مشاريع مضافة حالياً</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredProjects.map(project => (
                        <div key={project.id} style={{ background: '#fff', borderRadius: '16px', padding: '1rem', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', background: '#558b2f' }}></div>
                            <div style={{ paddingRight: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#133315', fontWeight: 'bold' }}>{project.title}</h3>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '8px', background: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold' }}>
                                        {project.is_global ? 'عام' : 'مخصص'}
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.8rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {project.description || 'لا يوجد وصف للمشروع'}
                                </p>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#888' }}>
                                    <span>المراحل: {project.stages?.length || 0}</span>
                                    <span>نوع المشروع: {project.project_type === 'QURAN' ? 'قرآن كريم' : project.project_type}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MobileCentersAndProjects;
