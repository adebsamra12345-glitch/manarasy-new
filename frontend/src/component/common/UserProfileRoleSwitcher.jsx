import React, { useState, useRef, useEffect } from 'react';
import { 
    CaretDown, Check, CircleNotch, ShieldCheck, 
    Buildings, ChalkboardTeacher, GraduationCap, UsersThree, User 
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { getRoleDisplayName, getRoleDefaultRoute } from '../../utils/roleUtils';

const getRoleIcon = (roleCode, size = 18) => {
    if (!roleCode) return <User size={size} />;
    const key = String(roleCode).toUpperCase();
    switch (key) {
        case 'TENANT_ADMIN':
        case 'SUPER_ADMIN':
            return <ShieldCheck size={size} weight="duotone" />;
        case 'CENTER_MANAGER':
            return <Buildings size={size} weight="duotone" />;
        case 'TEACHER':
            return <ChalkboardTeacher size={size} weight="duotone" />;
        case 'STUDENT':
            return <GraduationCap size={size} weight="duotone" />;
        case 'PARENT':
            return <UsersThree size={size} weight="duotone" />;
        default:
            return <User size={size} weight="duotone" />;
    }
};

/**
 * UserProfileRoleSwitcher Component
 * يعرض اسم المستخدم والدور الحالي في القائمة الجانبية (Sidebar)
 * وفي حال امتلاكه لعدة أدوار، يتيح قائمة منسدلة أنيقة ومميزة للتبديل بينها مباشرة.
 */
const UserProfileRoleSwitcher = () => {
    const { user, role, roles, switchRole } = useAuthContext();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const dropdownRef = useRef(null);

    const displayName = user?.first_name 
        ? `${user.first_name} ${user.last_name || ''}`.trim()
        : user?.username || localStorage.getItem('username') || 'المستخدم';

    const activeRole = role || 'STUDENT';
    const userRoles = Array.from(new Set(Array.isArray(roles) && roles.length > 0 ? roles : [activeRole]));
    const hasMultipleRoles = userRoles.length > 1;

    // اغلاق القائمة عند النقر خارجها
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleRoleSelect = async (targetRole) => {
        if (targetRole.toUpperCase() === activeRole.toUpperCase() || isSwitching) {
            setIsOpen(false);
            return;
        }

        try {
            setIsSwitching(true);
            await switchRole(targetRole);
            setIsOpen(false);

            // توجيه تلقائي إلى الصفحة الرئيسية الخاصة بالدور الجديد
            const targetRoute = getRoleDefaultRoute(targetRole);
            navigate(targetRoute, { replace: true });
        } catch (error) {
            console.error("فشل تبديل الدور:", error);
        } finally {
            setIsSwitching(false);
        }
    };

    return (
        <div className="user-profile-role-switcher" ref={dropdownRef}>
            <div
                className={`user-profile ${hasMultipleRoles ? 'has-multiple-roles' : ''} ${isOpen ? 'dropdown-active' : ''}`}
                onClick={() => hasMultipleRoles && setIsOpen(prev => !prev)}
                style={{ cursor: hasMultipleRoles ? 'pointer' : 'default', userSelect: 'none' }}
                title={hasMultipleRoles ? "اضغط هنا للتبديل بين أدوارك المسندة" : undefined}
            >
                <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1a5c1e&color=fff&rounded=true`}
                    alt={displayName}
                />
                <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                    </h3>

                    {/* عرض اسم الدور - مع أيقونة التبديل فقط عند تعدد الأدوار */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: hasMultipleRoles ? 'pointer' : 'default' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', color: '#81c784' }}>
                            {getRoleIcon(activeRole, 14)}
                        </span>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)' }}>
                            {getRoleDisplayName(activeRole)}
                        </p>
                        {hasMultipleRoles && (
                            isSwitching ? (
                                <CircleNotch size={14} className="spin-icon" style={{ color: '#81c784', marginRight: 'auto' }} />
                            ) : (
                                <CaretDown
                                    size={14}
                                    style={{
                                        color: 'rgba(255,255,255,0.7)',
                                        marginRight: 'auto',
                                        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                                    }}
                                />
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* القائمة المنسدلة للتبديل بين الأدوار في حال تعددها */}
            {hasMultipleRoles && isOpen && (
                <div className="role-dropdown-menu">
                    <div className="role-dropdown-header">
                        <span>تبديل الدور الحالي</span>
                        <span className="role-dropdown-count">{userRoles.length} أدوار</span>
                    </div>
                    <div className="role-dropdown-list">
                        {userRoles.map((r) => {
                            const isActive = r.toUpperCase() === activeRole.toUpperCase();
                            return (
                                <button
                                    key={r}
                                    type="button"
                                    className={`role-dropdown-item ${isActive ? 'active' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRoleSelect(r);
                                    }}
                                    disabled={isSwitching}
                                >
                                    <div className="role-dropdown-item-content">
                                        <span className={`role-item-icon ${isActive ? 'active' : ''}`}>
                                            {getRoleIcon(r, 18)}
                                        </span>
                                        <div className="role-item-text">
                                            <span className="role-item-title">{getRoleDisplayName(r)}</span>
                                            {isActive && <span className="active-badge">الدور النشط</span>}
                                        </div>
                                    </div>
                                    {isActive && <Check size={16} className="role-check-icon" weight="bold" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfileRoleSwitcher;
