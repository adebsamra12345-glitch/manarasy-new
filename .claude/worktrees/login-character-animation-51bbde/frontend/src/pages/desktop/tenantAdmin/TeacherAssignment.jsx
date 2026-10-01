import React from 'react';
import { MagnifyingGlass, CalendarBlank, Phone, Star } from '@phosphor-icons/react';

const Teachers = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const teachers = [
        { id: 1, name: 'عمر الجندي', dob: '20 / 10 / 2013', phone: '099355682', doc: '0401023558', record: 'باب السباع - 560', address: 'حمص', points: 45, gender: 'ذكر' },
        { id: 2, name: 'عمر الجندي', dob: '20 / 10 / 2013', phone: '099355682', doc: '0401023558', record: 'باب السباع - 560', address: 'حمص', points: 45, gender: 'ذكر' },
        { id: 3, name: 'عمر الجندي', dob: '20 / 10 / 2013', phone: '099355682', doc: '0401023558', record: 'باب السباع - 560', address: 'حمص', points: 45, gender: 'ذكر' },
    ];

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
                <div className="greeting">
                    <h1>السلام عليكم، أ. {localStorage.getItem('username') || 'محمد العمري'}</h1>
                    <p>{dateStr}</p>
                </div>
            </div>

            {/* Title & Search */}
            <div className="page-header-flex" style={{ borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="search-bar" style={{ width: '250px' }}>
                        <MagnifyingGlass size={18} className="search-icon" />
                        <input type="text" placeholder="ابحث عن معلم ..." className="search-input" />
                    </div>
                    <div className="search-bar" style={{ width: '200px' }}>
                        <CalendarBlank size={18} className="search-icon" />
                        <input type="text" placeholder="اختر الجلسة / الدس" className="search-input" />
                    </div>
                    <button className="btn-primary" style={{ backgroundColor: '#558b2f' }}>إضافة طالب</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ background: '#f57c00', color: '#fff', padding: '0.2rem 0.8rem', borderRadius: '16px', fontWeight: 'bold' }}>26 معلم</span>
                    <h2 style={{ fontSize: '2.5rem', color: '#133315' }}>المعلمون</h2>
                </div>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {teachers.map(teacher => (
                    <div key={teacher.id} style={{ border: '1px solid #eee', borderRadius: '12px', background: '#fff', padding: '1.5rem', position: 'relative' }}>
                        
                        {/* Avatar */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', marginTop: '-3rem' }}>
                            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: '#fff', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px' }}>
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                </div>
                            </div>
                        </div>

                        {/* Top Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', position: 'absolute', top: '1.5rem', left: '1.5rem', right: '1.5rem' }}>
                            <span style={{ background: '#c8e6c9', color: '#2e7d32', padding: '0.2rem 0.8rem', borderRadius: '16px', fontSize: '0.8rem' }}>معلم</span>
                            <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '0.2rem 0.8rem', borderRadius: '16px', fontSize: '0.8rem' }}>{teacher.gender}</span>
                            <span style={{ color: '#888', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>{teacher.points} نقطة <Star size={14} color="#fbc02d" /></span>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontSize: '1.8rem', color: '#133315', textAlign: 'center', borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '1rem' }}>
                            {teacher.name}
                        </h3>

                        {/* Info List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', textAlign: 'right' }}>
                            <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#133315' }}>{teacher.dob}</span><span style={{ color: '#888' }}>: تاريخ الميلاد</span></p>
                            <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#133315' }}>{teacher.phone}</span><span style={{ color: '#888' }}>: رقم الهاتف</span></p>
                            <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#133315' }}>{teacher.doc}</span><span style={{ color: '#888' }}>: رقم الوثيقة</span></p>
                            <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#133315' }}>{teacher.record}</span><span style={{ color: '#888' }}>: رقم القيد</span></p>
                            <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#133315' }}>{teacher.address}</span><span style={{ color: '#888' }}>: السكن الحالي</span></p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                            <button style={{ background: '#558b2f', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>تعديل</button>
                            <Phone size={24} color="#888" style={{ cursor: 'pointer' }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Teachers;

