import React, { useState, useRef, useEffect } from 'react';
import { 
    CaretDown, Check, CircleNotch, ShieldCheck, 
    Buildings, ChalkboardTeacher, GraduationCap, UsersThree, User 
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { getRoleDisplayName, getRoleDefaultRoute } from '../../utils/roleUtils';
import UserAvatar from './UserAvatar';
import './userProfileRoleSwitcher.css';

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
        default:
            return <User size={size} weight="duotone" />;
    }
};

/**
 * UserProfileRoleSwitcher Component
 * يعرض اسم المستخدم والدور الحالي في القائمة الجانبية (Sidebar)
 * مع قائمة منسدلة فاخرة وعصرية للتبديل السريع بين الأدوار عند تعددها.
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

    // اغلاق القائمة عند النقر خارجها أو الضغط على زر Escape
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDownDoc = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDownDoc);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDownDoc);
        };
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

    const handleCardKeyDown = (event) => {
        if (!hasMultipleRoles) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen(prev => !prev);
        }
    };

    return (
        <div className="role-switcher-container" ref={dropdownRef}>
            {/* بطاقة المستخدم الرئيسية */}
            <div
                className={`role-switcher-card ${hasMultipleRoles ? 'is-clickable' : ''} ${isOpen ? 'is-open' : ''}`}
                onClick={() => hasMultipleRoles && setIsOpen(prev => !prev)}
                onKeyDown={handleCardKeyDown}
                role={hasMultipleRoles ? "button" : undefined}
                tabIndex={hasMultipleRoles ? 0 : undefined}
                aria-haspopup={hasMultipleRoles ? "listbox" : undefined}
                aria-expanded={hasMultipleRoles ? isOpen : undefined}
                aria-label={hasMultipleRoles ? `تبديل الدور. الدور الحالي: ${getRoleDisplayName(activeRole)}` : undefined}
                title={hasMultipleRoles ? "اضغط هنا للتبديل بين أدوارك المسندة" : undefined}
            >
                {/* صف بيانات المستخدم والصورة الرمزية */}
                <div className="role-card-user-row">
                    <div className="role-card-avatar-box">
                        <UserAvatar
                            name={displayName}
                            size={40}
                            background="#1a5c1e"
                            className="role-card-avatar"
                            alt={displayName}
                        />
                        {hasMultipleRoles && (
                            <span className="role-card-avatar-badge" title={`${userRoles.length} أدوار مسندة`}>
                                {userRoles.length}
                            </span>
                        )}
                    </div>

                    <div className="role-card-user-meta">
                        <span className="role-card-display-name" title={displayName}>
                            {displayName}
                        </span>
                        <span className="role-card-hint">
                            {hasMultipleRoles ? "انقر لاختيار الدور" : "الحساب المسجل"}
                        </span>
                    </div>
                </div>

                {/* شريط الدور الحالي التفاعلي */}
                <div className={`role-card-active-strip ${hasMultipleRoles ? 'interactive' : ''}`}>
                    <div className="role-strip-role-info">
                        <span className="role-strip-icon">
                            {getRoleIcon(activeRole, 15)}
                        </span>
                        <span className="role-strip-title">
                            {getRoleDisplayName(activeRole)}
                        </span>
                    </div>

                    {hasMultipleRoles && (
                        <div className="role-strip-action">
                            <span className="role-strip-badge">
                                الدور الحالي
                            </span>
                            {isSwitching ? (
                                <CircleNotch size={14} className="role-spin-indicator" />
                            ) : (
                                <CaretDown
                                    size={13}
                                    weight="bold"
                                    className={`role-strip-chevron ${isOpen ? 'is-rotated' : ''}`}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* القائمة المنبثقة للأدوار في حال تعددها */}
            {hasMultipleRoles && isOpen && (
                <div 
                    className="role-menu-popup"
                    role="listbox"
                    aria-label="قائمة تبديل الأدوار"
                >
                    <div className="role-menu-header">
                        <div className="role-menu-header-title">
                            <UsersThree size={16} weight="duotone" />
                            <span>الأدوار المتاحة لحسابك</span>
                        </div>
                        <span className="role-menu-count-badge">
                            {userRoles.length} أدوار
                        </span>
                    </div>

                    <div className="role-menu-list">
                        {userRoles.map((r) => {
                            const isSelected = r.toUpperCase() === activeRole.toUpperCase();
                            return (
                                <button
                                    key={r}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`role-menu-item ${isSelected ? 'is-selected' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRoleSelect(r);
                                    }}
                                    disabled={isSwitching}
                                >
                                    <div className="role-item-start">
                                        <div className="role-item-icon-wrap">
                                            {getRoleIcon(r, 16)}
                                        </div>
                                        <div className="role-item-text-wrap">
                                            <span className="role-item-name-text">
                                                {getRoleDisplayName(r)}
                                            </span>
                                            {isSelected ? (
                                                <span className="role-item-active-subtext">الدور النشط الآن</span>
                                            ) : (
                                                <span className="role-card-hint" style={{ fontSize: '0.66rem' }}>تبديل إلى هذا الدور</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="role-item-end">
                                        {isSelected ? (
                                            isSwitching ? (
                                                <CircleNotch size={15} className="role-spin-indicator" />
                                            ) : (
                                                <div className="role-check-bubble" title="الدور الحالي">
                                                    <Check size={11} weight="bold" />
                                                </div>
                                            )
                                        ) : null}
                                    </div>
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
