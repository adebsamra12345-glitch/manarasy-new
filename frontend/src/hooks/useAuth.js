import { useState, useEffect } from 'react';

/**
 * useAuth — إدارة حالة المصادقة
 */
export const useAuth = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access_token'));
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    });

    const login = (userData, tokens) => {
        localStorage.setItem('access_token', tokens.access);
        if (tokens.refresh) localStorage.setItem('refresh_token', tokens.refresh);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setIsLoggedIn(true);
    };

    const logout = () => {
        localStorage.clear();
        setUser(null);
        setIsLoggedIn(false);
    };

    return { isLoggedIn, user, login, logout };
};

export default useAuth;
