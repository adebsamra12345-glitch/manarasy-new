import React, { useState, useEffect, useCallback } from 'react';
import {
    ChartBar, CaretDown, Funnel, MagnifyingGlass, FilePdf, FileXls, ArrowsClockwise, WarningCircle
} from '@phosphor-icons/react';
import { getReportsData, getAvailableMosqueMonths } from '../../../services/api/tenantService';

const STANDARD_TIME_FILTERS = [
    { value: 'this_month', label: 'الشهر الحالي' },
    { value: 'last_month', label: 'الشهر الماضي' },
    { value: 'this_year', label: 'السنة الحالية' },
    { value: 'all', label: 'كافة السجلات' }
];

const MobileAdminReports = () => {
    const [activeTab, setActiveTab] = useState('halaqat');
    const [selectedCenter, setSelectedCenter] = useState('all');
    const [selectedProject, setSelectedProject] = useState('all');
    const [timeFilter, setTimeFilter] = useState('this_month');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [reportData, setReportData] = useState(null);
    const [availableMonths, setAvailableMonths] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const fetchMonths = async () => {
            try {
                const res = await getAvailableMosqueMonths();
                if (res?.data) setAvailableMonths(res.data);
            } catch (err) {}
        };
        fetchMonths();
    }, []);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                tab: activeTab,
                center_id: selectedCenter !== 'all' ? selectedCenter : '',
                project_id: selectedProject !== 'all' ? selectedProject : '',
                search: searchQuery,
                time_filter: timeFilter
            };
            const res = await getReportsData(params);
            if (res?.status === 'success' && res.data) {
                setReportData(res.data);
            } else {
                throw new Error('فشل التحميل');
            }
        } catch (err) {
            setError('تعذر تحميل البيانات');
        } finally {
            setLoading(false);
        }
    }, [activeTab, selectedCenter, selectedProject, searchQuery, timeFilter]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const tabs = [
        { id: 'halaqat', label: 'الحلقات' },
        { id: 'centers', label: 'المراكز' },
        { id: 'projects', label: 'المشاريع' },
        { id: 'teachers', label: 'المعلمين' },
        { id: 'students', label: 'الطلاب' }
    ];

    const filterOptions = reportData?.filter_options || { centers: [], projects: [] };

    return (
        <div style={{ padding: '1rem', paddingBottom: '5rem', direction: 'rtl', fontFamily: 'inherit', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#133315', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ChartBar size={24} color="#558b2f" /> التقارير والإحصائيات
                </h2>
                <button onClick={() => setShowFilters(!showFilters)} style={{ background: '#fff', border: '1px solid #ddd', padding: '0.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#333' }}>
                    <Funnel size={18} /> فلاتر
                </button>
            </div>

            {showFilters && (
                <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9' }}>
                        {STANDARD_TIME_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9' }}>
                        <option value="all">جميع المراكز</option>
                        {filterOptions.centers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9' }}>
                        <option value="all">جميع المشاريع</option>
                        {filterOptions.projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div style={{ position: 'relative' }}>
                        <input type="text" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.8rem 2rem 0.8rem 1rem', borderRadius: '8px', border: '1px solid #ddd' }} />
                        <MagnifyingGlass size={16} color="#888" style={{ position: 'absolute', top: '50%', right: '0.6rem', transform: 'translateY(-50%)' }} />
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', overflowX: 'auto', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.5rem' }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '0.6rem 1rem', borderRadius: '20px', border: 'none', background: activeTab === tab.id ? '#133315' : '#e0e0e0', color: activeTab === tab.id ? '#fff' : '#333', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#558b2f' }}><ArrowsClockwise size={32} className="spin-animation" /></div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#c62828' }}><WarningCircle size={32} /><br/>{error}</div>
            ) : reportData && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.5rem' }}>
                        {Object.entries(reportData.stats || {}).slice(0, 4).map(([key, value]) => (
                            <div key={key} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#558b2f' }}>{value}</div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.2rem' }}>{key}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {reportData.items?.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#888', background: '#fff', borderRadius: '12px' }}>لا توجد بيانات مطابقة</div>
                        ) : (
                            reportData.items?.slice(0, 20).map((item, idx) => (
                                <div key={idx} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                                    {activeTab === 'halaqat' && (
                                        <>
                                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#133315' }}>{item.halaqa_name}</h4>
                                            <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>المعلم: {item.teacher}</span>
                                                <span style={{ color: '#558b2f', fontWeight: 'bold' }}>{item.rating}</span>
                                            </div>
                                        </>
                                    )}
                                    {activeTab === 'centers' && (
                                        <>
                                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#133315' }}>{item.center_name}</h4>
                                            <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>الطلاب: {item.students_count}</span>
                                                <span style={{ color: '#558b2f', fontWeight: 'bold' }}>{item.rating}</span>
                                            </div>
                                        </>
                                    )}
                                    {/* Other tabs similar... */}
                                    {(activeTab !== 'halaqat' && activeTab !== 'centers') && (
                                        <div style={{ fontSize: '0.9rem', color: '#333' }}>
                                            {item.name || item.student_name || item.teacher_name || item.project_name || 'سجل'} - <span style={{ color: '#558b2f', fontWeight: 'bold' }}>{item.rating || item.status || ''}</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default MobileAdminReports;
