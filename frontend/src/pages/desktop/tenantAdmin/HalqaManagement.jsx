import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Bell, Books, MagnifyingGlass, CalendarBlank, Users, 
    ChalkboardTeacher, ArrowLeft, Plus
} from '@phosphor-icons/react';
import { getHalaqat } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';

/**
 * HalqaManagement (إدارة الحلقات القرآنية - الأدمن)
 * ─────────────────────────────────────────────────────────────
 * واجهة عرض الحلقات للأدمن، مهيكلة لتتطابق برمجياً ووظيفياً
 * مع جودة واستقرار واجهة الحلقات في لوحة المعلم، مع منح الأدمن
 * إمكانية البحث والفلترة والانتقال السلس لجلسات الحلقة أو جدول الجلسات.
 */
const HalqaManagement = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';
    const { user } = useAuthContext();
    const [rings, setRings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    useEffect(() => {
        fetchRings();
    }, []);

    const fetchRings = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getHalaqat();
            if (data.status === 'success') {
                const fetchedRings = (data.data || []).map(r => ({
                    ...r,
                    studentsCount: r.students_count || r.current_students_count || 0
                }));
                setRings(fetchedRings);
            } else {
                setError('فشل في جلب قائمة الحلقات من الخادم');
            }
        } catch (err) {
            setError('حدث خطأ أثناء تحميل الحلقات القرآنية');
            console.error('Error fetching halaqat:', err);
        } finally {
            setLoading(false);
        }
    };

    // فلترة الحلقات بالاسم أو المعلم أو المشروع
    const filteredRings = rings.filter(r => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const nameMatch = r.name?.toLowerCase().includes(query);
        const teacherMatch = r.teacher_name?.toLowerCase().includes(query);
        const projectMatch = (r.project_title || r.center_name || '').toLowerCase().includes(query);
        return nameMatch || teacherMatch || projectMatch;
    });

    const totalStudents = rings.reduce((acc, r) => acc + (r.studentsCount || 0), 0);

    return (
        <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1050px', margin: '0 auto', direction: 'rtl', fontFamily: 'inherit' }}>
            
            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div className="greeting" style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#133315', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                        السلام عليكم، أ. {user?.username || localStorage.getItem('username') || 'مدير النظام'}
                    </h1>
                    <p style={{ color: '#777', fontSize: '0.9rem', margin: 0 }}>{dateStr}</p>
                </div>

                <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* زر سريع لجدول الجلسات */}
                    <button
                        onClick={() => navigate(`${basePath}/sessions`)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#fff',
                            color: '#133315',
                            border: '1.5px solid #133315',
                            padding: '0.55rem 1.2rem',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        title="الانتقال إلى جدول الجلسات التقويمي"
                    >
                        <CalendarBlank size={18} />
                        <span>جدول الجلسات</span>
                    </button>

                    <div className="icon-btn" style={{ position: 'relative', background: '#fff', border: '1px solid #ddd', padding: '0.55rem', borderRadius: '50%', cursor: 'pointer' }}>
                        <Bell size={20} color="#133315" />
                        <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* عنوان الصفحة وشريط البحث */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '2.4rem', color: '#1a3b1c', fontWeight: 'bold', margin: '0 0 0.3rem 0' }}>
                        الحلقات القرآنية
                    </h2>
                    <div style={{ display: 'flex', gap: '1rem', color: '#666', fontSize: '0.9rem' }}>
                        <span>إجمالي الحلقات: <strong style={{ color: '#133315' }}>{rings.length}</strong></span>
                        <span>•</span>
                        <span>إجمالي الطلاب: <strong style={{ color: '#558b2f' }}>{totalStudents}</strong></span>
                    </div>
                </div>

                {/* شريط البحث */}
                <div style={{ position: 'relative', width: '280px' }}>
                    <input
                        type="text"
                        placeholder="ابحث باسم الحلقة أو المعلم..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '0.6rem 2.4rem 0.6rem 1rem',
                            border: '1px solid #ccc',
                            borderRadius: '10px',
                            width: '100%',
                            textAlign: 'right',
                            outline: 'none',
                            fontFamily: 'inherit',
                            fontSize: '0.9rem'
                        }}
                    />
                    <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.75rem', transform: 'translateY(-50%)' }} />
                </div>
            </div>

            {/* فاصل أفقي */}
            <div style={{ height: '1px', backgroundColor: '#e0e0e0', marginBottom: '2rem' }}></div>

            {/* رسائل الأخطاء */}
            {error && (
                <div style={{ padding: '1rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #ef9a9a' }}>
                    {error}
                </div>
            )}

            {/* قائمة الحلقات */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#558b2f', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    جاري تحميل الحلقات...
                </div>
            ) : filteredRings.length === 0 ? (
                <div style={{
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    backgroundColor: '#fff',
                    borderRadius: '16px',
                    border: '1px dashed #ccc'
                }}>
                    <Books size={54} color="#9e9e9e" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1.3rem', color: '#333', marginBottom: '0.5rem' }}>
                        {searchQuery ? 'لم يتم العثور على حلقات تطابق بحثك' : 'لا توجد حلقات قرآنية مسجلة حالياً'}
                    </h3>
                    <p style={{ color: '#777', fontSize: '0.95rem' }}>
                        {searchQuery ? 'جرب البحث بكلمات أخرى' : 'يمكنك إدارة الحلقات وإسناد المعلمين من لوحة التحكم'}
                    </p>
                </div>
            ) : (
                <div className="rings-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem' }}>
                    {filteredRings.map(ring => (
                        <div
                            key={ring.id}
                            onClick={() => navigate(`${basePath}/rings/${ring.id}/sessions`)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1.5rem 2rem',
                                border: '1px solid #ddd',
                                borderRadius: '16px',
                                background: '#fff',
                                position: 'relative',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#81c784';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.02)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#ddd';
                            }}
                        >
                            {/* الشريط البرتقالي التمييزي على يمين البطاقة */}
                            <div style={{
                                position: 'absolute',
                                right: '12px',
                                top: '15%',
                                bottom: '15%',
                                width: '6px',
                                borderRadius: '10px',
                                backgroundColor: '#f57c00'
                            }}></div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', paddingRight: '20px' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.3rem' }}>
                                        <h3 style={{ fontSize: '1.6rem', color: '#133315', margin: 0, fontWeight: 'bold' }}>
                                            {ring.name}
                                        </h3>
                                        <span style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: ring.is_active !== false ? '#81b255' : '#ccc',
                                            display: 'inline-block'
                                        }} title={ring.is_active !== false ? 'حلقة نشطة' : 'حلقة متوقفة'}></span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', color: '#777', fontSize: '0.9rem' }}>
                                        <span>{ring.project_title || ring.center_name || 'بدون مشروع'}</span>
                                        {ring.teacher_name && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#555' }}>
                                                <ChalkboardTeacher size={16} />
                                                <span>المعلم: {ring.teacher_name}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{ fontSize: '1.15rem', color: '#133315', fontWeight: 'bold' }}>
                                        {ring.studentsCount} طالب
                                    </span>
                                    {ring.max_students && (
                                        <div style={{ fontSize: '0.8rem', color: '#999' }}>
                                            السعة: {ring.max_students}
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    color: '#558b2f',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem'
                                }}>
                                    <span>عرض الجلسات</span>
                                    <ArrowLeft size={18} />
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HalqaManagement;
