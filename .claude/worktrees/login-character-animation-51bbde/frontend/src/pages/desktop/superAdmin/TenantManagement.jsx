import React, { useState } from 'react';
import { MagnifyingGlass, Funnel, Plus, DotsThree, Trash, PencilSimple } from '@phosphor-icons/react';

const Users = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const [searchTerm, setSearchTerm] = useState('');

    const usersData = [
        { id: 1, name: 'محمد العمري', username: 'manager', role: 'مدير النظام', status: 'نشط', lastLogin: 'منذ ساعتين' },
        { id: 2, name: 'أحمد الراشد', username: 'ahmed_r', role: 'معلم حلقة', status: 'نشط', lastLogin: 'أمس' },
        { id: 3, name: 'عمر الجندي', username: 'omar_j', role: 'طالب', status: 'غير نشط', lastLogin: 'منذ أسبوع' },
        { id: 4, name: 'خالد السبيعي', username: 'khalid_s', role: 'معلم حلقة', status: 'نشط', lastLogin: 'منذ 3 ساعات' },
    ];

    const getRoleBadge = (role) => {
        switch(role) {
            case 'مدير النظام':
                return <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '0.3rem 0.8rem', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 'bold' }}>{role}</span>;
            case 'معلم حلقة':
                return <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.3rem 0.8rem', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 'bold' }}>{role}</span>;
            case 'طالب':
                return <span style={{ background: '#fff3e0', color: '#e65100', padding: '0.3rem 0.8rem', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 'bold' }}>{role}</span>;
            default:
                return <span style={{ background: '#f5f5f5', color: '#616161', padding: '0.3rem 0.8rem', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 'bold' }}>{role}</span>;
        }
    };

    const getStatusBadge = (status) => {
        if (status === 'نشط') {
            return <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#2e7d32' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2e7d32' }}></span> نشط</span>;
        }
        return <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#c62828' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c62828' }}></span> غير نشط</span>;
    };

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
                <div className="greeting">
                    <h1>السلام عليكم، أ. {localStorage.getItem('username') || 'محمد العمري'}</h1>
                    <p>{dateStr}</p>
                </div>
            </div>

            {/* Title & Actions */}
            <div className="page-header-flex" style={{ borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="search-bar" style={{ width: '300px' }}>
                        <MagnifyingGlass size={18} className="search-icon" />
                        <input 
                            type="text" 
                            placeholder="ابحث عن مستخدم (اسم، اسم مستخدم)..." 
                            className="search-input" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button style={{ border: '1px solid #eee', background: '#fff', padding: '0.6rem 1rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#666', cursor: 'pointer' }}>
                        <Funnel size={16} />
                        تصفية
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ fontSize: '2.2rem', color: '#133315' }}>إدارة المستخدمين</h2>
                    <button className="btn-primary" style={{ backgroundColor: '#558b2f', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={16} weight="bold" />
                        مستخدم جديد
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.5rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #eee', color: '#888', fontSize: '0.9rem' }}>
                            <th style={{ padding: '1rem' }}>الاسم الكامل</th>
                            <th style={{ padding: '1rem' }}>اسم المستخدم</th>
                            <th style={{ padding: '1rem' }}>الدور (الصلاحية)</th>
                            <th style={{ padding: '1rem' }}>الحالة</th>
                            <th style={{ padding: '1rem' }}>آخر تسجيل دخول</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usersData.filter(u => u.name.includes(searchTerm) || u.username.includes(searchTerm)).map((user) => (
                            <tr key={user.id} style={{ borderBottom: '1px solid #f9f9f9', color: '#133315', transition: 'background 0.2s' }}>
                                <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e3f2fd', color: '#1565c0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                            {user.name.charAt(0)}
                                        </div>
                                        {user.name}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem', color: '#666' }}>@{user.username}</td>
                                <td style={{ padding: '1rem' }}>{getRoleBadge(user.role)}</td>
                                <td style={{ padding: '1rem' }}>{getStatusBadge(user.status)}</td>
                                <td style={{ padding: '1rem', color: '#888' }}>{user.lastLogin}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                        <button style={{ background: 'transparent', border: 'none', color: '#1976d2', cursor: 'pointer', padding: '0.3rem' }}>
                                            <PencilSimple size={20} />
                                        </button>
                                        <button style={{ background: 'transparent', border: 'none', color: '#c62828', cursor: 'pointer', padding: '0.3rem' }}>
                                            <Trash size={20} />
                                        </button>
                                        <button style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0.3rem' }}>
                                            <DotsThree size={24} weight="bold" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {usersData.filter(u => u.name.includes(searchTerm) || u.username.includes(searchTerm)).length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                    لا يوجد مستخدمين مطابقين لعملية البحث
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
};

export default Users;
