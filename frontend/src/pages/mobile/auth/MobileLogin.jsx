import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeSlash, SignIn } from '@phosphor-icons/react';
import { login as loginApi } from '../../../services/api/authService';
import { useAuthContext } from '../../../context/AuthContext';

const ROLE_DEFAULT_ROUTE = {
    super_admin: '/super/dashboard',
    tenant_admin: '/admin/dashboard',
    teacher: '/teacher/dashboard',
    TEACHER: '/teacher/dashboard',
    parent: '/parent/dashboard',
};

/**
 * MobileLogin
 * نسخة الهاتف الأنيقة والمستقلة من شاشة تسجيل الدخول
 */
const MobileLogin = () => {
    const navigate = useNavigate();
    const { login: authLogin } = useAuthContext();

    const getSubdomain = () => {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length >= 2 && parts[0] !== 'www') {
            return parts[0];
        }
        return '';
    };

    const [form, setForm] = useState({ subdomain: getSubdomain(), username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await loginApi({
                username: form.username,
                password: form.password,
                subdomain: form.subdomain || undefined,
            });

            const tokens = {
                access: data.access,
                refresh: data.refresh,
                tenant_id: data.tenant_id,
            };
            const userData = {
                id: data.user_id,
                username: data.username,
                role: data.role,
                first_name: data.first_name,
                last_name: data.last_name,
                center_name: data.center_name,
            };

            authLogin(userData, tokens);
            const targetRoute = ROLE_DEFAULT_ROUTE[data.role] || '/dashboard';
            navigate(targetRoute, { replace: true });
        } catch (err) {
            console.error('Mobile login error:', err);
            setError(err.response?.data?.detail || err.message || 'بيانات الدخول غير صحيحة');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'linear-gradient(180deg, #f4fbf5 0%, #e8f5e9 100%)',
            direction: 'rtl',
            fontFamily: 'inherit'
        }}>
            <div style={{
                background: '#fff',
                borderRadius: '24px',
                padding: '2rem 1.5rem',
                boxShadow: '0 10px 30px rgba(19,51,21,0.08)',
                border: '1px solid #e0e0e0'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #133315 0%, #1e4d20 100%)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem',
                        boxShadow: '0 8px 20px rgba(19,51,21,0.2)'
                    }}>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>مَ</h1>
                    </div>
                    <h2 style={{ margin: '0 0 0.4rem', color: '#133315', fontSize: '1.4rem', fontWeight: 800 }}>منصة مَنَارَة</h2>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>تسجيل الدخول إلى حسابك</p>
                </div>

                {error && (
                    <div style={{
                        background: '#ffebee',
                        color: '#c62828',
                        padding: '0.8rem 1rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        marginBottom: '1.2rem',
                        border: '1px solid #ffcdd2',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#333', marginBottom: '0.4rem' }}>
                            اسم المستخدم
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                            <input
                                id="mobile-login-username"
                                type="text"
                                required
                                value={form.username}
                                onChange={e => setForm({ ...form, username: e.target.value })}
                                placeholder="أدخل اسم المستخدم"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 2.4rem 0.75rem 0.8rem',
                                    borderRadius: '12px',
                                    border: '1.5px solid #ddd',
                                    fontSize: '0.9rem',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#333', marginBottom: '0.4rem' }}>
                            كلمة المرور
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} color="#888" style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)' }} />
                            <input
                                id="mobile-login-password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                placeholder="أدخل كلمة المرور"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 2.4rem 0.75rem 2.4rem',
                                    borderRadius: '12px',
                                    border: '1.5px solid #ddd',
                                    fontSize: '0.9rem',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '0.8rem',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#888',
                                    padding: 0
                                }}
                            >
                                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        id="mobile-login-submit"
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '0.8rem',
                            background: 'linear-gradient(135deg, #133315 0%, #1e4d20 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '0.85rem',
                            fontSize: '1rem',
                            fontWeight: 700,
                            fontFamily: 'inherit',
                            cursor: loading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 14px rgba(19,51,21,0.25)',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        <SignIn size={20} weight="bold" />
                        {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default MobileLogin;
