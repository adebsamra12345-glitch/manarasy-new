import React, { useState, useEffect } from 'react';
import { Bell, MagnifyingGlass, CalendarBlank, Star, Phone, UserCircle, CaretDown } from '@phosphor-icons/react';
import { getStudents } from '../../../services/api/tenantService';

const Students = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const data = await getStudents();
            if (data.status === 'success') {
                setStudents(data.data);
            }
        } catch (err) {
            setError('حدث خطأ أثناء تحميل بيانات الطلاب');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = students.filter(s =>
        s.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div className="greeting">
                    <h1>السلام عليكم، أ. {localStorage.getItem('username') || 'محمد العمري'}</h1>
                    <p>{dateStr}</p>
                </div>
                <div className="header-actions hide-on-mobile">
                    <div className="icon-btn">
                        <Bell size={20} />
                        <span className="badge"></span>
                    </div>
                </div>
            </div>

            {/* Page Title + Actions */}
            <div className="page-header-flex">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 className="students-page-title">الطلاب</h2>
                    {!loading && (
                        <span className="students-count-badge">{filtered.length} طالب</span>
                    )}
                </div>
                <div className="page-actions">
                    <div className="search-bar">
                        <MagnifyingGlass size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="ابحث عن طالب ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="date-picker-mock">
                        <span>اختر الجلسة / الدس</span>
                        <CalendarBlank size={20} />
                    </div>
                    <button className="btn-primary">طلب تسجيل طالب</button>
                </div>
            </div>

            {/* Error */}
            {error && <div className="api-error">{error}</div>}

            {/* Loading */}
            {loading ? (
                <div className="loading-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="student-card-skeleton"></div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <UserCircle size={60} />
                    <p>لا يوجد طلاب {searchQuery ? 'مطابقون للبحث' : 'مسجلون حتى الآن'}</p>
                </div>
            ) : (
                <div className="students-grid">
                    {filtered.map((student) => (
                        <StudentCard key={student.id} student={student} />
                    ))}
                </div>
            )}
        </div>
    );
};

const StudentCard = ({ student }) => {
    const enrollment = student.enrollments?.[0];
    return (
        <div className="student-card">
            {/* Avatar */}
            <div className="student-card-top" style={{ justifyContent: 'center' }}>
                <div className="student-card-avatar">
                    <UserCircle size={72} weight="light" />
                </div>
            </div>

            {/* Name */}
            <h3 className="student-card-name">{student.full_name}</h3>

            {/* Page reached */}
            {enrollment?.reached_page && (
                <p className="student-card-page">رقم صفحة الوصول : {enrollment.reached_page}</p>
            )}

            {/* Details */}
            <div className="student-card-details">
                {student.parent_name && (
                    <div className="student-detail-row">
                        <span className="detail-label">اسم الأب :</span>
                        <span className="detail-value">{student.parent_name}</span>
                    </div>
                )}
                {student.birth_date && (
                    <div className="student-detail-row">
                        <span className="detail-label">تاريخ الميلاد :</span>
                        <span className="detail-value">{new Date(student.birth_date).toLocaleDateString('ar-SA')}</span>
                    </div>
                )}
                {student.national_id && (
                    <div className="student-detail-row">
                        <span className="detail-label">رقم الوثيقة :</span>
                        <span className="detail-value">{student.national_id}</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="student-card-actions">
                <button className="student-action-btn-secondary">تعديل</button>
                <button className="student-action-btn-primary">نشاط الطالب</button>
            </div>

            {student.parent_phone && (
                <button className="student-phone-btn" aria-label="اتصال">
                    <Phone size={18} />
                </button>
            )}
        </div>
    );
};

export default Students;


