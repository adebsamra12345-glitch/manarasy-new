import React, { useState, useEffect } from 'react';
import { Bell, Users, CaretDown, Medal, Book, WarningCircle } from '@phosphor-icons/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getMosqueAdminDashboardData } from '../../../services/api/tenantService';

const MosqueAdminDashboard = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await getMosqueAdminDashboardData();
                setData(res.data);
                setLoading(false);
            } catch (err) {
                console.error("Dashboard error:", err);
                setError('حدث خطأ أثناء جلب البيانات');
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: '#558b2f' }}>جاري تحميل الإحصائيات...</div>;
    }

    if (error) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: '#c62828' }}>{error}</div>;
    }

    const {
        total_active_students,
        total_teachers,
        total_rings,
        awarded_points,
        gender_distribution,
        performance_chart,
        pending_requests
    } = data;

    const pieData = [
        { name: 'الذكور', value: gender_distribution.male_count, color: '#f57c00' },
        { name: 'الإناث', value: gender_distribution.female_count, color: '#558b2f' },
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
                    <div className="select-halaqa" style={{ border: '1px solid #eee', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ color: '#888' }}>المركز الرئيسي</span>
                        <CaretDown size={16} />
                    </div>
                    <div className="icon-btn" style={{ position: 'relative' }}>
                        <Bell size={20} />
                        <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                {/* Stat 1 */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <span style={{ color: '#558b2f', fontSize: '0.9rem', fontWeight: 'bold' }}>+12% &uarr;</span>
                        <Users size={24} color="#888" />
                    </div>
                    <h2 style={{ fontSize: '2rem', color: '#133315', marginBottom: '0.5rem' }}>{total_active_students}</h2>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>إجمالي الطلاب النشطين</p>
                </div>

                {/* Stat 2 */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <Users size={24} color="#888" />
                    </div>
                    <h2 style={{ fontSize: '2rem', color: '#133315', marginBottom: '0.5rem' }}>{total_teachers}</h2>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>إجمالي المعلمين</p>
                </div>

                {/* Stat 3 */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <Book size={24} color="#888" />
                    </div>
                    <h2 style={{ fontSize: '2rem', color: '#133315', marginBottom: '0.5rem' }}>{total_rings}</h2>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>الحلقات</p>
                </div>

                {/* Stat 4 */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <span style={{ color: '#558b2f', fontSize: '0.9rem', fontWeight: 'bold' }}>+8% &uarr;</span>
                        <Medal size={24} color="#888" />
                    </div>
                    <h2 style={{ fontSize: '2rem', color: '#133315', marginBottom: '0.5rem' }}>{awarded_points.toLocaleString()}</h2>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>النقاط الممنوحة</p>
                </div>
            </div>

            {/* Charts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
                {/* Line Chart */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ border: '1px solid #eee', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ color: '#888' }}>المركز الرئيسي</span>
                            <CaretDown size={16} />
                        </div>
                    </div>
                    <div style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performance_chart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                                <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                                <Line type="monotone" dataKey="value" stroke="#558b2f" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', position: 'relative' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#133315', marginBottom: '1rem' }}>توزيع الطلاب</h3>
                    <div style={{ height: 200, position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={0} dataKey="value" stroke="none">
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                            <h2 style={{ fontSize: '1.5rem', color: '#133315' }}>{total_active_students}</h2>
                            <p style={{ color: '#888', fontSize: '0.9rem' }}>الطلاب</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', padding: '0 1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ color: '#888', fontSize: '0.8rem' }}>الذكور</p>
                            <p style={{ fontSize: '0.9rem', color: '#133315' }}>{gender_distribution.male_count} ({gender_distribution.male_percentage}%)</p>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ color: '#888', fontSize: '0.8rem' }}>الإناث</p>
                            <p style={{ fontSize: '0.9rem', color: '#133315' }}>{gender_distribution.female_count} ({gender_distribution.female_percentage}%)</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notifications & Urgent Actions */}
            <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#133315', marginBottom: '1.5rem' }}>الإشعارات والإجراءات العاجلة</h3>
                
                {/* Pending Requests */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '1rem', color: '#133315', marginBottom: '1rem' }}>طلبات تسجيل معلقة ({pending_requests.length})</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {pending_requests.map(req => (
                            <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
                                <div>
                                    <h5 style={{ fontSize: '1rem', color: '#133315' }}>{req.name}</h5>
                                    {req.level && <p style={{ color: '#888', fontSize: '0.9rem' }}>{req.level}</p>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>رفض</button>
                                    <button style={{ background: '#558b2f', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>موافقة</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Warning Card */}
                <div style={{ background: '#fff9f0', border: '1px solid #ffcc80', borderRadius: '12px', padding: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <WarningCircle size={28} color="#f57c00" />
                    <div>
                        <h5 style={{ fontSize: '1rem', color: '#f57c00', marginBottom: '0.5rem' }}>تنبيه متابعة حضور المعلمين</h5>
                        <p style={{ color: '#133315', fontSize: '0.9rem' }}>المعلم أحمد الراشد لم يسجل حضوراً منذ 5 أيام لمجموعته (حلقة عاصم بن أبي النجود).</p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default MosqueAdminDashboard;


