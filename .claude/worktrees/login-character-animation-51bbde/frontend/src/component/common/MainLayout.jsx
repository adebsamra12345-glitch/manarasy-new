import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';

// Sidebars
import TenantAdminSidebar from '../sideBar/TenantAdminSidebar';
import SuperAdminSidebar from '../sideBar/SuperAdminSidebar';
import TeacherSidebar from '../sideBar/TeacherSidebar';
import ParentSidebar from '../sideBar/ParentSidebar';

// Navbar
import { MobileTopbar, MobileNavbar } from '../navbar/Navbar';

/**
 * MainLayout — الهيكل الرئيسي للتطبيق
 * يختار القائمة الجانبية تلقائياً حسب دور المستخدم المسجّل
 */
const ROLE_SIDEBAR_MAP = {
    super_admin: SuperAdminSidebar,
    tenant_admin: TenantAdminSidebar,
    teacher: TeacherSidebar,
    parent: ParentSidebar,
};

const MainLayout = () => {
    const { role } = useAuthContext();
    const normalizedRole = role ? role.toLowerCase() : '';

    // اختيار السايدبار المناسب، الافتراضي: TenantAdminSidebar
    const SidebarComponent = ROLE_SIDEBAR_MAP[normalizedRole] || TenantAdminSidebar;

    return (
        <div className="app-container">
            {/* القائمة الجانبية — تُخفى على الهاتف */}
            <SidebarComponent />

            {/* المحتوى الرئيسي */}
            <main className="main-content">
                <MobileTopbar />
                <Outlet />
            </main>

            {/* شريط التنقل السفلي — يُخفى على الحاسوب */}
            <MobileNavbar />
        </div>
    );
};

export default MainLayout;
