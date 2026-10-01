import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ===== Layout & Common =====
import MainLayout from './component/common/MainLayout';

// ===== Context Providers =====
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { NotificationProvider } from './context/NotificationContext';

// ===== Desktop — Auth =====
import DesktopLogin from './pages/desktop/auth/DesktopLogin';
import DesktopRegisterTenant from './pages/desktop/auth/DesktopRegisterTenant';

// ===== Desktop — Super Admin =====
import SuperAdminDashboard from './pages/desktop/superAdmin/SuperAdminDashboard';
import TenantManagement from './pages/desktop/superAdmin/TenantManagement';

// ===== Desktop — Tenant Admin =====
import TenantDashboard from './pages/desktop/tenantAdmin/TenantDashboard';
import HalqaManagement from './pages/desktop/tenantAdmin/HalqaManagement';
import TeacherAssignment from './pages/desktop/tenantAdmin/TeacherAssignment';

// ===== Desktop — Teacher =====
import TeacherDashboard from './pages/desktop/teacher/TeacherDashboard';
import TeacherRings from './pages/desktop/teacher/TeacherRings';
import TeacherSessions from './pages/desktop/teacher/TeacherSessions';
import TeacherSessionDetail from './pages/desktop/teacher/TeacherSessionDetail';
import TeacherStudents from './pages/desktop/teacher/TeacherStudents';
import DesktopAttendance from './pages/desktop/teacher/DesktopAttendance';
import StudentProgressTracker from './pages/desktop/teacher/StudentProgressTracker';
import DesktopRecitationEvaluation from './pages/desktop/teacher/DesktopRecitationEvaluation';

// ===== Desktop — Parent =====
import ParentDashboard from './pages/desktop/parent/ParentDashboard';
import StudentReportCard from './pages/desktop/parent/StudentReportCard';
import QuranMemorizationPlan from './pages/desktop/parent/QuranMemorizationPlan';

// ===== Placeholder =====
import PlaceholderView from './pages/PlaceholderView';

// ===== Global CSS =====
import './pages/css/global.css';
import './index.css';

// ─────────────────────────────────────────────
// الصفحة الرئيسية الافتراضية حسب دور المستخدم
// ─────────────────────────────────────────────
const ROLE_DEFAULT_ROUTE = {
    super_admin: '/super/dashboard',
    tenant_admin: '/admin/dashboard',
    teacher: '/teacher/dashboard',
    parent: '/parent/dashboard',
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
                                SUPER ADMIN — /super/*
                            =================================================== */}
                            <Route
                                path="/super"
                                element={
                                    <PrivateRoute allowedRoles={['super_admin']}>
                                        <MainLayout />
                                    </PrivateRoute>
                                }
                            >
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<SuperAdminDashboard />} />
                                <Route path="tenants" element={<TenantManagement />} />
                                <Route path="invoices" element={<PlaceholderView title="الاشتراكات والفواتير" />} />
                                <Route path="health" element={<PlaceholderView title="صحة النظام" />} />
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
                                <Route path="projects" element={<PlaceholderView title="المشاريع" />} />
                                <Route path="centers" element={<PlaceholderView title="المراكز" />} />
                                <Route path="rings" element={<HalqaManagement />} />
                                <Route path="teachers" element={<TeacherAssignment />} />
                                <Route path="students" element={<PlaceholderView title="الطلاب" />} />
                                <Route path="reports" element={<PlaceholderView title="التقارير" />} />
                                <Route path="rewards" element={<PlaceholderView title="النقاط والمكافآت" />} />
                                <Route path="settings" element={<PlaceholderView title="الإعدادات" />} />
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
                                <Route path="students" element={<TeacherStudents />} />
                                <Route path="attendance" element={<DesktopAttendance />} />
                                <Route path="recitation" element={<DesktopRecitationEvaluation />} />
                                <Route path="progress" element={<StudentProgressTracker />} />
                            </Route>

                            {/* ===================================================
                                PARENT — /parent/*
                            =================================================== */}
                            <Route
                                path="/parent"
                                element={
                                    <PrivateRoute allowedRoles={['parent']}>
                                        <MainLayout />
                                    </PrivateRoute>
                                }
                            >
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard" element={<ParentDashboard />} />
                                <Route path="report" element={<StudentReportCard />} />
                                <Route path="plan" element={<QuranMemorizationPlan />} />
                                <Route path="notifications" element={<PlaceholderView title="الإشعارات" />} />
                            </Route>

                            {/* أي مسار غير معروف */}
                            <Route path="*" element={<RoleBasedRedirect />} />
                        </Routes>
                    </BrowserRouter>
                </NotificationProvider>
            </TenantProvider>
        </AuthProvider>
    );
}

export default App;
