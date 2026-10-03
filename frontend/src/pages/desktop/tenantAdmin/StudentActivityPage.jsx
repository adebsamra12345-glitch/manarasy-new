import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowRight, GraduationCap, ChalkboardTeacher, CalendarBlank,
    CheckCircle, XCircle, WarningCircle, Sparkle, FilePdf, FileXls,
    TrendUp, TrendDown, Minus, BookOpen, Clock, ShieldCheck,
    ArrowsClockwise, MagnifyingGlass, User
} from '@phosphor-icons/react';
import { getStudentActivityData, getAvailableMosqueMonths } from '../../../services/api/tenantService';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileStudentActivityPage from '../../mobile/tenantAdmin/MobileStudentActivityPage';
import './studentActivityPage.css';

const StudentActivityPage = () => {
    const { isMobile } = useDeviceType();

    if (isMobile) {
        return <MobileStudentActivityPage />;
    }

    const { studentId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activityData, setActivityData] = useState(null);
    const [activeSubTab, setActiveSubTab] = useState('recitations'); // 'recitations' | 'attendance'
    const [timeFilter, setTimeFilter] = useState('all');
    const [availableMonths, setAvailableMonths] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [exporting, setExporting] = useState(false);

    // Fetch Available Months
    useEffect(() => {
        const fetchMonths = async () => {
            try {
                const res = await getAvailableMosqueMonths();
                if (res?.status === 'success' && res.data) {
                    setAvailableMonths(res.data);
                }
            } catch (err) {
                console.error('Failed to load available mosque months:', err);
            }
        };
        fetchMonths();
    }, []);

    // Fetch Student Activity
    const fetchActivity = useCallback(async () => {
        if (!studentId) return;
        setLoading(true);
        setError(null);
        try {
            const params = { time_filter: timeFilter };
            const res = await getStudentActivityData(studentId, params);
            if (res?.status === 'success' && res.data) {
                setActivityData(res.data);
            } else {
                throw new Error(res?.message || 'فشل في تحميل سجل نشاط الطالب');
            }
        } catch (err) {
            console.error('Error fetching student activity:', err);
            setError(err.message || 'تعذر تحميل بيانات نشاط الطالب');
        } finally {
            setLoading(false);
        }
    }, [studentId, timeFilter]);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    // CSV/XLSX Export
    const handleExportCSV = () => {
        if (!activityData) return;
        setExporting(true);

        const student = activityData.student_info || {};
        let csvContent = '\uFEFF'; // UTF-8 BOM
        csvContent += `تقرير نشاط الطالب: ${student.full_name || ''}\n`;
        csvContent += `الحلقة: ${student.halaqa_name || ''} | المعلم: ${student.teacher_name || ''}\n\n`;

        if (activeSubTab === 'recitations') {
            csvContent += 'التاريخ,نوع التسميع,الصفحة,من سورة,من آية,إلى سورة,إلى آية,التقدير,أخطاء الحفظ,أخطاء التجويد,ملاحظات\n';
            (activityData.recitations_history || []).forEach(r => {
                csvContent += `"${r.date}","${r.recitation_type}","${r.page_number}","${r.from_surah || ''}","${r.from_ayah || ''}","${r.to_surah || ''}","${r.to_ayah || ''}","${r.grade || ''}","${r.memorization_mistakes}","${r.tajweed_mistakes}","${(r.notes || '').replace(/"/g, '""')}"\n`;
            });
        } else {
            csvContent += 'تاريخ الجلسة,حالة الحضور,متأخر,تقييم السلوك,الدرجة,ملاحظات\n';
            (activityData.attendance_history || []).forEach(a => {
                csvContent += `"${a.session_date}","${a.status}","${a.is_late ? 'نعم' : 'لا'}","${a.behavior || ''}","${a.behavior_score || ''}","${(a.notes || '').replace(/"/g, '""')}"\n`;
            });
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `student_activity_${student.full_name || 'report'}_${activeSubTab}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExporting(false);
    };

    // PDF Export
    const handleExportPDF = () => {
        if (!activityData) return;
        window.print();
    };

    const studentInfo = activityData?.student_info || {};
    const stats = activityData?.summary_stats || {};
    const aiTrend = activityData?.ai_trend_analysis;

    const filteredRecitations = (activityData?.recitations_history || []).filter(r =>
        !searchQuery || r.recitation_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(r.page_number).includes(searchQuery) || (r.grade || '').includes(searchQuery)
    );

    const filteredAttendance = (activityData?.attendance_history || []).filter(a =>
        !searchQuery || a.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.session_date?.includes(searchQuery) || (a.notes || '').includes(searchQuery)
    );

    return (
        <div className="student-activity-container" dir="rtl">
            {/* Top Navigation */}
            <div className="activity-nav-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowRight size={18} />
                    <span>العودة</span>
                </button>

                <div className="activity-actions">
                    <div className="time-filter-wrapper">
                        <CalendarBlank size={16} />
                        <select
                            value={timeFilter}
                            onChange={(e) => setTimeFilter(e.target.value)}
                            className="activity-time-select"
                        >
                            <option value="all">كافة السجلات التراكمية</option>
                            <option value="this_month">الشهر الحالي</option>
                            <option value="last_month">الشهر الماضي</option>
                            <option value="last30">آخر 30 يوماً</option>
                            {availableMonths.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    <button className="export-btn export-csv" onClick={handleExportCSV} disabled={exporting || loading}>
                        <FileXls size={18} />
                        <span>تصدير Excel (CSV)</span>
                    </button>

                    <button className="export-btn export-pdf" onClick={handleExportPDF} disabled={loading}>
                        <FilePdf size={18} />
                        <span>طباعة / PDF</span>
                    </button>
                </div>
            </div>

            {loading && (
                <div className="activity-loading">
                    <ArrowsClockwise size={36} className="spin-icon" />
                    <span>جاري تحميل السجل الكامل لنشاط الطالب...</span>
                </div>
            )}

            {error && !loading && (
                <div className="activity-error">
                    <WarningCircle size={28} />
                    <span>{error}</span>
                    <button className="retry-btn" onClick={fetchActivity}>إعادة المحاولة</button>
                </div>
            )}

            {!loading && !error && activityData && (
                <>
                    {/* Student Profile Card */}
                    <div className="student-hero-card">
                        <div className="hero-avatar">
                            <GraduationCap size={40} weight="duotone" />
                        </div>
                        <div className="hero-details">
                            <h1 className="hero-name">{studentInfo.full_name}</h1>
                            <div className="hero-meta-row">
                                <span className="meta-tag">
                                    <BookOpen size={14} /> الحلقة: {studentInfo.halaqa_name}
                                </span>
                                <span className="meta-tag">
                                    <ChalkboardTeacher size={14} /> المعلم: {studentInfo.teacher_name}
                                </span>
                                <span className="meta-tag">
                                    <Clock size={14} /> الصفحة الحالية: {studentInfo.reached_page}
                                </span>
                                {studentInfo.national_id && (
                                    <span className="meta-tag">
                                        <ShieldCheck size={14} /> الرقم القومي: {studentInfo.national_id}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="hero-badge">
                            <span className="badge-rating">{stats.rating || 'مستمر'}</span>
                        </div>
                    </div>

                    {/* Stat Metrics Grid */}
                    <div className="activity-stats-grid">
                        <div className="activity-stat-card border-green">
                            <p className="stat-label">نسبة الحضور</p>
                            <h3 className="stat-val">{stats.attendance_rate || '0%'}</h3>
                            <span className="stat-sub">{stats.present_days || 0} يوم حضور فعلي</span>
                        </div>
                        <div className="activity-stat-card border-blue">
                            <p className="stat-label">إجمالي الصفحات المسمعة</p>
                            <h3 className="stat-val">{stats.total_pages_recited || 0}</h3>
                            <span className="stat-sub">صفحة معتمدة</span>
                        </div>
                        <div className="activity-stat-card border-orange">
                            <p className="stat-label">متوسط تقييم السلوك</p>
                            <h3 className="stat-val">{stats.avg_behavior_score || 10} / 10</h3>
                            <span className="stat-sub">انضباط وتفاعل إيجابي</span>
                        </div>
                        <div className="activity-stat-card border-red">
                            <p className="stat-label">أيام الغياب</p>
                            <h3 className="stat-val">{stats.absent_days || 0}</h3>
                            <span className="stat-sub">{stats.late_days || 0} مرات تأخير</span>
                        </div>
                    </div>

                    {/* AI Student Trend Card */}
                    {aiTrend && (
                        <div className="ai-trend-card">
                            <div className="ai-trend-header">
                                <div className="ai-trend-title">
                                    <Sparkle size={20} weight="fill" />
                                    <span>تحليل اتجاهات وسلوك الطالب (AI Student Trend Engine)</span>
                                </div>
                                <span className={`risk-tag risk-${aiTrend.risk_color}`}>
                                    {aiTrend.risk_classification}
                                </span>
                            </div>
                            <div className="ai-trend-body">
                                <div className="ai-metric-item">
                                    <span className="ai-label">مؤشر الحضور الأخير (14 يوماً):</span>
                                    <span className="ai-value">{aiTrend.recent_14day_attendance_rate}</span>
                                    <span className="ai-trend-badge">
                                        {aiTrend.attendance_delta > 0 ? <TrendUp size={14} color="#2e7d32" /> :
                                         aiTrend.attendance_delta < 0 ? <TrendDown size={14} color="#c62828" /> :
                                         <Minus size={14} color="#555" />}
                                        {aiTrend.attendance_trend}
                                    </span>
                                </div>
                                <div className="ai-metric-item">
                                    <span className="ai-label">سرعة الحفظ الأسبوعية:</span>
                                    <span className="ai-value">{aiTrend.memorization_velocity_weekly}</span>
                                </div>
                                <p className="ai-recommendation">{aiTrend.recommendation}</p>
                            </div>
                        </div>
                    )}

                    {/* Table View Tabs */}
                    <div className="activity-table-section">
                        <div className="table-nav-bar">
                            <div className="sub-tabs">
                                <button
                                    className={`sub-tab-btn ${activeSubTab === 'recitations' ? 'active' : ''}`}
                                    onClick={() => setActiveSubTab('recitations')}
                                >
                                    سجل التسميع ({filteredRecitations.length})
                                </button>
                                <button
                                    className={`sub-tab-btn ${activeSubTab === 'attendance' ? 'active' : ''}`}
                                    onClick={() => setActiveSubTab('attendance')}
                                >
                                    سجل الحضور والغياب ({filteredAttendance.length})
                                </button>
                            </div>

                            <div className="search-box">
                                <MagnifyingGlass size={16} />
                                <input
                                    type="text"
                                    placeholder="بحث في السجلات..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {activeSubTab === 'recitations' ? (
                            <div className="table-wrapper">
                                <table className="activity-table">
                                    <thead>
                                        <tr>
                                            <th>التاريخ</th>
                                            <th>نوع التسميع</th>
                                            <th>الصفحة</th>
                                            <th>الموضع</th>
                                            <th>التقدير</th>
                                            <th>أخطاء الحفظ</th>
                                            <th>أخطاء التجويد</th>
                                            <th>ملاحظات المعلم</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecitations.length === 0 ? (
                                            <tr><td colSpan="8" className="empty-td">لا توجد سجلات تسميع في الفترة المحددة</td></tr>
                                        ) : (
                                            filteredRecitations.map((r, idx) => (
                                                <tr key={r.id || idx}>
                                                    <td>{r.date}</td>
                                                    <td><span className="badge-type">{r.recitation_type}</span></td>
                                                    <td className="font-bold">{r.page_number}</td>
                                                    <td>{r.from_surah ? `سورة ${r.from_surah} (${r.from_ayah || 1}) ← سورة ${r.to_surah || r.from_surah} (${r.to_ayah || 1})` : '—'}</td>
                                                    <td><span className="badge-grade">{r.grade || 'ممتاز'}</span></td>
                                                    <td>{r.memorization_mistakes || 0}</td>
                                                    <td>{r.tajweed_mistakes || 0}</td>
                                                    <td className="notes-col">{r.notes || '—'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="table-wrapper">
                                <table className="activity-table">
                                    <thead>
                                        <tr>
                                            <th>تاريخ الجلسة</th>
                                            <th>حالة الحضور</th>
                                            <th>التأخير</th>
                                            <th>تقييم السلوك</th>
                                            <th>درجة السلوك</th>
                                            <th>ملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAttendance.length === 0 ? (
                                            <tr><td colSpan="6" className="empty-td">لا توجد سجلات حضور في الفترة المحددة</td></tr>
                                        ) : (
                                            filteredAttendance.map((a, idx) => (
                                                <tr key={a.id || idx}>
                                                    <td>{a.session_date}</td>
                                                    <td>
                                                        <span className={`status-badge status-${a.status === 'حاضر' || a.status === 'PRESENT' ? 'present' : a.status === 'غائب بدون عذر' || a.status === 'ABSENT' ? 'absent' : 'excused'}`}>
                                                            {a.status}
                                                        </span>
                                                    </td>
                                                    <td>{a.is_late ? <span className="late-badge">متأخر</span> : 'في الموعد'}</td>
                                                    <td>{a.behavior || 'ممتاز'}</td>
                                                    <td className="font-bold">{a.behavior_score || 10} / 10</td>
                                                    <td className="notes-col">{a.notes || '—'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ─── Printable A4 Report Template ─────────────────────────── */}
                    <div className="student-activity-print-report" dir="rtl">
                        <div className="print-header">
                            <h1 className="print-title">تقرير النشاط الطالبي</h1>
                            <div className="print-student-name">
                                <strong>اسم الطالب:</strong> {studentInfo.full_name || '—'}
                            </div>
                            {studentInfo.halaqa_name && (
                                <div className="print-sub-info">
                                    <span>الحلقة: {studentInfo.halaqa_name}</span>
                                    {studentInfo.teacher_name && <span> | المعلم: {studentInfo.teacher_name}</span>}
                                </div>
                            )}
                        </div>

                        {/* Attendance Stats Box */}
                        <div className="print-section">
                            <h2 className="print-section-title">إحصائيات الحضور</h2>
                            <div className="print-stats-box">
                                <div className="print-stat-item">
                                    <span className="print-stat-label">عدد مرات الحضور:</span>
                                    <span className="print-stat-value text-green">{stats.present_days || 0} يوم</span>
                                </div>
                                <div className="print-stat-item">
                                    <span className="print-stat-label">عدد مرات الغياب:</span>
                                    <span className="print-stat-value text-red">{stats.absent_days || 0} يوم</span>
                                </div>
                                <div className="print-stat-item print-stat-highlight">
                                    <span className="print-stat-label">نسبة الحضور:</span>
                                    <span className="print-stat-value text-primary">
                                        {(Number(stats.present_days || 0) + Number(stats.absent_days || 0)) > 0
                                            ? Math.round((Number(stats.present_days || 0) / (Number(stats.present_days || 0) + Number(stats.absent_days || 0))) * 100)
                                            : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Recitation and Memorization Table */}
                        <div className="print-section">
                            <h2 className="print-section-title">جدول التسميع والحفظ</h2>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>التاريخ</th>
                                        <th>نوع التسميع</th>
                                        <th>الصفحة</th>
                                        <th>الموضع</th>
                                        <th>التقدير</th>
                                        <th>أخطاء الحفظ</th>
                                        <th>أخطاء التجويد</th>
                                        <th>ملاحظات المعلم</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!activityData.recitations_history || activityData.recitations_history.length === 0) ? (
                                        <tr>
                                            <td colSpan="9" style={{ textAlign: 'center', padding: '1.5rem', color: '#666' }}>
                                                لا توجد سجلات تسميع مسجلة للطالب
                                            </td>
                                        </tr>
                                    ) : (
                                        activityData.recitations_history.map((r, idx) => (
                                            <tr key={r.id || idx}>
                                                <td>{idx + 1}</td>
                                                <td>{r.date || '—'}</td>
                                                <td>{r.recitation_type || '—'}</td>
                                                <td>{r.page_number || '—'}</td>
                                                <td>{r.from_surah ? `سورة ${r.from_surah} (${r.from_ayah || 1}) ← ${r.to_surah || r.from_surah} (${r.to_ayah || 1})` : '—'}</td>
                                                <td>{r.grade || 'ممتاز'}</td>
                                                <td>{r.memorization_mistakes || 0}</td>
                                                <td>{r.tajweed_mistakes || 0}</td>
                                                <td>{r.notes || '—'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StudentActivityPage;
