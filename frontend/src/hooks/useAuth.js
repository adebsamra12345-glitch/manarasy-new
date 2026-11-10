import { useState, useEffect } from 'react';
import { hasSession, setAccessToken, clearSession } from '../services/tokenStore';

/**
 * useAuth — إدارة حالة المصادقة
 */
export const useAuth = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(hasSession());
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); }
        catch { return null; }
    });

    const login = (userData, tokens) => {
        setAccessToken(tokens.access);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setIsLoggedIn(true);
    };

    const logout = () => {
        clearSession();
        setUser(null);
        setIsLoggedIn(false);
    };

    return { isLoggedIn, user, login, logout };
};

export default useAuth;
