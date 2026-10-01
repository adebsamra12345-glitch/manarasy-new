import React, { useState } from 'react';
import { Bell, MagnifyingGlass, Plus } from '@phosphor-icons/react';

const TeacherDashboard = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const rings = [
        { id: 1, title: 'إقرأ وارتق', subtitle: 'مشروع الضبط والاتقان', studentsCount: 24 },
        { id: 2, title: 'إقرأ وارتق', subtitle: 'مشروع الضبط والاتقان', studentsCount: 24 },
    ];

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div className="greeting">
                    <h1>السلام عليكم، أ. {localStorage.getItem('username') || 'محمد العمري'}</h1>
                    <p>{dateStr}</p>
                </div>
                <div className="header-actions">
                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={16} />
                        حلقة جديدة
                    </button>
                    <div className="icon-btn">
                        <Bell size={20} />
                        <span className="badge"></span>
                    </div>
                </div>
            </div>

            {/* Title & Search */}
            <div className="page-header-flex" style={{ marginTop: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                <h2 className="students-page-title" style={{ fontSize: '1.8rem', color: '#133315' }}>الحلقات القرآنية</h2>
                <div className="search-bar" style={{ width: '300px' }}>
                    <MagnifyingGlass size={18} className="search-icon" />
                    <input type="text" placeholder="ابحث عن حلقة ..." className="search-input" />
                </div>
            </div>

            {/* Rings List */}
            <div className="rings-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {rings.map(ring => (
                    <div key={ring.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', border: '1px solid #eee', borderRadius: '12px', background: '#fff' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ textAlign: 'right' }}>
                                <h3 style={{ fontSize: '1.5rem', color: '#133315', marginBottom: '0.5rem' }}>{ring.title}</h3>
                                <p style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {ring.subtitle}
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#81b255', display: 'inline-block' }}></span>
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <span style={{ fontSize: '1.2rem', color: '#133315' }}>{ring.studentsCount} طالب</span>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn-primary" style={{ backgroundColor: '#558b2f' }}>تعديل</button>
                                <button className="btn-primary" style={{ backgroundColor: '#f57c00' }}>طلاب الحلقة</button>
                            </div>
                        </div>

                    </div>
                ))}
            </div>

        </div>
    );
};

export default TeacherDashboard;
