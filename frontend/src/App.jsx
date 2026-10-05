import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ===== Layout & Common =====
import MainLayout from './component/common/MainLayout';

// ===== Context Providers =====
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { NotificationProvider } from './context/NotificationContext';
import { PlatformAuthProvider, PlatformRoute } from './context/PlatformAuthContext';

// ===== Desktop — Auth =====
import DesktopLogin from './pages/desktop/auth/DesktopLogin';
import DesktopRegisterTenant from './pages/desktop/auth/DesktopRegisterTenant';

// ===== Platform Admin (منفصل تماماً عن مصادقة المساجد) — تحميل كسول لتقليل حجم الحزمة الأولية =====
const PlatformLogin = lazy(() => import('./pages/platform/PlatformLogin'));
const PlatformLayout = lazy(() => import('./pages/platform/PlatformLayout'));
const RegistrationRequests = lazy(() => import('./pages/platform/RegistrationRequests'));
const MosquesPage = lazy(() => import('./pages/platform/MosquesPage'));

// ===== Desktop — Tenant Admin =====
import TenantDashboard from './pages/desktop/tenantAdmin/TenantDashboard';
import HalqaManagement from './pages/desktop/tenantAdmin/HalqaManagement';
import TeacherAssignment from './pages/desktop/tenantAdmin/TeacherAssignment';
import UsersManagement from './pages/desktop/tenantAdmin/UsersManagement';
import UserDetail from './pages/desktop/tenantAdmin/UserDetail';
import CentersAndProjects from './pages/desktop/tenantAdmin/CentersAndProjects';
import CentersManagement from './pages/desktop/tenantAdmin/CentersManagement';
import StudentsManagement from './pages/desktop/tenantAdmin/StudentsManagement';
import AdminSessions from './pages/desktop/tenantAdmin/AdminSessions';
import AdminRingSessions from './pages/desktop/tenantAdmin/AdminRingSessions';
import AdminSessionDetail from './pages/desktop/tenantAdmin/AdminSessionDetail';
import AdminReports from './pages/desktop/tenantAdmin/AdminReports';
import StudentActivityPage from './pages/desktop/tenantAdmin/StudentActivityPage';
import AdminSettings from './pages/desktop/tenantAdmin/AdminSettings';
import PointsAndRewards from './pages/desktop/tenantAdmin/PointsAndRewards';
import StudentCompetitions from './pages/mobile/student/StudentCompetitions';



// ===== Desktop — Teacher =====
import TeacherDashboard from './pages/desktop/teacher/TeacherDashboard';
import TeacherRings from './pages/desktop/teacher/TeacherRings';
import TeacherSessions from './pages/desktop/teacher/TeacherSessions';
import TeacherSessionDetail from './pages/desktop/teacher/TeacherSessionDetail';
import TeacherStudents from './pages/desktop/teacher/TeacherStudents';
import DesktopAttendance from './pages/desktop/teacher/DesktopAttendance';
import StudentProgressTracker from './pages/desktop/teacher/StudentProgressTracker';
import DesktopRecitationEvaluation from './pages/desktop/teacher/DesktopRecitationEvaluation';

// ===== Desktop — Student =====
import StudentDashboard from './pages/desktop/student/StudentDashboard';
import StudentReportCard from './pages/desktop/student/StudentReportCard';
import StudentNotifications from './pages/desktop/student/StudentNotifications';

// ===== Placeholder =====
import PlaceholderView from './pages/PlaceholderView';

// ===== Common =====
import ProfilePage from './pages/common/ProfilePage';

// ===== Global CSS =====
import './pages/css/global.css';
import './index.css';

// ─────────────────────────────────────────────
// الصفحة الرئيسية الافتراضية حسب دور المستخدم
// ─────────────────────────────────────────────
const ROLE_DEFAULT_ROUTE = {
    super_admin: '/platform',
    tenant_admin: '/admin/dashboard',
    center_manager: '/center-manager/dashboard',
    teacher: '/teacher/dashboard',
    student: '/student/dashboard',
};

// ─────────────────────────────────────────────
// Guard: يحمي المسارات التي تحتاج تسجيل دخول
// ─────────────────────────────────────────────
const PrivateRoute = ({ children, allowedRoles }) => {
    const { isLoggedIn, role } = useAuthContext();

    if (!isLoggedIn) return <Navigate to="/login" replace />;

    const normalizedRole = role ? role.toLowerCase() : '';

    if (allowedRoles && !allowedRoles.map(r => r.toLowerCase()).includes(normalizedRole)) {
        // إعادة توجيه للصفحة الرئيسية المناسبة لدوره
        const defaultRoute = ROLE_DEFAULT_ROUTE[normalizedRole] || '/login';
        return <Navigate to={defaultRoute} replace />;
    }
    return children;
};

// ─────────────────────────────────────────────
// التوجيه الذكي بعد تسجيل الدخول
// ─────────────────────────────────────────────
const RoleBasedRedirect = () => {
    const { isLoggedIn, role } = useAuthContext();
    if (!isLoggedIn) return <Navigate to="/login" replace />;

    const normalizedRole = role ? role.toLowerCase() : '';
    const route = ROLE_DEFAULT_ROUTE[normalizedRole] || '/login';
    return <Navigate to={route} replace />;
};

function App() {
    return (
        <AuthProvider>
            <PlatformAuthProvider>
            <TenantProvider>
                <NotificationProvider>
                    <BrowserRouter>
                        <Routes>
                            {/* ===== Auth Routes ===== */}
                            <Route path="/login" element={<DesktopLogin />} />
                            <Route path="/register" element={<DesktopRegisterTenant />} />

                            {/* ===== Root redirect ===== */}
                            <Route path="/" element={<RoleBasedRedirect />} />
                            <Route path="/dashboard" element={<RoleBasedRedirect />} />

                            {/* ===================================================
                                PLATFORM ADMIN — /platform/*  (توثيق ومفاتيح JWT منفصلة عن المساجد)
                                /super/* قديم ⇒ يُحوَّل إلى /platform
                            =================================================== */}
                            <Route path="/super/*" element={<Navigate to="/platform" replace />} />
                            <Route path="/platform/login" element={<Suspense fallback={null}><PlatformLogin /></Suspense>} />
                            <Route
                                path="/platform"
                                element={
                                    <PlatformRoute>
                                        <Suspense fallback={null}><PlatformLayout /></Suspense>
                                    </PlatformRoute>
                                }
                            >
                                <Route index element={<Navigate to="requests" replace />} />
                                <Route path="requests" element={<Suspense fallback={null}><RegistrationRequests /></Suspense>} />
                                <Route path="mosques" element={<Suspense fallback={null}><MosquesPage /></Suspense>} />
                            </Route>

                            {/* ===================================================
                                TENANT ADMIN — /admin/*
                            =================================================== */}
                            <Route
                                path="/admin"
                                element={
                                    <PrivateRoute allowedRoles={['tenant_admin']}>
                                        <MainLayout />
                                    </PrivateRoute>
                                }
                            >
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<TenantDashboard />} />
                                <Route path="users" element={<UsersManagement />} />
                                <Route path="users/:id" element={<UserDetail />} />
                                <Route path="projects" element={<CentersAndProjects />} />
                                <Route path="students" element={<StudentsManagement />} />
                                <Route path="teachers" element={<TeacherAssignment />} />
                                <Route path="rings" element={<HalqaManagement />} />
                                <Route path="rings/:ringId/sessions" element={<AdminRingSessions />} />
                                <Route path="rings/:ringId/sessions/:sessionId" element={<AdminSessionDetail />} />
                                <Route path="centers" element={<CentersManagement />} />
                                <Route path="sessions" element={<AdminSessions />} />
                                <Route path="rewards" element={<PointsAndRewards />} />
                                <Route path="reports" element={<AdminReports />} />
                                <Route path="reports/student-activity/:studentId" element={<StudentActivityPage />} />
                                <Route path="students/:studentId/activity" element={<StudentActivityPage />} />
                                <Route path="settings" element={<AdminSettings />} />
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>

                            {/* ===================================================
                                CENTER MANAGER — /center-manager/*
                            =================================================== */}
                            <Route
                                path="/center-manager"
                                element={
                                    <PrivateRoute allowedRoles={['center_manager']}>
                                        <MainLayout />
                                    </PrivateRoute>
                                }
                            >
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<TenantDashboard />} />
                                <Route path="students" element={<StudentsManagement />} />
                                <Route path="teachers" element={<TeacherAssignment />} />
                                <Route path="rings" element={<HalqaManagement />} />
                                <Route path="rings/:ringId/sessions" element={<AdminRingSessions />} />
                                <Route path="rings/:ringId/sessions/:sessionId" element={<AdminSessionDetail />} />
                                <Route path="sessions" element={<AdminSessions />} />
                                <Route path="rewards" element={<PointsAndRewards />} />
                                <Route path="reports" element={<AdminReports />} />
                                <Route path="reports/student-activity/:studentId" element={<StudentActivityPage />} />
                                <Route path="students/:studentId/activity" element={<StudentActivityPage />} />
                                <Route path="settings" element={<Navigate to="/center-manager/dashboard" replace />} />
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>

                            {/* ===================================================
                                TEACHER — /teacher/*
                            =================================================== */}
                            <Route
                                path="/teacher"
                                element={
                                    <PrivateRoute allowedRoles={['teacher']}>
                                        <MainLayout />
                                    </PrivateRoute>
                                }
                            >
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<TeacherDashboard />} />
                                <Route path="rings" element={<TeacherRings />} />
                                <Route path="rings/:ringId/sessions" element={<TeacherSessions />} />
                                <Route path="rings/:ringId/sessions/:sessionId" element={<TeacherSessionDetail />} />
                                <Route path="sessions" element={<AdminSessions />} />
                                <Route path="students" element={<TeacherStudents />} />
                                <Route path="students/:studentId/activity" element={<StudentActivityPage />} />
                                <Route path="reports/student-activity/:studentId" element={<StudentActivityPage />} />
                                <Route path="attendance" element={<DesktopAttendance />} />
                                <Route path="recitation" element={<DesktopRecitationEvaluation />} />
                                <Route path="progress" element={<StudentProgressTracker />} />
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>

                            {/* ===================================================
                                STUDENT DIRECT — /student/*
                            =================================================== */}
                            <Route
                                path="/student"
                                element={
                                    <PrivateRoute allowedRoles={['student']}>
                                        <MainLayout />
                                    </PrivateRoute>
                                }
                            >
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<StudentDashboard />} />
                                <Route path="competitions" element={<StudentCompetitions />} />
                                <Route path="report" element={<StudentReportCard />} />
                                <Route path="notifications" element={<StudentNotifications />} />
                                <Route path="profile" element={<ProfilePage />} />
                            </Route>

                            {/* أي مسار غير معروف */}
                            <Route path="*" element={<RoleBasedRedirect />} />
                        </Routes>
                    </BrowserRouter>
                </NotificationProvider>
            </TenantProvider>
            </PlatformAuthProvider>
        </AuthProvider>
    );
}

export default App;
