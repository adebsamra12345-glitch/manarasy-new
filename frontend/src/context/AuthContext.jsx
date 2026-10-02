import { createContext, useContext, useState, useMemo } from 'react';
import { switchActiveRole as switchRoleApi } from '../services/api/userService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access_token'));
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    });

    // قراءة الدور النشط من user أو localStorage مباشرة
    const role = useMemo(() => {
        if (user?.role) return user.role;
        return localStorage.getItem('user_role') || null;
    }, [user]);

    // قراءة جميع الأدوار المسندة للمستخدم
    const roles = useMemo(() => {
        if (user?.roles && Array.isArray(user.roles) && user.roles.length > 0) {
            return user.roles;
        }
        const storedRoles = localStorage.getItem('user_roles');
        if (storedRoles) {
            try {
                const parsed = JSON.parse(storedRoles);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch { }
        }
        return role ? [role] : [];
    }, [user, role]);

    const login = (userData, tokens) => {
        if (tokens.access) localStorage.setItem('access_token', tokens.access);
        if (tokens.refresh) localStorage.setItem('refresh_token', tokens.refresh);
        if (tokens.tenant_id) localStorage.setItem('tenant_id', tokens.tenant_id);

        const rawRoles = Array.isArray(userData.roles) && userData.roles.length > 0
            ? userData.roles
            : [userData.role];
        const cleanRoles = Array.from(new Set(rawRoles));

        const updatedUser = {
            ...userData,
            role: userData.role,
            roles: cleanRoles
        };

        localStorage.setItem('user_role', userData.role);
        localStorage.setItem('user_roles', JSON.stringify(cleanRoles));
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        setUser(updatedUser);
        setIsLoggedIn(true);
    };

    const switchRole = async (newRole) => {
        try {
            const res = await switchRoleApi(newRole);
            if (res && res.status === 'success' && res.data) {
                const newAccessToken = res.data.access_token;
                const backendUser = res.data.user || {};
                
                const rawRoles = Array.isArray(backendUser.roles) && backendUser.roles.length > 0
                    ? backendUser.roles
                    : roles;
                const updatedRoles = Array.from(new Set(rawRoles));

                const updatedUserObj = {
                    ...user,
                    ...backendUser,
                    role: backendUser.role || newRole,
                    roles: updatedRoles,
                };

                if (newAccessToken) {
                    localStorage.setItem('access_token', newAccessToken);
                }
                localStorage.setItem('user_role', updatedUserObj.role);
                localStorage.setItem('user_roles', JSON.stringify(updatedUserObj.roles));
                localStorage.setItem('user', JSON.stringify(updatedUserObj));

                setUser(updatedUserObj);
                return updatedUserObj;
            }
        } catch (err) {
            console.error('Error switching active role:', err);
            throw err;
        }
    };

    const logout = () => {
        localStorage.clear();
        setUser(null);
        setIsLoggedIn(false);
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, role, roles, login, logout, switchRole }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
    return ctx;
};

export default AuthContext;
