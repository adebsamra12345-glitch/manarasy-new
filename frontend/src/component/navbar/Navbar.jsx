import { useState, useEffect } from 'react';
import { 
    House, Books, Users, CalendarBlank, User, Bell, SignOut, X, Check, CircleNotch,
    FolderStar, GraduationCap, ChalkboardTeacher, MapPin, Medal, ChartBar, Gear, DotsThree
} from '@phosphor-icons/react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import './navbar.css';

import { useAuthContext } from '../../context/AuthContext';
import { getRoleDisplayName, getRoleDefaultRoute } from '../../utils/roleUtils';
import UserAvatar from '../common/UserAvatar';
import BrandLogo from '../common/BrandLogo';

export const MobileTopbar = () => {
    const { user, role, roles, logout, switchRole } = useAuthContext();
    const navigate = useNavigate();
    const [showMenu, setShowMenu] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);

    const displayName = user?.first_name 
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.username || localStorage.getItem('username') || 'المستخدم';

    const activeRole = role || 'STUDENT';
    const userRoles = Array.isArray(roles) && roles.length > 0 ? roles : [activeRole];
    const hasMultipleRoles = userRoles.length > 1;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleRoleSelect = async (targetRole) => {
        if (targetRole.toUpperCase() === activeRole.toUpperCase() || isSwitching) {
            return;
        }
        try {
            setIsSwitching(true);
            await switchRole(targetRole);
            setShowMenu(false);
            const targetRoute = getRoleDefaultRoute(targetRole);
            navigate(targetRoute, { replace: true });
        } catch (error) {
            console.error("فشل تبديل الدور على الموبايل:", error);
        } finally {
            setIsSwitching(false);
        }
    };

    return (
        <>
            <header id="mobile-topbar-container" className="mobile-topbar hide-on-desktop">
                <div className="mobile-topbar-left">
                    <div 
                        id="btn-mobile-user-profile"
                        className="icon-btn" 
                        onClick={() => setShowMenu(prev => !prev)}
                        style={{ cursor: 'pointer' }}
                        title="الملف الشخصي"
                    >
                        <User size={20} />
                    </div>
                    <div className="icon-btn">
                        <Bell size={20} />
                        <span className="badge"></span>
                    </div>
                </div>
                <div className="mobile-topbar-right" onClick={() => setShowMenu(prev => !prev)} style={{ cursor: 'pointer' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-green)' }}>مَنَارَة</h2>
                    <BrandLogo size={30} />
                </div>
            </header>

            {/* Mobile User Dropdown Modal */}
            {showMenu && (
                <>
                    <div 
                        onClick={() => setShowMenu(false)} 
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9998, backdropFilter: 'blur(2px)' }} 
                    />
                    <div style={{
                        position: 'fixed', top: '4rem', right: '1rem', left: '1rem',
                        background: '#fff', borderRadius: '16px', padding: '1.2rem',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 9999,
                        direction: 'rtl', animation: 'fadeInDown 0.2s ease', border: '1px solid #eee'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <UserAvatar name={displayName} size={40} background="#133315" />
                                <div>
                                    <div style={{ fontWeight: '700', fontSize: '1rem', color: '#133315' }}>{displayName}</div>
                                    <div style={{ fontSize: '0.82rem', color: '#666', fontWeight: 500 }}>
                                        {getRoleDisplayName(activeRole)}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowMenu(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* قسم تبديل الأدوار في حال تعدد الأدوار */}
                        {hasMultipleRoles && (
                            <div style={{ marginBottom: '1.2rem', borderBottom: '1px solid #f0f0f0', paddingBottom: '1rem' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#133315', marginBottom: '0.6rem' }}>
                                    تبديل الدور النشط:
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {userRoles.map((r) => {
                                        const isActive = r.toUpperCase() === activeRole.toUpperCase();
                                        return (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => handleRoleSelect(r)}
                                                disabled={isSwitching}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justify: 'space-between',
                                                    padding: '0.65rem 0.85rem',
                                                    borderRadius: '10px',
                                                    border: isActive ? '2px solid #133315' : '1px solid #e0e0e0',
                                                    background: isActive ? '#f0f7f1' : '#f9f9f9',
                                                    color: isActive ? '#133315' : '#444',
                                                    fontWeight: isActive ? '700' : '500',
                                                    fontSize: '0.88rem',
                                                    cursor: 'pointer',
                                                    fontFamily: 'inherit',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <span>{getRoleDisplayName(r)}</span>
                                                {isActive && (
                                                    isSwitching ? <CircleNotch size={18} className="spin-icon" color="#133315" /> : <Check size={18} color="#133315" weight="bold" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <button
                            id="btn-mobile-profile"
                            onClick={() => {
                                setShowMenu(false);
                                const basePath = getRoleDefaultRoute(activeRole).split('/')[1];
                                navigate(`/${basePath}/profile`);
                            }}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.6rem',
                                padding: '0.75rem',
                                background: '#f5f5f5',
                                border: '1px solid #ddd',
                                borderRadius: '10px',
                                color: '#333',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                marginBottom: '0.5rem',
                                transition: 'background 0.2s'
                            }}
                        >
                            <User size={20} />
                            الملف الشخصي
                        </button>
                        <button
                            id="btn-mobile-logout"
                            onClick={handleLogout}
                            style={{
                                width: '100%', padding: '0.75rem', borderRadius: '10px',
                                border: '1.5px solid #c62828', background: '#ffebee', color: '#c62828',
                                fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                fontFamily: 'inherit'
                            }}
                        >
                            <SignOut size={20} weight="bold" />
                            تسجيل الخروج
                        </button>
                    </div>
                </>
            )}
        </>
    );
};

export const MobileNavbar = () => {
    const { role } = useAuthContext();
    const location = useLocation();
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const normalizedRole = role ? role.toLowerCase() : '';

    // إغلاق قائمة المزيد تلقائياً عند الانتقال إلى مسار جديد
    useEffect(() => {
        setIsMoreOpen(false);
    }, [location.pathname]);

    // إغلاق قائمة المزيد عند الضغط على مفتاح Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsMoreOpen(false);
            }
        };
        if (isMoreOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMoreOpen]);

    // تبويبات متطابقة تماماً مع Desktop Sidebar لكل دور
    let allTabs = [];

    if (normalizedRole === 'tenant_admin') {
        allTabs = [
            { to: '/admin/dashboard', label: 'الرئيسية', icon: House, end: true },
            { to: '/admin/rings', label: 'الحلقات', icon: Books },
            { to: '/admin/students', label: 'الطلاب', icon: GraduationCap },
            { to: '/admin/teachers', label: 'المعلمون', icon: ChalkboardTeacher },
            { to: '/admin/users', label: 'المستخدمون', icon: Users },
            { to: '/admin/projects', label: 'المشاريع', icon: FolderStar },
            { to: '/admin/centers', label: 'المراكز', icon: MapPin },
            { to: '/admin/sessions', label: 'الجلسات', icon: CalendarBlank },
            { to: '/admin/rewards', label: 'النقاط والمكافآت', icon: Medal },
            { to: '/admin/reports', label: 'التقارير', icon: ChartBar },
            { to: '/admin/settings', label: 'الإعدادات', icon: Gear },
            { to: '/admin/profile', label: 'الملف الشخصي', icon: User },
        ];
    } else if (normalizedRole === 'center_manager') {
        // تم استبعاد الإعدادات نهائياً لمدير المركز في الواجهتين
        allTabs = [
            { to: '/center-manager/dashboard', label: 'الرئيسية', icon: House, end: true },
            { to: '/center-manager/rings', label: 'الحلقات', icon: Books },
            { to: '/center-manager/students', label: 'الطلاب', icon: GraduationCap },
            { to: '/center-manager/teachers', label: 'المعلمون', icon: ChalkboardTeacher },
            { to: '/center-manager/sessions', label: 'الجلسات', icon: CalendarBlank },
            { to: '/center-manager/rewards', label: 'النقاط والمكافآت', icon: Medal },
            { to: '/center-manager/reports', label: 'التقارير', icon: ChartBar },
            { to: '/center-manager/profile', label: 'الملف الشخصي', icon: User },
        ];
    } else if (normalizedRole === 'teacher') {
        allTabs = [
            { to: '/teacher/dashboard', label: 'الرئيسية', icon: House, end: true },
            { to: '/teacher/rings', label: 'الحلقات', icon: Books },
            { to: '/teacher/students', label: 'الطلاب', icon: Users },
            { to: '/teacher/profile', label: 'الملف الشخصي', icon: User },
        ];
    } else if (normalizedRole === 'parent' || normalizedRole === 'student') {
        allTabs = [
            { to: '/student/dashboard', label: 'الرئيسية', icon: House, end: true },
            { to: '/student/report', label: 'المتابعة', icon: Books },
            { to: '/student/competitions', label: 'المسابقات', icon: CalendarBlank },
            { to: '/student/notifications', label: 'الإشعارات', icon: Bell },
            { to: '/student/profile', label: 'الملف الشخصي', icon: User },
        ];
    } else if (normalizedRole === 'super_admin') {
        allTabs = [
            { to: '/super/dashboard', label: 'الرئيسية', icon: House, end: true },
            { to: '/super/tenants', label: 'المساجد', icon: Books },
            { to: '/super/invoices', label: 'الاشتراكات والفواتير', icon: CalendarBlank },
            { to: '/super/health', label: 'صحة النظام', icon: ChartBar },
            { to: '/super/profile', label: 'الملف الشخصي', icon: User },
        ];
    } else {
        allTabs = [
            { to: '/admin/dashboard', label: 'الرئيسية', icon: House, end: true },
            { to: '/admin/rings', label: 'الحلقات', icon: Books },
            { to: '/admin/students', label: 'الطلاب', icon: GraduationCap },
            { to: '/admin/users', label: 'المستخدمون', icon: Users },
        ];
    }

    const MAX_PRIMARY_ITEMS = 4;
    const hasMore = allTabs.length > (MAX_PRIMARY_ITEMS + 1);
    const primaryItems = hasMore ? allTabs.slice(0, MAX_PRIMARY_ITEMS) : allTabs;
    const moreItems = hasMore ? allTabs.slice(MAX_PRIMARY_ITEMS) : [];

    // التحقق من تفعيل التبويب
    const isTabActive = (item) => {
        if (item.end) {
            return location.pathname === item.to;
        }
        return location.pathname.startsWith(item.to);
    };

    // التحقق مما إذا كان المسار الحالي ينتمي إلى أحد تبويبات قائمة "المزيد"
    const isMoreActive = moreItems.some(item => isTabActive(item));

    return (
        <>
            {/* القائمة المنبثقة العمودية للتبويبات الإضافية (Vertical More Menu) */}
            {isMoreOpen && (
                <>
                    <div 
                        className="mobile-more-backdrop" 
                        onClick={() => setIsMoreOpen(false)} 
                        aria-hidden="true"
                    />
                    <div 
                        id="mobile-more-menu" 
                        className="mobile-more-dropdown" 
                        role="menu"
                        aria-label="قائمة التبويبات الإضافية"
                    >
                        <div className="mobile-more-header">
                            <span>التبويبات الإضافية</span>
                            <button 
                                type="button" 
                                className="mobile-more-close-btn"
                                onClick={() => setIsMoreOpen(false)} 
                                aria-label="إغلاق قائمة المزيد"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="mobile-more-list">
                            {moreItems.map((item, idx) => {
                                const IconComp = item.icon;
                                const active = isTabActive(item);
                                return (
                                    <NavLink
                                        key={idx}
                                        to={item.to}
                                        role="menuitem"
                                        onClick={() => setIsMoreOpen(false)}
                                        className={`mobile-more-item ${active ? 'active' : ''}`}
                                    >
                                        <IconComp size={20} weight={active ? 'fill' : 'regular'} />
                                        <span>{item.label}</span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* شريط التنقل السفلي الثابت (Bottom Navigation) */}
            <nav id="mobile-navbar-container" className="mobile-navbar hide-on-desktop">
                {primaryItems.map((item, idx) => {
                    const IconComp = item.icon;
                    const active = isTabActive(item);
                    return (
                        <NavLink
                            key={idx}
                            to={item.to}
                            className={`mobile-nav-item ${active ? 'active' : ''}`}
                        >
                            <IconComp size={22} weight={active ? 'fill' : 'regular'} />
                            <span>{item.label}</span>
                        </NavLink>
                    );
                })}

                {/* زر "المزيد" الثابت في أقصى اليسار إذا كانت هناك تبويبات إضافية */}
                {hasMore && (
                    <button
                        id="btn-mobile-nav-more"
                        type="button"
                        onClick={() => setIsMoreOpen(prev => !prev)}
                        className={`mobile-nav-item ${isMoreActive || isMoreOpen ? 'active' : ''}`}
                        aria-expanded={isMoreOpen}
                        aria-haspopup="true"
                        aria-label="المزيد من التبويبات"
                    >
                        <DotsThree size={24} weight={isMoreActive || isMoreOpen ? 'bold' : 'regular'} />
                        <span>المزيد</span>
                    </button>
                )}
            </nav>
        </>
    );
};
