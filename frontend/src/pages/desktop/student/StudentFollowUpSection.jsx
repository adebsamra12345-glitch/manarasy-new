import React, { useState, useEffect } from 'react';
import {
    CalendarBlank, Funnel, BookOpen, Star, CheckCircle,
    ArrowLeft, ArrowRight, Clock, User, Check, WarningCircle,
    Sparkle, Trophy, ArrowsClockwise
} from '@phosphor-icons/react';
import { getStudentFollowUp } from '../../../services/pointsAndRewardsApi';
import './studentParentPortal.css';

const StudentFollowUpSection = ({ studentId }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [records, setRecords] = useState([]);
    const [summaryStats, setSummaryStats] = useState({});
    const [pagination, setPagination] = useState({ page: 1, page_size: 15, total_pages: 1, total_items: 0 });

    // Filter states
    const [selectedType, setSelectedType] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        loadFollowUpData(1);
    }, [studentId, selectedType]);

    const loadFollowUpData = async (targetPage = 1) => {
        setLoading(true);
        try {
            const params = {
                student_id: studentId || undefined,
                type: selectedType,
                page: targetPage,
                page_size: 15,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined
            };
            const res = await getStudentFollowUp(params);
            if (res.status === 'success' && res.data) {
                setData(res.data);
                setRecords(res.data.records || []);
                setSummaryStats(res.data.summary_stats || {});
                setPagination(res.data.pagination || { page: 1, page_size: 15, total_pages: 1, total_items: 0 });
            }
        } catch (err) {
            console.error('Failed to load student follow-up data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyDateFilter = (e) => {
        e.preventDefault();
        loadFollowUpData(1);
    };

    const handleResetFilters = () => {
        setDateFrom('');
        setDateTo('');
        setSelectedType('ALL');
        loadFollowUpData(1);
    };

    const getTypeBadgeClass = (type) => {
        switch (type) {
            case 'MEMORIZATION':
                return 'fu-badge-green';
            case 'REVIEW':
                return 'fu-badge-blue';
            case 'BEHAVIOR':
                return 'fu-badge-purple';
            case 'DAILY':
                return 'fu-badge-teal';
            case 'EXAM':
                return 'fu-badge-gold';
            default:
                return 'fu-badge-gray';
        }
    };

    return (
        <div className="portal-followup-container">
            {/* Header & Title */}
            <div className="portal-section-header" style={{ marginBottom: 16 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: '#133315', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BookOpen size={24} color="#133315" />
                        سجل المتابعة والتقييمات التاريخي المتكامل
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                        عرض موحد وشامل لجميع تقييمات الحفظ، المراجعة، السلوك، والامتحانات منذ بدء التسجيل
                    </p>
                </div>
                <button
                    className="portal-refresh-btn"
                    onClick={() => loadFollowUpData(pagination.page)}
                    title="تحديث البيانات"
                >
                    <ArrowsClockwise size={16} />
                    تحديث
                </button>
            </div>

            {/* 1. Summary Metrics Bar */}
            <div className="fu-metrics-grid">
                <div className="fu-metric-card">
                    <span className="fu-metric-lbl">إجمالي السجلات</span>
                    <strong className="fu-metric-val" style={{ color: '#0f172a' }}>
                        {summaryStats.total_records || 0}
                    </strong>
                </div>
                <div className="fu-metric-card">
                    <span className="fu-metric-lbl">جلسات الحفظ الجديد</span>
                    <strong className="fu-metric-val" style={{ color: '#15803d' }}>
                        {summaryStats.total_memorization || 0}
                    </strong>
                </div>
                <div className="fu-metric-card">
                    <span className="fu-metric-lbl">جلسات المراجعة</span>
                    <strong className="fu-metric-val" style={{ color: '#2563eb' }}>
                        {summaryStats.total_review || 0}
                    </strong>
                </div>
                <div className="fu-metric-card">
                    <span className="fu-metric-lbl">سجلات السلوك والحضور</span>
                    <strong className="fu-metric-val" style={{ color: '#7c3aed' }}>
                        {summaryStats.total_behavior || 0}
                    </strong>
                </div>
                <div className="fu-metric-card">
                    <span className="fu-metric-lbl">الاختبارات والامتحانات</span>
                    <strong className="fu-metric-val" style={{ color: '#b45309' }}>
                        {summaryStats.total_exams || 0}
                    </strong>
                </div>
            </div>

            {/* 2. Filters Row */}
            <div className="fu-filters-panel">
                {/* Type Filter Pills */}
                <div className="fu-type-pills">
                    {[
                        { key: 'ALL', label: 'الكل' },
                        { key: 'MEMORIZATION', label: 'حفظ جديد' },
                        { key: 'REVIEW', label: 'مراجعة' },
                        { key: 'BEHAVIOR', label: 'سلوك وحضور' },
                        { key: 'DAILY', label: 'تقييمات يومية' },
                        { key: 'EXAM', label: 'اختبارات' }
                    ].map((pill) => (
                        <button
                            key={pill.key}
                            className={`fu-pill-btn ${selectedType === pill.key ? 'active' : ''}`}
                            onClick={() => setSelectedType(pill.key)}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>

                {/* Date Filter Form */}
                <form className="fu-date-filter-form" onSubmit={handleApplyDateFilter}>
                    <div className="fu-date-input-group">
                        <label>من تاريخ:</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div className="fu-date-input-group">
                        <label>إلى تاريخ:</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="fu-filter-action-btn">
                        <Funnel size={14} />
                        تطبيق
                    </button>
                    {(dateFrom || dateTo || selectedType !== 'ALL') && (
                        <button
                            type="button"
                            className="fu-filter-reset-btn"
                            onClick={handleResetFilters}
                        >
                            إلغاء الفلترة
                        </button>
                    )}
                </form>
            </div>

            {/* 3. Records Table (Desktop) & Cards (Mobile) */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#133315', fontWeight: 600 }}>
                    جاري تحميل سجل المتابعة والتقييمات...
                </div>
            ) : records.length === 0 ? (
                <div className="fu-empty-state">
                    <CalendarBlank size={48} color="#94a3b8" />
                    <h4>لا توجد سجلات مطابقة للبحث</h4>
                    <p>لم يتم تسجيل تقييمات أو أنشطة مطابقة للخيارات المحددة في هذه الفترة.</p>
                </div>
            ) : (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="portal-table fu-records-table hide-on-mobile">
                            <thead>
                                <tr>
                                    <th>التاريخ</th>
                                    <th>نوع التقييم</th>
                                    <th>البيان والتفاصيل</th>
                                    <th>الحلقة والمعلم</th>
                                    <th>الدرجة / التقييم</th>
                                    <th>الملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((row) => (
                                    <tr key={row.id}>
                                        <td style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                            {row.date}
                                        </td>
                                        <td>
                                            <span className={`fu-type-badge ${getTypeBadgeClass(row.type)}`}>
                                                {row.type_label}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>
                                            {row.title}
                                            {row.requires_repeat && (
                                                <span className="fu-repeat-tag">إعادة</span>
                                            )}
                                        </td>
                                        <td style={{ fontSize: 13, color: '#475569' }}>
                                            <div>{row.halaqa_name}</div>
                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>المعلم: {row.teacher_name}</div>
                                        </td>
                                        <td>
                                            <span
                                                className="fu-grade-badge"
                                                style={{
                                                    backgroundColor: `${row.badge_color}18`,
                                                    color: row.badge_color,
                                                    border: `1px solid ${row.badge_color}40`
                                                }}
                                            >
                                                {row.grade}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 12, color: '#64748b', maxWidth: 260 }}>
                                            {row.notes ? row.notes : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile Cards View */}
                        <div className="fu-mobile-cards hide-on-desktop">
                            {records.map((row) => (
                                <div key={row.id} className="fu-mobile-card">
                                    <div className="fu-mobile-card-top">
                                        <span style={{ fontWeight: 700, fontSize: 13 }}>{row.date}</span>
                                        <span className={`fu-type-badge ${getTypeBadgeClass(row.type)}`}>
                                            {row.type_label}
                                        </span>
                                    </div>
                                    <div style={{ margin: '8px 0', fontSize: 14, fontWeight: 700 }}>
                                        {row.title}
                                        {row.requires_repeat && <span className="fu-repeat-tag">إعادة</span>}
                                    </div>
                                    <div className="fu-mobile-card-meta">
                                        <span>الحلقة: {row.halaqa_name}</span>
                                        <span>المعلم: {row.teacher_name}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                                        <span style={{ fontSize: 12, color: '#64748b' }}>التقييم:</span>
                                        <span
                                            className="fu-grade-badge"
                                            style={{
                                                backgroundColor: `${row.badge_color}18`,
                                                color: row.badge_color,
                                                border: `1px solid ${row.badge_color}40`
                                            }}
                                        >
                                            {row.grade}
                                        </span>
                                    </div>
                                    {row.notes && (
                                        <div className="fu-mobile-notes">
                                            {row.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pagination Bar */}
                    {pagination.total_pages > 1 && (
                        <div className="fu-pagination-bar">
                            <span style={{ fontSize: 13, color: '#64748b' }}>
                                صفحة {pagination.page} من {pagination.total_pages} (إجمالي {pagination.total_items} سجل)
                            </span>
                            <div className="fu-pagination-controls">
                                <button
                                    className="fu-page-btn"
                                    disabled={!pagination.has_prev}
                                    onClick={() => loadFollowUpData(pagination.page - 1)}
                                >
                                    <ArrowRight size={16} />
                                    السابق
                                </button>
                                <span className="fu-page-indicator">{pagination.page}</span>
                                <button
                                    className="fu-page-btn"
                                    disabled={!pagination.has_next}
                                    onClick={() => loadFollowUpData(pagination.page + 1)}
                                >
                                    التالي
                                    <ArrowLeft size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default StudentFollowUpSection;
