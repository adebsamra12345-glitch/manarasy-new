import React, { useState } from 'react';
import { Bell, CaretDown, DownloadSimple, ChartBar, Funnel } from '@phosphor-icons/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const AdminReports = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [activeTab, setActiveTab] = useState('حلقات');

    const tabs = [
        { id: 'حلقات', label: 'تقارير الحلقات' },
        { id: 'مراكز', label: 'تقارير المراكز' },
        { id: 'مشاريع', label: 'تقارير المشاريع' },
        { id: 'معلمين', label: 'تقارير المعلمين' },
        { id: 'طلاب', label: 'تقارير الطلاب' },
        { id: 'صفحات', label: 'تقارير الصفحات المقروءة' },
        { id: 'تقييم', label: 'التقييم العام' },
    ];

    const lineData = [
        { name: 'الأسبوع الأول', value: 10 },
        { name: 'الأسبوع الثاني', value: 25 },
        { name: 'الأسبوع الثالث', value: 40 },
        { name: 'الأسبوع الرابع', value: 65 },
        { name: 'الأسبوع الخامس', value: 50 },
    ];

    const tableData = [
        { id: 1, name: 'حلقة الفجر', teacher: 'أ. أحمد الراشد', students: 18, sessions: 24, attendance: '92%', pages: 540, rating: 'ممتاز', ratingColor: '#e8f5e9', ratingText: '#2e7d32' },
        { id: 2, name: 'حلقة النور', teacher: 'أ. محمد العمري', students: 22, sessions: 22, attendance: '88%', pages: 480, rating: 'جيد جداً', ratingColor: '#e3f2fd', ratingText: '#1565c0' },
        { id: 3, name: 'حلقة الإتقان', teacher: 'أ. خالد السبيعي', students: 15, sessions: 20, attendance: '95%', pages: 620, rating: 'ممتاز', ratingColor: '#e8f5e9', ratingText: '#2e7d32' },
        { id: 4, name: 'حلقة البراعم', teacher: 'أ. عبدالله الحربي', students: 25, sessions: 18, attendance: '78%', pages: 320, rating: 'جيد', ratingColor: '#fff8e1', ratingText: '#f57f17' },
        { id: 5, name: 'حلقة الحفاظ', teacher: 'أ. سعود المالكي', students: 12, sessions: 24, attendance: '96%', pages: 710, rating: 'ممتاز', ratingColor: '#e8f5e9', ratingText: '#2e7d32' },
    ];

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header" style={{ marginBottom: '1rem' }}>
                <div className="greeting">
                    <h1>السلام عليكم، أ. {localStorage.getItem('username') || 'محمد العمري'}</h1>
                    <p>{dateStr}</p>
                </div>
                <div className="header-actions">
                    <button style={{ border: '1px solid #558b2f', color: '#558b2f', background: 'transparent', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold', cursor: 'pointer' }}>
                        <DownloadSimple size={18} />
                        تصدير التقرير
                    </button>
                    <div className="select-halaqa" style={{ border: '1px solid #eee', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ color: '#888' }}>المركز الرئيسي</span>
                        <CaretDown size={16} />
                    </div>
                    <div className="select-halaqa" style={{ border: '1px solid #eee', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ color: '#888' }}>مشروع الضبط والاتقان</span>
                        <CaretDown size={16} />
                    </div>
                    <div className="icon-btn" style={{ position: 'relative' }}>
                        <Bell size={20} />
                        <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, backgroundColor: '#f57c00', borderRadius: '50%' }}></span>
                    </div>
                </div>
            </div>

            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
                <ChartBar size={28} color="#558b2f" weight="fill" />
                <h2 style={{ fontSize: '2rem', color: '#133315' }}>التقارير والإحصائيات</h2>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {tabs.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '0.5rem 1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #eee',
                            background: activeTab === tab.id ? '#558b2f' : '#fff',
                            color: activeTab === tab.id ? '#fff' : '#666',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ color: '#888' }}>الفترة الزمنية:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f8e9', padding: '0.5rem 1rem', borderRadius: '8px', color: '#558b2f' }}>
                        <span>&lt;</span>
                        <span style={{ fontWeight: 'bold' }}>شعبان 1445 هـ</span>
                        <span>&gt;</span>
                    </div>
                    <div style={{ border: '1px solid #eee', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span>حلقة إقرأ وارتق</span>
                        <CaretDown size={16} color="#888" />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ color: '#888' }}>تصفية بالحلقة:</span>
                    <div style={{ border: '1px solid #eee', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span>جميع الحلقات</span>
                        <CaretDown size={16} color="#888" />
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', width: '4px', height: '20px', background: '#f57c00', borderRadius: '4px' }}></div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem', paddingRight: '1rem' }}>إجمالي النقاط الممنوحة</p>
                    <h2 style={{ fontSize: '2rem', color: '#133315', textAlign: 'left' }}>4,520</h2>
                </div>
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', width: '4px', height: '20px', background: '#c62828', borderRadius: '4px' }}></div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem', paddingRight: '1rem' }}>إجمالي الصفحات المسمعة</p>
                    <h2 style={{ fontSize: '2rem', color: '#133315', textAlign: 'left' }}>3,420</h2>
                </div>
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', width: '4px', height: '20px', background: '#1976d2', borderRadius: '4px' }}></div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem', paddingRight: '1rem' }}>متوسط نسبة الحضور</p>
                    <h2 style={{ fontSize: '2rem', color: '#133315', textAlign: 'left' }}>87%</h2>
                </div>
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', width: '4px', height: '20px', background: '#388e3c', borderRadius: '4px' }}></div>
                    <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem', paddingRight: '1rem' }}>إجمالي الجلسات المنعقدة</p>
                    <h2 style={{ fontSize: '2rem', color: '#133315', textAlign: 'left' }}>186</h2>
                </div>
            </div>

            {/* Charts & AI Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Line Chart */}
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                                <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                                <Line type="monotone" dataKey="value" stroke="#558b2f" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <p style={{ textAlign: 'left', color: '#888', fontSize: '0.8rem', marginTop: '1rem', writingMode: 'vertical-rl', position: 'absolute', left: '1rem', top: '50%' }}>
                        أداء الطلاب
                    </p>
                </div>

                {/* AI Box */}
                <div style={{ background: '#f1f8e9', borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.5rem', color: '#133315', marginBottom: '1.5rem' }}>تحليل الذكاء الاصطناعي للانضباط</h3>
                    <p style={{ color: '#133315', fontSize: '1.1rem', lineHeight: '1.8', fontWeight: 'bold' }}>
                        مستوى الضبط مرتفع ومستقر يتوقع استقرار الالتزام بنسبة 95% احتمالات تسرب الطلاب منخفضة نوعاً ما بناء على استقرار الطلاب
                    </p>
                </div>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#133315' }}>إنجازات الحلقات هذا الشهر</h3>
                    <button style={{ border: '1px solid #eee', background: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#666', cursor: 'pointer' }}>
                        <Funnel size={16} />
                        فرز متقدم
                    </button>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #eee', color: '#888', fontSize: '0.9rem' }}>
                            <th style={{ padding: '1rem' }}>اسم الحلقة</th>
                            <th style={{ padding: '1rem' }}>المعلم</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>عدد الطلاب</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>الجلسات المنعقدة</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>نسبة الحضور</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>الصفحات المسمعة</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>التقييم</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map(row => (
                            <tr key={row.id} style={{ borderBottom: '1px solid #f9f9f9', color: '#133315' }}>
                                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{row.name}</td>
                                <td style={{ padding: '1rem' }}>{row.teacher}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>{row.students}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>{row.sessions}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>{row.attendance}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>{row.pages}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <span style={{ background: row.ratingColor, color: row.ratingText, padding: '0.3rem 0.8rem', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                        {row.rating}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
};

export default AdminReports;
