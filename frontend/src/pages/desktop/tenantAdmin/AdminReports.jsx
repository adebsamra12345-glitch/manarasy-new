import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Bell, ChartBar, CaretDown, CaretLeft, CaretRight,
    DownloadSimple, MagnifyingGlass, MapPin, FolderStar,
    Funnel, CheckCircle, WarningCircle, Sparkle,
    ArrowsClockwise, X, CalendarBlank, FilePdf, FileXls,
    GraduationCap, ChalkboardTeacher, Buildings, Folder,
    Eye, ArrowSquareOut, TrendUp
} from '@phosphor-icons/react';
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend
} from 'recharts';
import { getReportsData, getAvailableMosqueMonths } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileAdminReports from '../../mobile/tenantAdmin/MobileAdminReports';
import './adminReports.css';

/* ─── Standard Time Filter Options ────────────────────────────────────────── */
const STANDARD_TIME_FILTERS = [
    { value: 'this_month', label: 'الشهر الحالي (افتراضي)' },
    { value: 'last_month', label: 'الشهر الماضي' },
    { value: 'today', label: 'اليوم' },
    { value: 'yesterday', label: 'أمس' },
    { value: 'last7', label: 'آخر 7 أيام' },
    { value: 'last30', label: 'آخر 30 يوماً' },
    { value: 'this_quarter', label: 'الربع الحالي' },
    { value: 'this_year', label: 'السنة الحالية' },
    { value: 'all', label: 'كافة السجلات (بدون فلتر)' },
    { value: 'custom', label: 'نطاق مخصص' },
];

/* ─── PDF Generation helper (pure JS, no external lib needed) ─────────────── */
function buildPdfHtml({ title, generatedBy, filters, stats, items, tab }) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const filterRows = Object.entries(filters)
        .filter(([, v]) => v && v !== 'all')
        .map(([k, v]) => `<tr><td class="fl">${k}</td><td>${v}</td></tr>`)
        .join('') || '<tr><td colspan="2" class="nd">لا توجد فلاتر مطبقة</td></tr>';

    const statsRows = Object.entries(stats)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => {
            const val = Array.isArray(v) ? `${v.length} عنصر` : typeof v === 'object' ? '' : v;
            return `<tr><td class="fl">${k}</td><td class="sv">${val}</td></tr>`;
        })
        .join('');

    const tabTitles = {
        halaqat: 'تقارير الحلقات',
        centers: 'تقارير المراكز',
        projects: 'تقارير المشاريع',
        teachers: 'تقارير المعلمين',
        students: 'تقارير الطلاب',
        pages: 'تقارير الصفحات المقروءة',
        evaluation: 'التقييم العام',
    };

    let thead = '';
    let tbody = '';

    const colsMap = {
        halaqat: ['اسم الحلقة', 'المعلم', 'عدد الطلاب', 'أيام الدوام', 'نسبة الحضور', 'الصفحات', 'التقييم'],
        centers: ['المركز', 'المدير', 'عدد الحلقات', 'الطلاب', 'نسبة الحضور', 'الصفحات', 'التقييم'],
        projects: ['المشروع', 'الرمز', 'النوع', 'الحلقات', 'الطلاب', 'نسبة الإنجاز', 'الحالة'],
        teachers: ['المعلم', 'الحلقة', 'الطلاب', 'أيام الدوام', 'نسبة الحضور', 'الصفحات', 'التقييم'],
        students: ['الطالب', 'الحلقة', 'نسبة الحضور', 'الصفحة الحالية', 'الصفحات المسمعة', 'التقييم'],
        pages: ['الطالب', 'نوع التسميع', 'رقم الصفحة', 'التقدير', 'التاريخ'],
        evaluation: ['مجال التقييم', 'الدرجة', 'التقدير', 'ملاحظات الأداء'],
    };

    const cols = colsMap[tab] || colsMap.halaqat;
    thead = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

    if (items && items.length > 0) {
        tbody = items.map(item => {
            let cells = [];
            switch (tab) {
                case 'centers': cells = [item.center_name, item.manager, item.halaqat_count, item.students_count, item.attendance_rate, item.pages_recited, item.rating]; break;
                case 'projects': cells = [item.project_name, item.code, item.type, item.halaqat_count, item.students_count, item.completion_rate, item.status]; break;
                case 'teachers': cells = [item.teacher_name, item.halaqa_name, item.students_count, item.sessions_count, item.attendance_rate, item.pages_recited, item.rating]; break;
                case 'students': cells = [item.student_name, item.halaqa_name, item.attendance_rate, item.reached_page, item.pages_recited, item.rating]; break;
                case 'pages': cells = [item.student_name, item.recitation_type, item.page_number, item.grade, item.date]; break;
                case 'evaluation': cells = [item.category, item.score, item.status, item.notes]; break;
                default: cells = [item.halaqa_name, item.teacher, item.students_count, item.sessions_count, item.attendance_rate, item.pages_recited, item.rating];
            }
            return `<tr>${cells.map(c => `<td>${c ?? '—'}</td>`).join('')}</tr>`;
        }).join('');
    } else {
        tbody = `<tr><td colspan="${cols.length}" class="nd">لا توجد بيانات</td></tr>`;
    }

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; color: #1a1a1a; background: #fff; padding: 2cm; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2e7d32; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 28px; font-weight: 900; color: #2e7d32; }
  .meta { text-align: left; font-size: 12px; color: #555; line-height: 1.6; }
  h1 { font-size: 22px; font-weight: 900; color: #1a202c; margin-bottom: 20px; text-align: center; }
  .section-title { font-size: 14px; font-weight: 900; color: #2e7d32; border-right: 4px solid #2e7d32; padding-right: 10px; margin: 20px 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f1f8f1; color: #2e7d32; font-weight: 900; padding: 10px 12px; border: 1px solid #c8e6c9; text-align: right; font-size: 12px; }
  td { padding: 9px 12px; border: 1px solid #e8f5e9; font-size: 12px; color: #333; }
  tr:nth-child(even) td { background: #fafff9; }
  .fl { font-weight: 700; color: #555; }
  .sv { font-weight: 900; color: #2e7d32; font-size: 14px; }
  .nd { text-align: center; color: #999; padding: 16px; font-style: italic; }
  .footer { margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #999; }
  @media print {
    body { padding: 1cm; }
    @page { size: A4; margin: 1cm; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="logo">مَنَارَة</div>
  <div class="meta">
    <div>تاريخ الإنشاء: ${dateStr} - ${timeStr}</div>
    <div>أُنشئ بواسطة: ${generatedBy}</div>
  </div>
</div>
<h1>${title} — ${tabTitles[tab] || 'التقارير'}</h1>

<div class="section-title">الفلاتر المطبقة</div>
<table><tbody>${filterRows}</tbody></table>

<div class="section-title">ملخص الإحصائيات</div>
<table><tbody>${statsRows}</tbody></table>

<div class="section-title">البيانات التفصيلية</div>
<table>
  <thead>${thead}</thead>
  <tbody>${tbody}</tbody>
</table>

<div class="footer">
  <span>منصة مَنَارَة — نظام إدارة تحفيظ القرآن الكريم</span>
  <span>تقرير مُصدَّر بتاريخ ${dateStr}</span>
</div>
</body>
</html>`;
}

const AdminReports = () => {
    const { user, role } = useAuthContext();
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/center-manager') ? '/center-manager' : '/admin';
    const isCenterManager = (role && role.toLowerCase() === 'center_manager') || location.pathname.startsWith('/center-manager');
    const { isMobile } = useDeviceType();

    if (isMobile) {
        return <MobileAdminReports />;
    }

    // Dates
    const todayDate = new Date();
    const hijriDate = new Intl.DateTimeFormat('ar-SA', {
        calendar: 'islamic', day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const gregorianDate = new Intl.DateTimeFormat('ar-EG', {
        day: 'numeric', month: 'long', year: 'numeric'
    }).format(todayDate);
    const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(todayDate);
    const formattedDateHeader = `${weekday}، ${hijriDate} | ${gregorianDate} م`;

    const userDisplayName = user?.username || localStorage.getItem('username') || 'أ. محمد العمري';

    /* ─── State ────────────────────────────────────────────────────────────── */
    const [activeTab, setActiveTab] = useState('halaqat');

    // Entity Filters
    const [selectedProject, setSelectedProject] = useState('all');
    const [selectedCenter, setSelectedCenter] = useState('all');
    const [selectedHalaqa, setSelectedHalaqa] = useState('all');
    const [selectedTeacher, setSelectedTeacher] = useState('all');
    const [selectedStudent, setSelectedStudent] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Time Filters (Default: 'this_month')
    const [timeFilter, setTimeFilter] = useState('this_month');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [dateRangeError, setDateRangeError] = useState('');

    // UI State
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingXls, setExportingXls] = useState(false);

    // Data State
    const [reportData, setReportData] = useState(null);
    const [availableMonths, setAvailableMonths] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('success');

    // Fetch Available Mosque Months
    useEffect(() => {
        const fetchMonths = async () => {
            try {
                const res = await getAvailableMosqueMonths();
                if (res?.status === 'success' && res.data) {
                    setAvailableMonths(res.data);
                }
            } catch (err) {
                console.error('Error fetching available mosque months:', err);
            }
        };
        fetchMonths();
    }, []);

    // Fetch Reports Data
    const fetchReportData = useCallback(async () => {
        if (timeFilter === 'custom') {
            if (!dateFrom || !dateTo) {
                setDateRangeError('يرجى تحديد تاريخ البداية والنهاية');
                return;
            }
            if (new Date(dateFrom) > new Date(dateTo)) {
                setDateRangeError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
                return;
            }
        }
        setDateRangeError('');
        setLoading(true);
        setError(null);
        try {
            const params = {
                tab: activeTab,
                center_id: selectedCenter !== 'all' ? selectedCenter : '',
                project_id: selectedProject !== 'all' ? selectedProject : '',
                halaqa_id: selectedHalaqa !== 'all' ? selectedHalaqa : '',
                teacher_id: selectedTeacher !== 'all' ? selectedTeacher : '',
                student_id: selectedStudent !== 'all' ? selectedStudent : '',
                search: searchQuery,
                time_filter: timeFilter,
                date_from: timeFilter === 'custom' ? dateFrom : '',
                date_to: timeFilter === 'custom' ? dateTo : '',
            };
            const res = await getReportsData(params);
            if (res && res.status === 'success' && res.data) {
                setReportData(res.data);
            } else {
                throw new Error(res?.message || 'فشل في تحميل بيانات التقرير');
            }
        } catch (err) {
            console.error('Error fetching reports data:', err);
            setError('تعذر تحميل بيانات التقارير من الخادم. يرجى المحاولة مرة أخرى.');
        } finally {
            setLoading(false);
        }
    }, [activeTab, selectedProject, selectedCenter, selectedHalaqa, selectedTeacher, selectedStudent, searchQuery, timeFilter, dateFrom, dateTo]);

    useEffect(() => {
        if (timeFilter !== 'custom') {
            fetchReportData();
        }
    }, [activeTab, selectedProject, selectedCenter, selectedHalaqa, selectedTeacher, selectedStudent, searchQuery, timeFilter]);

    const showToast = (msg, type = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setTimeout(() => setToastMessage(''), 4000);
    };

    const handleClearFilters = () => {
        setSelectedProject('all');
        setSelectedCenter('all');
        setSelectedHalaqa('all');
        setSelectedTeacher('all');
        setSelectedStudent('all');
        setSearchQuery('');
        setTimeFilter('this_month');
        setDateFrom('');
        setDateTo('');
        setDateRangeError('');
    };

    const hasActiveFilters = selectedProject !== 'all' || selectedCenter !== 'all' ||
        selectedHalaqa !== 'all' || selectedTeacher !== 'all' || selectedStudent !== 'all' ||
        searchQuery || timeFilter !== 'this_month';

    /* ─── Excel / CSV Export ────────────────────────────────────────────────── */
    const handleExportXLS = () => {
        if (!reportData || !reportData.items?.length) {
            showToast('لا توجد بيانات للتصدير', 'error');
            return;
        }
        setExportingXls(true);
        showToast('جاري تحضير ملف Excel (CSV)...');

        try {
            let csvContent = '\uFEFF';
            csvContent += `منصة مَنَارَة — تقرير ${activeTab}\n`;
            csvContent += `تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}\n\n`;

            const colsMap = {
                halaqat: ['اسم الحلقة', 'المعلم', 'عدد الطلاب', 'أيام الدوام', 'نسبة الحضور', 'الصفحات المسمعة', 'التقييم'],
                centers: ['اسم المركز', 'المدير', 'عدد الحلقات', 'عدد الطلاب', 'نسبة الحضور', 'الصفحات المسمعة', 'التقييم'],
                projects: ['اسم المشروع', 'الرمز', 'نوع المشروع', 'عدد الحلقات', 'عدد الطلاب', 'نسبة الإنجاز', 'الحالة'],
                teachers: ['المعلم', 'الحلقة', 'عدد الطلاب', 'أيام الدوام', 'نسبة الحضور', 'الصفحات المسمعة', 'التقييم'],
                students: ['اسم الطالب', 'الحلقة', 'نسبة الحضور', 'الصفحة الحالية', 'الصفحات المسمعة', 'التقييم'],
                pages: ['الطالب', 'نوع التسميع', 'رقم الصفحة', 'التقدير', 'التاريخ'],
                evaluation: ['مجال التقييم', 'الدرجة', 'التقدير', 'ملاحظات الأداء'],
            };

            const headers = colsMap[activeTab] || colsMap.halaqat;
            csvContent += headers.map(h => `"${h}"`).join(',') + '\n';

            reportData.items.forEach(item => {
                let row = [];
                switch (activeTab) {
                    case 'centers': row = [item.center_name, item.manager, item.halaqat_count, item.students_count, item.attendance_rate, item.pages_recited, item.rating]; break;
                    case 'projects': row = [item.project_name, item.code, item.type, item.halaqat_count, item.students_count, item.completion_rate, item.status]; break;
                    case 'teachers': row = [item.teacher_name, item.halaqa_name, item.students_count, item.sessions_count, item.attendance_rate, item.pages_recited, item.rating]; break;
                    case 'students': row = [item.student_name, item.halaqa_name, item.attendance_rate, item.reached_page, item.pages_recited, item.rating]; break;
                    case 'pages': row = [item.student_name, item.recitation_type, item.page_number, item.grade, item.date]; break;
                    case 'evaluation': row = [item.category, item.score, item.status, item.notes]; break;
                    default: row = [item.halaqa_name, item.teacher, item.students_count, item.sessions_count, item.attendance_rate, item.pages_recited, item.rating];
                }
                csvContent += row.map(val => `"${(val ?? '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `manara_report_${activeTab}_${timeFilter || 'period'}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setExportingXls(false);
            showToast('تم تصدير ملف Excel بنجاح ✓');
        } catch (err) {
            console.error('XLS export error:', err);
            setExportingXls(false);
            showToast('فشل تصدير Excel: ' + err.message, 'error');
        }
    };

    /* ─── PDF Export ───────────────────────────────────────────────────────── */
    const handleExportPDF = async () => {
        if (!reportData) {
            showToast('لا توجد بيانات للتصدير', 'error');
            return;
        }
        setExportingPdf(true);
        showToast('جاري تحضير ملف PDF...');

        try {
            const filterSummary = {
                'الفترة الزمنية': timeFilter,
                'المركز': selectedCenter !== 'all' ? selectedCenter : 'الكل',
                'المشروع': selectedProject !== 'all' ? selectedProject : 'الكل',
            };

            const statsSummary = {};
            if (reportData.stats) {
                const statsLabelMap = {
                    total_pages: 'إجمالي الصفحات',
                    avg_attendance: 'متوسط نسبة الحضور',
                    total_sessions: 'أيام الدوام المنفذة',
                    total_centers: 'عدد المراكز',
                    total_managers: 'عدد المدراء',
                    total_teachers: 'إجمالي المعلمين',
                    active_teachers: 'المعلمون النشطون',
                    total_students: 'إجمالي الطلاب',
                    avg_attendance_rate: 'متوسط نسبة الحضور',
                    total_pages_memorized: 'الصفحات المحفوظة',
                    overall_score: 'التقييم الكلي',
                    attendance_index: 'مؤشر الحضور',
                    memorization_index: 'مؤشر الحفظ',
                    discipline_index: 'مؤشر الانضباط',
                };
                Object.entries(reportData.stats).forEach(([k, v]) => {
                    if (typeof v !== 'object') {
                        statsSummary[statsLabelMap[k] || k] = v;
                    }
                });
            }

            const html = buildPdfHtml({
                title: 'منصة مَنَارَة — التقارير والإحصائيات',
                generatedBy: userDisplayName,
                filters: filterSummary,
                stats: statsSummary,
                items: reportData.items || [],
                tab: activeTab,
            });

            const printWindow = window.open('', '_blank', 'width=900,height=700');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    setExportingPdf(false);
                    showToast('تم تجهيز التقرير للطباعة ✓');
                }, 800);
            } else {
                throw new Error('تعذر فتح نافذة الطباعة');
            }
        } catch (err) {
            console.error('PDF export error:', err);
            setExportingPdf(false);
            showToast('فشل تصدير PDF: ' + err.message, 'error');
        }
    };

    const renderRatingBadge = (rating) => {
        let badgeClass = 'badge-gray';
        if (rating === 'ممتاز') badgeClass = 'badge-green';
        else if (rating === 'جيد جداً') badgeClass = 'badge-blue';
        else if (rating === 'جيد') badgeClass = 'badge-yellow';
        return <span className={`rating-badge ${badgeClass}`}>{rating}</span>;
    };

    const filterOptions = reportData?.filter_options || {
        centers: [], projects: [], halaqat: [], teachers: [], students: [], available_months: []
    };

    const monthsDropdownList = availableMonths.length > 0 ? availableMonths : (filterOptions.available_months || []);

    return (
        <div className="reports-page-container" dir="rtl">
            {/* Toast Notification */}
            {toastMessage && (
                <div className={`reports-toast ${toastType === 'error' ? 'reports-toast-error' : ''}`}>
                    {toastType === 'error'
                        ? <WarningCircle size={20} weight="fill" />
                        : <CheckCircle size={20} weight="fill" />
                    }
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Top Header Bar */}
            <header className="reports-top-header">
                <div className="user-greeting-box">
                    <h2 className="greeting-title">السلام عليكم، {userDisplayName}</h2>
                    <p className="date-subtitle">{formattedDateHeader}</p>
                </div>

                <div className="top-header-actions">
                    {/* Project Selector */}
                    <div className="header-select-wrapper">
                        <FolderStar size={18} className="select-icon" />
                        <select
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value)}
                            className="header-dropdown"
                        >
                            <option value="all">جميع المشاريع</option>
                            {filterOptions.projects?.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <CaretDown size={14} className="dropdown-arrow" />
                    </div>

                    {/* Center Selector */}
                    <div className="header-select-wrapper">
                        <MapPin size={18} className="select-icon" />
                        <select
                            value={selectedCenter}
                            onChange={(e) => setSelectedCenter(e.target.value)}
                            className="header-dropdown"
                        >
                            <option value="all">جميع المراكز</option>
                            {filterOptions.centers?.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <CaretDown size={14} className="dropdown-arrow" />
                    </div>

                    {/* Export Buttons */}
                    <button
                        className="export-report-btn export-xls-btn"
                        onClick={handleExportXLS}
                        disabled={exportingXls || !reportData || loading}
                        title="تصدير بيانات التقرير إلى ملف Excel (CSV)"
                    >
                        <FileXls size={18} weight="bold" />
                        <span>{exportingXls ? 'جاري التصدير...' : 'تصدير Excel'}</span>
                    </button>

                    <button
                        className={`export-report-btn ${exportingPdf ? 'exporting' : ''}`}
                        onClick={handleExportPDF}
                        disabled={exportingPdf || !reportData || loading}
                        title="تصدير التقرير الحالي إلى PDF"
                    >
                        <FilePdf size={18} weight="bold" />
                        <span>{exportingPdf ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                    </button>
                </div>
            </header>

            {/* Main Page Title */}
            <div className="page-title-row">
                <div className="title-with-icon">
                    <div className="chart-icon-badge">
                        <ChartBar size={28} weight="bold" />
                    </div>
                    <h1 className="reports-main-heading">التقارير والإحصائيات والتحليل الذكي</h1>
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <nav className="reports-tabs-bar">
                {[
                    { id: 'halaqat', label: 'تقارير الحلقات' },
                    ...(!isCenterManager ? [
                        { id: 'centers', label: 'تقارير المراكز' },
                        { id: 'projects', label: 'تقارير المشاريع' },
                    ] : []),
                    { id: 'teachers', label: 'تقارير المعلمين' },
                    { id: 'students', label: 'تقارير الطلاب' },
                    { id: 'pages', label: 'تقارير الصفحات' },
                    { id: 'evaluation', label: 'التقييم العام' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* ─── Advanced Filters Panel ─────────────────────────────────── */}
            <div className="advanced-filters-panel">
                <div className="filters-panel-header">
                    <button
                        className={`filters-toggle-btn ${showAdvancedFilters ? 'active' : ''}`}
                        onClick={() => setShowAdvancedFilters(prev => !prev)}
                    >
                        <Funnel size={16} weight={showAdvancedFilters ? 'fill' : 'regular'} />
                        <span>الفلاتر المتقدمة وضوابط الأشهر</span>
                        {hasActiveFilters && <span className="filter-active-dot"></span>}
                        <CaretDown size={14} className={`filter-caret ${showAdvancedFilters ? 'rotated' : ''}`} />
                    </button>

                    {hasActiveFilters && (
                        <button className="clear-filters-btn" onClick={handleClearFilters}>
                            <X size={14} />
                            <span>استعادة الافتراضي</span>
                        </button>
                    )}
                </div>

                {showAdvancedFilters && (
                    <div className="filters-grid">
                        {/* Time & Available Months Filter */}
                        <div className="filter-group">
                            <label className="filter-group-label">
                                <CalendarBlank size={14} /> الفترة الزمنية / شهر المسجد
                            </label>
                            <select
                                className="filter-select"
                                value={timeFilter}
                                onChange={(e) => { setTimeFilter(e.target.value); setDateRangeError(''); }}
                            >
                                <optgroup label="الفترات القياسية">
                                    {STANDARD_TIME_FILTERS.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </optgroup>
                                {monthsDropdownList.length > 0 && (
                                    <optgroup label="أشهر المسجد المتاحة فعلياً">
                                        {monthsDropdownList.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>

                        {/* Custom Date Range */}
                        {timeFilter === 'custom' && (
                            <>
                                <div className="filter-group">
                                    <label className="filter-group-label">من تاريخ</label>
                                    <input
                                        type="date"
                                        className="filter-input"
                                        value={dateFrom}
                                        onChange={(e) => { setDateFrom(e.target.value); setDateRangeError(''); }}
                                    />
                                </div>
                                <div className="filter-group">
                                    <label className="filter-group-label">إلى تاريخ</label>
                                    <input
                                        type="date"
                                        className="filter-input"
                                        value={dateTo}
                                        onChange={(e) => { setDateTo(e.target.value); setDateRangeError(''); }}
                                    />
                                </div>
                            </>
                        )}

                        {/* Center Filter */}
                        <div className="filter-group">
                            <label className="filter-group-label">
                                <Buildings size={14} /> المركز
                            </label>
                            <select
                                className="filter-select"
                                value={selectedCenter}
                                onChange={(e) => setSelectedCenter(e.target.value)}
                            >
                                <option value="all">جميع المراكز</option>
                                {filterOptions.centers?.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Project Filter */}
                        <div className="filter-group">
                            <label className="filter-group-label">
                                <Folder size={14} /> المشروع
                            </label>
                            <select
                                className="filter-select"
                                value={selectedProject}
                                onChange={(e) => setSelectedProject(e.target.value)}
                            >
                                <option value="all">جميع المشاريع</option>
                                {filterOptions.projects?.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Halaqa Filter */}
                        <div className="filter-group">
                            <label className="filter-group-label">الحلقة</label>
                            <select
                                className="filter-select"
                                value={selectedHalaqa}
                                onChange={(e) => setSelectedHalaqa(e.target.value)}
                            >
                                <option value="all">جميع الحلقات</option>
                                {filterOptions.halaqat?.map(h => (
                                    <option key={h.id} value={h.id}>{h.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Teacher Filter */}
                        <div className="filter-group">
                            <label className="filter-group-label">
                                <ChalkboardTeacher size={14} /> المعلم
                            </label>
                            <select
                                className="filter-select"
                                value={selectedTeacher}
                                onChange={(e) => setSelectedTeacher(e.target.value)}
                            >
                                <option value="all">جميع المعلمين</option>
                                {filterOptions.teachers?.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Student Filter */}
                        <div className="filter-group">
                            <label className="filter-group-label">الطالب</label>
                            <select
                                className="filter-select"
                                value={selectedStudent}
                                onChange={(e) => setSelectedStudent(e.target.value)}
                            >
                                <option value="all">جميع الطلاب</option>
                                {filterOptions.students?.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Search */}
                        <div className="filter-group filter-group-search">
                            <label className="filter-group-label">بحث نصي</label>
                            <div className="filter-search-wrapper">
                                <MagnifyingGlass size={14} className="filter-search-icon" />
                                <input
                                    type="text"
                                    className="filter-input filter-input-search"
                                    placeholder="بحث في الجدول..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Apply button for custom date range */}
                        {timeFilter === 'custom' && (
                            <div className="filter-group filter-apply-group">
                                <button className="apply-filters-btn" onClick={fetchReportData}>
                                    تطبيق الفلتر المخصص
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {dateRangeError && (
                    <div className="date-range-error">
                        <WarningCircle size={16} />
                        <span>{dateRangeError}</span>
                    </div>
                )}
            </div>

            {/* Loading Indicator */}
            {loading && (
                <div className="reports-loading-container">
                    <ArrowsClockwise size={32} className="spin-icon" />
                    <span>جاري جلب وحساب مؤشرات التقارير الحقيقية من الخادم...</span>
                </div>
            )}

            {/* Error Message */}
            {error && !loading && (
                <div className="reports-error-container">
                    <WarningCircle size={28} />
                    <span>{error}</span>
                    <button className="retry-btn" onClick={fetchReportData}>
                        <ArrowsClockwise size={14} /> إعادة المحاولة
                    </button>
                </div>
            )}

            {/* ─── Content Display Area ─────────────────────────────────── */}
            {!loading && !error && reportData && (
                <>
                    {/* STAT CARDS */}
                    <section className="stat-cards-grid">
                        {activeTab === 'centers' ? (
                            <>
                                <div className="stat-card">
                                    <div className="stat-card-border orange"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">عدد المراكز</p>
                                        <h3 className="stat-card-value">{reportData.stats?.total_centers?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border orange"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">عدد مدراء المراكز</p>
                                        <h3 className="stat-card-value">{reportData.stats?.total_managers?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                            </>
                        ) : activeTab === 'halaqat' ? (
                            <>
                                <div className="stat-card">
                                    <div className="stat-card-border orange"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">إجمالي الصفحات المسمعة</p>
                                        <h3 className="stat-card-value">{reportData.stats?.total_pages?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border blue"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">متوسط نسبة الحضور</p>
                                        <h3 className="stat-card-value">{reportData.stats?.avg_attendance || '0%'}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border green"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">أيام الدوام المنفذة</p>
                                        <h3 className="stat-card-value">{reportData.stats?.total_sessions?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                            </>
                        ) : activeTab === 'teachers' ? (
                            <>
                                <div className="stat-card">
                                    <div className="stat-card-border orange"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">إجمالي المعلمين</p>
                                        <h3 className="stat-card-value">{reportData.stats?.total_teachers?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border green"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">المعلمون النشطون</p>
                                        <h3 className="stat-card-value">{reportData.stats?.active_teachers?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                            </>
                        ) : activeTab === 'students' ? (
                            <>
                                <div className="stat-card">
                                    <div className="stat-card-border orange"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">إجمالي الطلاب</p>
                                        <h3 className="stat-card-value">{reportData.stats?.total_students?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border green"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">متوسط نسبة الحضور</p>
                                        <h3 className="stat-card-value">{reportData.stats?.avg_attendance_rate || '0%'}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border blue"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">إجمالي الصفحات المحفوظة</p>
                                        <h3 className="stat-card-value">{reportData.stats?.total_pages_memorized?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                            </>
                        ) : activeTab === 'pages' ? (
                            <>
                                <div className="stat-card">
                                    <div className="stat-card-border orange"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">إجمالي الصفحات المسمعة</p>
                                        <h3 className="stat-card-value">{reportData.stats?.total_pages?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border green"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">حفظ جديد</p>
                                        <h3 className="stat-card-value">{reportData.stats?.new_memorization?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border blue"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">مراجعة صغرى</p>
                                        <h3 className="stat-card-value">{reportData.stats?.minor_review?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border teal"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">مراجعة كبرى</p>
                                        <h3 className="stat-card-value">{reportData.stats?.major_review?.toLocaleString('ar-EG') ?? 0}</h3>
                                    </div>
                                </div>
                            </>
                        ) : activeTab === 'evaluation' ? (
                            <>
                                <div className="stat-card">
                                    <div className="stat-card-border orange"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">التقييم الكلي (Explainable Overall Score)</p>
                                        <h3 className="stat-card-value">{reportData.stats?.overall_score || '0%'}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border blue"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">مؤشر انضباط الحضور (40%)</p>
                                        <h3 className="stat-card-value">{reportData.stats?.attendance_index || '0%'}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border green"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">مؤشر جودة الحفظ (40%)</p>
                                        <h3 className="stat-card-value">{reportData.stats?.memorization_index || '0%'}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border teal"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">مؤشر السلوك والتفاعل (20%)</p>
                                        <h3 className="stat-card-value">{reportData.stats?.discipline_index || '0%'}</h3>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Projects stats */
                            <>
                                <div className="stat-card">
                                    <div className="stat-card-border orange"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">إجمالي المشاريع</p>
                                        <h3 className="stat-card-value">{reportData.stats?.total_projects ?? 0}</h3>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card-border green"></div>
                                    <div className="stat-card-body">
                                        <p className="stat-card-title">المشاريع النشطة</p>
                                        <h3 className="stat-card-value">{reportData.stats?.active_projects ?? 0}</h3>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>

                    {/* TOP STUDENTS SHOWCASE IN STUDENTS TAB */}
                    {activeTab === 'students' && reportData.stats?.top_students_list?.length > 0 && (
                        <section className="top-students-showcase">
                            <div className="showcase-header">
                                <Sparkle size={20} weight="fill" color="#2e7d32" />
                                <h3 className="showcase-title">الطلاب المتميزون (اضغط على الطالب لعرض سجل نشاطه المستقل)</h3>
                            </div>
                            <div className="top-students-tags">
                                {reportData.stats.top_students_list.map((st, idx) => (
                                    <button
                                        key={st.student_id || idx}
                                        className="student-tag-btn"
                                        onClick={() => navigate(`${basePath}/reports/student-activity/${st.student_id}`)}
                                        title="عرض صفحة نشاط الطالب"
                                    >
                                        <GraduationCap size={16} />
                                        <span className="st-name">{st.student_name}</span>
                                        <span className="st-halaqa">({st.halaqa_name})</span>
                                        <ArrowSquareOut size={13} />
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* CHART SECTION — Centers Bar Chart */}
                    {activeTab === 'centers' && (
                        <section className="chart-card-container">
                            <h3 className="chart-card-title">مقارنة أداء المراكز الفعلي</h3>
                            <div className="chart-legend-row">
                                <span className="legend-item"><span className="dot olive"></span>الحفظ</span>
                                <span className="legend-item"><span className="dot orange"></span>السلوك</span>
                                <span className="legend-item"><span className="dot teal"></span>التفاعل</span>
                                <span className="legend-item"><span className="dot darkgreen"></span>الحضور</span>
                            </div>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart
                                        data={reportData.chart?.data || []}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                                        <XAxis dataKey="name" stroke="#666" />
                                        <YAxis stroke="#666" domain={[0, 100]} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="hafiz" name="الحفظ" fill="#8bc34a" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="sulook" name="السلوك" fill="#ff7043" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="tafaul" name="التفاعل" fill="#26a69a" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="hudoor" name="الحضور" fill="#1b5e20" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    )}

                    {/* CHART SECTION — Halaqat Line Chart + AI insights */}
                    {activeTab === 'halaqat' && (
                        <section className="halaqat-grid-section">
                            <div className="chart-card-container flex-1">
                                <h3 className="chart-card-title">مؤشر كفاءة أداء الحلقات (Circle Performance Index - CPI)</h3>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={260}>
                                        <LineChart
                                            data={reportData.chart?.data || []}
                                            margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                                        >
                                            <CartesianGrid stroke="#e0e0e0" />
                                            <XAxis dataKey="name" stroke="#666" tick={{ fontSize: 12 }} />
                                            <YAxis stroke="#666" domain={[0, 100]} tick={{ fontSize: 12 }} />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="score" name="مؤشر الأداء CPI" stroke="#2e7d32" strokeWidth={3} dot={{ r: 5, fill: '#2e7d32' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="ai-insights-box">
                                <h3 className="ai-insights-title">
                                    <Sparkle size={18} weight="fill" />
                                    تحليل الذكاء الاصطناعي التفسيري
                                </h3>
                                <p className="ai-insights-text">
                                    {reportData.ai_analysis?.content || 'تم احتساب مؤشرات الكفاءة وفق الأوزان الرياضية المعتمدة.'}
                                </p>
                            </div>
                        </section>
                    )}

                    {/* MAIN TABLE */}
                    <section className="table-card-container">
                        <div className="table-header-row">
                            <h3 className="table-title">
                                {activeTab === 'centers' ? 'إنجازات المراكز التراكمية' :
                                 activeTab === 'projects' ? 'إنجازات المشاريع القرآنية' :
                                 activeTab === 'teachers' ? 'تقرير معلومات وإنجازات المعلمين' :
                                 activeTab === 'students' ? 'إنجازات وسجلات الطلاب' :
                                 activeTab === 'pages' ? 'سجل الصفحات المقروءة (الفرز الأحدث أولاً)' :
                                 activeTab === 'evaluation' ? 'معايير التقييم العام الموزون' :
                                 'إنجازات الحلقات وأيام الدوام'}
                            </h3>
                            <div className="table-actions">
                                <span className="records-count">
                                    {reportData.items?.length || 0} سجل
                                </span>
                            </div>
                        </div>

                        {/* Empty State */}
                        {(!reportData.items || reportData.items.length === 0) ? (
                            <div className="empty-state-container">
                                <ChartBar size={48} weight="thin" className="empty-state-icon" />
                                <p className="empty-state-text">لا توجد سجلات مطابقة لخيارات التصفية الحالية.</p>
                                {hasActiveFilters && (
                                    <button className="retry-btn" onClick={handleClearFilters}>
                                        مسح الفلاتر واستعادة الافتراضي
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="table-responsive-wrapper">
                                <table className="reports-data-table">
                                    <thead>
                                        {activeTab === 'centers' ? (
                                            <tr>
                                                <th>اسم المركز</th><th>مدير المركز</th>
                                                <th>عدد الحلقات</th><th>عدد الطلاب</th>
                                                <th>نسبة الحضور</th><th>الصفحات المسمعة</th>
                                                <th>التقييم</th>
                                            </tr>
                                        ) : activeTab === 'projects' ? (
                                            <tr>
                                                <th>اسم المشروع</th><th>الرمز</th>
                                                <th>نوع المشروع</th><th>عدد الحلقات</th>
                                                <th>عدد الطلاب</th><th>نسبة الإنجاز الفعلية</th>
                                                <th>الحالة</th>
                                            </tr>
                                        ) : activeTab === 'teachers' ? (
                                            <tr>
                                                <th>المعلم</th><th>الحلقة</th>
                                                <th>عدد الطلاب</th><th>أيام الدوام المنفذة</th>
                                                <th>نسبة الحضور</th><th>الصفحات المسمعة</th>
                                                <th>التقييم</th>
                                            </tr>
                                        ) : activeTab === 'students' ? (
                                            <tr>
                                                <th>اسم الطالب</th><th>الحلقة</th>
                                                <th>نسبة الحضور</th><th>الصفحة الحالية</th>
                                                <th>الصفحات المسمعة</th><th>التقييم</th>
                                                <th>سجل النشاط</th>
                                            </tr>
                                        ) : activeTab === 'pages' ? (
                                            <tr>
                                                <th>الطالب</th><th>نوع التسميع</th>
                                                <th>رقم الصفحة</th><th>التقدير</th>
                                                <th>التاريخ</th>
                                            </tr>
                                        ) : activeTab === 'evaluation' ? (
                                            <tr>
                                                <th>مجال التقييم</th><th>الدرجة الموزونة</th>
                                                <th>التقدير</th><th>ملاحظات الأداء والاحتساب</th>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <th>اسم الحلقة</th><th>المعلم</th>
                                                <th>عدد الطلاب</th><th>أيام الدوام المنفذة</th>
                                                <th>نسبة الحضور</th><th>الصفحات المسمعة</th>
                                                <th>التقييم</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody>
                                        {reportData.items.map((item, idx) => (
                                            <tr key={item.id || idx}>
                                                {activeTab === 'centers' ? (
                                                    <>
                                                        <td className="font-semibold">{item.center_name}</td>
                                                        <td>{item.manager}</td>
                                                        <td>{item.halaqat_count}</td>
                                                        <td>{item.students_count}</td>
                                                        <td>{item.attendance_rate}</td>
                                                        <td>{item.pages_recited?.toLocaleString?.('ar-EG') ?? item.pages_recited}</td>
                                                        <td>{renderRatingBadge(item.rating)}</td>
                                                    </>
                                                ) : activeTab === 'projects' ? (
                                                    <>
                                                        <td className="font-semibold">{item.project_name}</td>
                                                        <td>{item.code}</td>
                                                        <td>{item.type}</td>
                                                        <td>{item.halaqat_count}</td>
                                                        <td>{item.students_count}</td>
                                                        <td className="font-bold">{item.completion_rate}</td>
                                                        <td>
                                                            <span className={item.status === 'نشط' || item.status?.includes('متقدم') ? 'badge-green' : 'badge-yellow'}>
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                    </>
                                                ) : activeTab === 'teachers' ? (
                                                    <>
                                                        <td className="font-semibold">{item.teacher_name}</td>
                                                        <td>{item.halaqa_name}</td>
                                                        <td>{item.students_count}</td>
                                                        <td>{item.sessions_count}</td>
                                                        <td>{item.attendance_rate}</td>
                                                        <td>{item.pages_recited?.toLocaleString?.('ar-EG') ?? item.pages_recited}</td>
                                                        <td>{renderRatingBadge(item.rating)}</td>
                                                    </>
                                                ) : activeTab === 'students' ? (
                                                    <>
                                                        <td className="font-semibold">{item.student_name}</td>
                                                        <td>{item.halaqa_name}</td>
                                                        <td>{item.attendance_rate}</td>
                                                        <td>{item.reached_page}</td>
                                                        <td>{item.pages_recited?.toLocaleString?.('ar-EG') ?? item.pages_recited}</td>
                                                        <td>{renderRatingBadge(item.rating)}</td>
                                                        <td>
                                                            <button
                                                                className="student-activity-btn"
                                                                onClick={() => navigate(`${basePath}/reports/student-activity/${item.id}`)}
                                                                title="عرض سجل نشاط الطالب المستقل"
                                                            >
                                                                <Eye size={14} />
                                                                <span>عرض النشاط</span>
                                                            </button>
                                                        </td>
                                                    </>
                                                ) : activeTab === 'pages' ? (
                                                    <>
                                                        <td className="font-semibold">{item.student_name || '—'}</td>
                                                        <td>{item.recitation_type}</td>
                                                        <td className="font-bold">{item.page_number}</td>
                                                        <td>{renderRatingBadge(item.grade)}</td>
                                                        <td>{item.date}</td>
                                                    </>
                                                ) : activeTab === 'evaluation' ? (
                                                    <>
                                                        <td className="font-semibold">{item.category}</td>
                                                        <td className="font-bold">{item.score}</td>
                                                        <td>{renderRatingBadge(item.status)}</td>
                                                        <td>{item.notes}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="font-semibold">{item.halaqa_name}</td>
                                                        <td>{item.teacher}</td>
                                                        <td>{item.students_count}</td>
                                                        <td>{item.sessions_count}</td>
                                                        <td>{item.attendance_rate}</td>
                                                        <td>{item.pages_recited?.toLocaleString?.('ar-EG') ?? item.pages_recited}</td>
                                                        <td>{renderRatingBadge(item.rating)}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default AdminReports;
