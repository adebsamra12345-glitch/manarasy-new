import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
    PLATFORM_ADMIN_KEY, PLATFORM_TOKEN_KEY, clearPlatformSession, getPlatformToken,
} from '../services/platformClient';
import { platformLogin, platformLogout } from '../services/platformService';

const PlatformAuthContext = createContext(null);

const readAdmin = () => {
    try { return JSON.parse(sessionStorage.getItem(PLATFORM_ADMIN_KEY) || 'null'); } catch { return null; }
};

export const PlatformAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(() => (getPlatformToken() ? readAdmin() : null));

    const login = useCallback(async (email, password) => {
        const res = await platformLogin(email, password);
        const { access_token: token, admin: info } = res.data;
        try {
            sessionStorage.setItem(PLATFORM_TOKEN_KEY, token);
            sessionStorage.setItem(PLATFORM_ADMIN_KEY, JSON.stringify(info));
        } catch { /* ignore */ }
        setAdmin(info);
        return info;
    }, []);

    const logout = useCallback(async () => {
        try { await platformLogout(); } catch { /* التوكن قد يكون منتهياً أصلاً */ }
        clearPlatformSession();
        setAdmin(null);
    }, []);

    const value = useMemo(() => ({ admin, isAuthenticated: !!admin, login, logout }), [admin, login, logout]);
    return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
};

export const usePlatformAuth = () => {
    const ctx = useContext(PlatformAuthContext);
    if (!ctx) throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
    return ctx;
};

/** حارس مسارات المنصة: لا علاقة له بأدوار المساجد (AuthContext) */
export const PlatformRoute = ({ children }) => {
    const { isAuthenticated } = usePlatformAuth();
    const location = useLocation();
    if (!isAuthenticated) return <Navigate to="/platform/login" replace state={{ from: location.pathname }} />;
    return children;
};
