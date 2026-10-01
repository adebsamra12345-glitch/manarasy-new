import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access_token'));
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    });

    // قراءة الدور من localStorage مباشرة لأن بعض أجزاء التطبيق تحفظه كـ user_role
    const getRole = () => {
        if (user?.role) return user.role;
        return localStorage.getItem('user_role') || null;
    };

    const login = (userData, tokens) => {
        localStorage.setItem('access_token', tokens.access);
        if (tokens.refresh) localStorage.setItem('refresh_token', tokens.refresh);
        if (tokens.tenant_id) localStorage.setItem('tenant_id', tokens.tenant_id);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setIsLoggedIn(true);
    };

    const logout = () => {
        localStorage.clear();
        setUser(null);
        setIsLoggedIn(false);
    };

    return (
        <AuthContext.Provider value={{ isLoggedIn, user, role: getRole(), login, logout }}>
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
