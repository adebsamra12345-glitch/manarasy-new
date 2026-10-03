/**
 * roleUtils.js
 * أدوات ومساعدات التعامل مع أدوار المستخدمين وتحويلها للأسماء العربية والمسارات الافتراضية
 */

export const ROLE_DISPLAY_NAMES = {
    TENANT_ADMIN: 'مدير المنشأة',
    tenant_admin: 'مدير المنشأة',
    SUPER_ADMIN: 'مدير النظام العام',
    super_admin: 'مدير النظام العام',
    CENTER_MANAGER: 'مدير مركز',
    center_manager: 'مدير مركز',
    TEACHER: 'معلم',
    teacher: 'معلم',
    STUDENT: 'طالب',
    student: 'طالب',
};

export const ROLE_DEFAULT_ROUTES = {
    TENANT_ADMIN: '/admin/dashboard',
    tenant_admin: '/admin/dashboard',
    SUPER_ADMIN: '/super/dashboard',
    super_admin: '/super/dashboard',
    CENTER_MANAGER: '/center-manager/dashboard',
    center_manager: '/center-manager/dashboard',
    TEACHER: '/teacher/dashboard',
    teacher: '/teacher/dashboard',
    STUDENT: '/student/dashboard',
    student: '/student/dashboard',
    parent: '/student/dashboard',
};

export const getRoleDisplayName = (roleCode) => {
    if (!roleCode) return 'مستخدم';
    const key = String(roleCode).trim();
    return ROLE_DISPLAY_NAMES[key] || ROLE_DISPLAY_NAMES[key.toUpperCase()] || roleCode;
};

export const getRoleDefaultRoute = (roleCode) => {
    if (!roleCode) return '/login';
    const key = String(roleCode).trim();
    return ROLE_DEFAULT_ROUTES[key] || ROLE_DEFAULT_ROUTES[key.toLowerCase()] || '/login';
};

export const getRoleProfileRoute = (roleCode) => {
    if (!roleCode) return '/login';
    const key = String(roleCode).trim().toUpperCase();
    const map = {
        'SUPER_ADMIN': '/super/profile',
        'TENANT_ADMIN': '/admin/profile',
        'CENTER_MANAGER': '/center-manager/profile',
        'TEACHER': '/teacher/profile',
        'STUDENT': '/student/profile'
    };
    return map[key] || '/admin/profile';
};

