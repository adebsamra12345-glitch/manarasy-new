import React, { useState, useEffect } from 'react';
import { CaretDown, Users, Bell, MagnifyingGlass, Star, PhoneCall } from '@phosphor-icons/react';
import { getHalaqat, getStudentsByRing } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import AddStudentWizard from './AddStudentWizard';

const TeacherStudents = () => {
    const { user } = useAuthContext();
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [rings, setRings] = useState([]);
    const [selectedRingId, setSelectedRingId] = useState('all');
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState(null);

    useEffect(() => {
        const fetchRings = async () => {
            try {
                const response = await getHalaqat();
                if (response.status === 'success') {
                    setRings(response.data || []);
                    if (response.data?.length > 0) {
                        setSelectedRingId('all');
                    }
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchRings();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const response = await getStudentsByRing(selectedRingId);
            if (response.status === 'success') {
                setStudents(response.data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, [selectedRingId]);

    const filteredStudents = students.filter(st => 
        st.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (isoString) => {
        if (!isoString) return 'غير متوفر';
        const date = new Date(isoString);
        return `${date.getFullYear()} / ${date.getMonth() + 1} / ${date.getDate()}`;
    };

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', direction: 'rtl', minHeight: '100vh', background: '#fcfcfc' }}>
            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.5rem' }}>السلام عليكم، أ. {localStorage.getItem('username') || user?.username}</h1>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>{dateStr}</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="select-halaqa" style={{ position: 'relative' }}>
                        <select 
                            value={selectedRingId}
                            onChange={(e) => setSelectedRingId(e.target.value)}
                            style={{
                                appearance: 'none',
                                border: '1px solid #eee',
                                padding: '0.5rem 2.5rem 0.5rem 1rem',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#133315',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'inherit',
                                minWidth: '150px'
                            }}
                        >
                            <option value="all">كل الحلقات</option>
                            {rings.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                        <CaretDown size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <Users size={16} color="#888" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                    <div className="icon-btn" style={{ position: 'relative', background: '#fff', border: '1px solid #eee', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Title & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ fontSize: '2.5rem', color: '#1a3b1c', fontWeight: 'bold', margin: 0 }}>الطلاب</h2>
                    <span style={{ background: '#f4a261', color: '#fff', padding: '0.3rem 1rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {students.length} طالب
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '45%' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input 
                            type="text" 
                            placeholder="ابحث عن طالب ..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ 
                                padding: '0.7rem 2.5rem 0.7rem 1rem', 
                                border: '1px solid #e0e0e0', 
                                borderRadius: '8px',
                                width: '100%',
                                outline: 'none',
                                fontFamily: 'inherit',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                            }} 
                        />
                        <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                    </div>
                    <button 
                        onClick={() => {
                            setStudentToEdit(null);
                            setIsWizardOpen(true);
                        }}
                        style={{ 
                            backgroundColor: '#558b2f', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '0.7rem 1.5rem', 
                            borderRadius: '8px', 
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                        }}
                    >
                        طلب تسجيل طالب
                    </button>
                </div>
            </div>

            <AddStudentWizard 
                isOpen={isWizardOpen} 
                onClose={() => setIsWizardOpen(false)} 
                onComplete={() => fetchStudents()} 
                studentToEdit={studentToEdit}
            />

            {/* Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', color: '#558b2f', padding: '2rem' }}>جاري تحميل الطلاب...</div>
            ) : (
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
                    gap: '2.5rem',
                    paddingTop: '2rem'
                }}>
                    {filteredStudents.map(student => (
                        <div key={student.id} style={{ 
                            background: '#fff', 
                            borderRadius: '16px', 
                            padding: '1.5rem', 
                            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                            border: '1px solid #f0f0f0',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Top row: Gender badge and Points */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ background: '#aed1f5', color: '#333', padding: '0.3rem 1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    {student.gender === 'F' ? 'أنثى' : 'ذكر'}
                                </span>
                                {/* Hidden rating/points for now as requested, though I'll keep the DOM structure hidden or mocked so it matches the image visually without real logic yet */}
                                {/* In mockup points and stars are visible. I will show static/hidden as requested. The user said: "لنترك مقاط التقييم الان... برمجه وابقه مخفيا" -> So we hide it. */}
                                <div style={{ display: 'none', alignItems: 'center', gap: '0.3rem', color: '#666', fontSize: '0.85rem' }}>
                                    <span>{student.points || 0} نقطة</span>
                                    <Star size={16} color="#f57c00" weight="regular" />
                                </div>
                            </div>

                            {/* Avatar (overlapping top border) */}
                            <div style={{ 
                                width: '80px', 
                                height: '80px', 
                                borderRadius: '50%', 
                                border: '3px solid #eee', 
                                background: '#fafafa',
                                margin: '-4.5rem auto 1rem auto',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: '#ccc'
                            }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </div>

                            {/* Center info */}
                            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                {/* Rating hidden as requested */}
                                <div style={{ display: 'none', background: '#dcedc8', color: '#33691e', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginBottom: '0.5rem' }}>
                                    {student.rating || '0.0'} / 5
                                </div>
                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', color: '#111' }}>{student.full_name}</h3>
                                <p style={{ color: '#e65100', margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>رقم صفحة الوصول : {student.reached_page}</p>
                            </div>

                            {/* Details List */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', color: '#444', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>اسم الأب :</span> <span>{student.parent_name || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>اسم الأم والكنية :</span> <span>{student.mother_name || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>تاريخ الميلاد :</span> <span>{formatDate(student.birth_date)}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رقم هاتف الأب :</span> <span>{student.parent_phone || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رقم هاتف الأم :</span> <span>{student.mother_phone || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رقم الوثيقة :</span> <span>{student.national_id || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>رقم القيد :</span> <span>{student.registration_number || 'غير متوفر'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>السكن الحالي :</span> <span>{student.current_residence || 'غير متوفر'}</span></div>
                            </div>

                            {/* Actions Footer */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#81b255', padding: 0 }}>
                                    <PhoneCall size={24} weight="regular" />
                                </button>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button 
                                        onClick={() => {
                                            setStudentToEdit(student);
                                            setIsWizardOpen(true);
                                        }}
                                        style={{ 
                                        backgroundColor: '#558b2f', 
                                        color: '#fff', 
                                        border: 'none', 
                                        padding: '0.4rem 1.2rem', 
                                        borderRadius: '20px', 
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer' 
                                    }}>تعديل</button>
                                    <button style={{ 
                                        backgroundColor: '#e65100', 
                                        color: '#fff', 
                                        border: 'none', 
                                        padding: '0.4rem 1.2rem', 
                                        borderRadius: '20px', 
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer' 
                                    }}>نشاط الطالب</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TeacherStudents;
