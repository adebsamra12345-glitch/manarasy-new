import React from 'react';
import { CalendarBlank, CaretLeft } from '@phosphor-icons/react';

const Sessions = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const sessions = [
        { id: 1, dateTitle: 'الثلاثاء، 13 شعبان 1445 هـ | 23 فبراير 2026 م', attendance: '24 / 24', percentage: 100 },
        { id: 2, dateTitle: 'الأحد، 11 شعبان 1445 هـ | 21 فبراير 2026 م', attendance: '24 / 24', percentage: 100 },
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
                        <CalendarBlank size={18} className="search-icon" />
                        <input type="text" placeholder="اختر جلسة / تاريخ" className="search-input" />
                    </div>
                    <button className="btn-primary" style={{ backgroundColor: '#558b2f' }}>جلسة جديدة</button>
                </div>
                <h2 style={{ fontSize: '2rem', color: '#133315' }}>الجلسات</h2>
            </div>

            {/* Sessions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {sessions.map(session => (
                    <div key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem', border: '1px solid #133315', borderRadius: '12px', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            {/* Circular Progress */}
                            <div style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '50%', background: '#e8f5e9', border: '3px solid #558b2f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#133315' }}>{session.percentage}%</span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h3 style={{ fontSize: '1.2rem', color: '#133315', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                {session.dateTitle}
                                <div style={{ width: '6px', height: '30px', background: '#f57c00', borderRadius: '4px', marginRight: '0.5rem' }}></div>
                            </h3>
                            <p style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                الحضور : {session.attendance}
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#81b255', display: 'inline-block' }}></span>
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Sessions;

