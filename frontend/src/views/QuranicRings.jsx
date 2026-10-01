import React, { useState, useEffect } from 'react';
import { Bell, Books } from '@phosphor-icons/react';
import { getHalaqat } from '../services/api';

const QuranicRings = () => {
    const [rings, setRings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchRings();
    }, []);

    const fetchRings = async () => {
        setLoading(true);
        try {
            const data = await getHalaqat();
            if (data.status === 'success') {
                setRings(data.data);
            }
        } catch (err) {
            setError('حدث خطأ أثناء تحميل الحلقات');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="dashboard-container">
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

            <div className="page-title">
                <h2>الحلقات القرآنية</h2>
            </div>

            {error && <div className="api-error">{error}</div>}

            {loading ? (
                <div className="rings-list">
                    {[1, 2].map(i => <div key={i} className="ring-card-skeleton"></div>)}
                </div>
            ) : rings.length === 0 ? (
                <div className="empty-state">
                    <Books size={60} />
                    <p>لا توجد حلقات قرآنية مسجلة حتى الآن</p>
                </div>
            ) : (
                <div className="rings-list">
                    {rings.map(ring => (
                        <div className="ring-card" key={ring.id}>
                            <div className="ring-card-accent" style={{ backgroundColor: 'var(--accent-orange)' }}></div>
                            <div className="ring-card-content">
                                <div className="ring-info">
                                    <h3>{ring.name}</h3>
                                    <div className="ring-meta">
                                        <span className="status-dot"></span>
                                        <span>{ring.project_title || 'بدون مشروع'}</span>
                                    </div>
                                    {ring.teacher_name && (
                                        <div className="ring-meta" style={{ marginTop: '4px' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>المعلم: {ring.teacher_name}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="ring-students">
                                    {ring.max_students} طالب
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuranicRings;

