import React, { useState, useEffect } from 'react';
import { Gift, Trophy, Star, Checks, SlidersHorizontal, MagnifyingGlass, Plus, X, CaretDown, ArrowsClockwise } from '@phosphor-icons/react';
import { getRewardsList, getAdminRewardClaims, getStudentsPointsList, getCompetitionsList } from '../../../services/pointsAndRewardsApi';

const MobilePointsAndRewards = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    
    // Data
    const [students, setStudents] = useState([]);
    const [rewards, setRewards] = useState([]);
    const [claims, setClaims] = useState([]);
    const [competitions, setCompetitions] = useState([]);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'points' || activeTab === 'overview') {
                const res = await getStudentsPointsList({ search: searchQuery });
                if (res?.status === 'success') setStudents(res.data);
            }
            if (activeTab === 'rewards' || activeTab === 'overview') {
                const rewRes = await getRewardsList();
                if (rewRes?.status === 'success') setRewards(rewRes.data);
            }
            if (activeTab === 'claims' || activeTab === 'overview') {
                const claimRes = await getAdminRewardClaims({ status: 'ALL', search: searchQuery });
                if (claimRes?.status === 'success') setClaims(claimRes.data);
            }
            if (activeTab === 'competitions') {
                const compRes = await getCompetitionsList();
                if (compRes?.status === 'success') setCompetitions(compRes.data);
            }
        } catch (err) {} finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'نظرة عامة' },
        { id: 'points', label: 'النقاط' },
        { id: 'rewards', label: 'المتجر' },
        { id: 'claims', label: 'الطلبات' },
        { id: 'competitions', label: 'المسابقات' }
    ];

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Star size={24} color="#558b2f" weight="fill" /> النقاط والمكافآت
                </h2>
            </div>

            <div style={{ display: 'flex', overflowX: 'auto', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '0.6rem 1rem', borderRadius: '20px', border: 'none', background: activeTab === tab.id ? '#133315' : '#e0e0e0', color: activeTab === tab.id ? '#fff' : '#333', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}><ArrowsClockwise size={32} className="spin-animation" /></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {activeTab === 'overview' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', border: '1px solid #eee', textAlign: 'center' }}>
                                <Star size={28} color="#FFC107" weight="fill" style={{ marginBottom: '0.5rem' }} />
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#133315' }}>{students.reduce((acc, s) => acc + (s.total_points || 0), 0)}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>إجمالي النقاط</div>
                            </div>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', border: '1px solid #eee', textAlign: 'center' }}>
                                <Gift size={28} color="#558b2f" style={{ marginBottom: '0.5rem' }} />
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#133315' }}>{rewards.length}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>المكافآت المتاحة</div>
                            </div>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', border: '1px solid #eee', textAlign: 'center' }}>
                                <Checks size={28} color="#2196F3" style={{ marginBottom: '0.5rem' }} />
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#133315' }}>{claims.filter(c => c.status === 'PENDING').length}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>طلبات معلقة</div>
                            </div>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', border: '1px solid #eee', textAlign: 'center' }}>
                                <Trophy size={28} color="#9C27B0" style={{ marginBottom: '0.5rem' }} />
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#133315' }}>{competitions?.length || 0}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>مسابقات فعالة</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'points' && (
                        <>
                            <div style={{ position: 'relative' }}>
                                <input type="text" placeholder="بحث عن طالب..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '12px', border: '1px solid #eee' }} />
                                <MagnifyingGlass size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                            </div>
                            {students.map(student => (
                                <div key={student.id} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 0.3rem 0', color: '#133315' }}>{student.full_name}</h4>
                                        <div style={{ fontSize: '0.85rem', color: '#666' }}>الحلقة: {student.ring_name || 'بدون حلقة'}</div>
                                    </div>
                                    <div style={{ background: '#fff8e1', color: '#f57f17', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        {student.total_points} <Star size={14} weight="fill" />
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {activeTab === 'rewards' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {rewards.map(reward => (
                                <div key={reward.id} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ width: '60px', height: '60px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                                        {reward.image ? <img src={reward.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} /> : <Gift size={32} color="#558b2f" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: '0 0 0.3rem 0', color: '#133315' }}>{reward.name}</h4>
                                        <div style={{ fontSize: '0.85rem', color: '#666' }}>المخزون: {reward.stock_quantity === -1 ? 'غير محدود' : reward.stock_quantity}</div>
                                    </div>
                                    <div style={{ color: '#f57f17', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                        {reward.points_cost} <Star size={14} weight="fill" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'claims' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {claims.map(claim => (
                                <div key={claim.id} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 0.3rem 0', color: '#133315' }}>{claim.student_name}</h4>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>{claim.reward_name}</div>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderRadius: '20px', background: claim.status === 'PENDING' ? '#fff3e0' : claim.status === 'APPROVED' ? '#e8f5e9' : '#ffebee', color: claim.status === 'PENDING' ? '#e65100' : claim.status === 'APPROVED' ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>
                                            {claim.status === 'PENDING' ? 'قيد الانتظار' : claim.status === 'APPROVED' ? 'مقبول' : 'مرفوض'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {activeTab === 'competitions' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {competitions.map(comp => (
                                <div key={comp.id} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee' }}>
                                    <h4 style={{ margin: '0 0 0.3rem 0', color: '#133315' }}>{comp.title}</h4>
                                    <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>الجائزة: {comp.points_reward} نقطة</span>
                                        <span>المدة: {comp.duration_minutes} دقيقة</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MobilePointsAndRewards;
