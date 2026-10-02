import React, { useState, useEffect } from 'react';
import { Eye, EyeSlash, User, Lock, Sparkle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { FEATURES } from '../config/features';

const Login = ({ onLoginSuccess }) => {
    const navigate = useNavigate();

    // استخراج النطاق الفرعي من الرابط (مثال: alhuda.manarasy.com -> alhuda)
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
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.password) {
            setError('يرجى تعبئة جميع الحقول');
            return;
        }
        if (!form.subdomain) {
            setError('لم يتم التعرف على النطاق الفرعي من الرابط. يرجى استخدام رابط مثل: alhuda.localhost');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const data = await login(form);
            if (data.status === 'success') {
                localStorage.setItem('access_token', data.data.access_token);
                localStorage.setItem('tenant_id', data.data.tenant.id);
                localStorage.setItem('tenant_name', data.data.tenant.name);
                localStorage.setItem('user_role', data.data.user.role);
                localStorage.setItem('username', data.data.user.username);
                onLoginSuccess();
            } else {
                setError(data.message || 'فشل تسجيل الدخول');
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'حدث خطأ في الاتصال بالخادم';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!form.subdomain) {
        return (
            <div className="landing-page">
                <div className="landing-content">
                    <div className="login-logo-circle landing-logo">
                        <span className="login-logo-icon">✦</span>
                    </div>
                    <h1 className="login-brand-name" style={{ color: 'var(--primary-green)' }}>مَنَارَة</h1>
                    <p className="login-brand-tagline" style={{ color: 'var(--text-secondary)' }}>منصة إدارة الحلقات القرآنية</p>
                    <p className="login-brand-desc" style={{ color: 'var(--text-muted)' }}>
                        نلتقي لنرتقي في رحاب القرآن الكريم — متابعة حفظ، تسميع، وتنظيم متكامل لحلقات الذكر في واجهة عصرية مريحة.
                    </p>
                    <button className="landing-register-btn" onClick={() => navigate('/register')}>
                        طلب تسجيل مسجد جديد
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            {/* Left Panel - Brand */}
            <div className="login-brand-panel">
                <div className="login-brand-pattern"></div>
                <div className="login-brand-content">
                    <div className="login-logo-circle">
                        <span className="login-logo-icon">✦</span>
                    </div>
                    <h1 className="login-brand-name">مَنَارَة</h1>
                    <p className="login-brand-tagline">منصة إدارة الحلقات القرآنية</p>
                    <p className="login-brand-desc">
                        نلتقي لنرتقي في رحاب القرآن الكريم — متابعة حفظ، تسميع، وتنظيم متكامل لحلقات الذكر في واجهة عصرية مريحة.
                    </p>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="login-form-panel">
                <div className="login-card">
                    <div className="login-card-header">
                        <h2>مرحباً بعودتك</h2>
                        <p>سجل دخولك لمتابعة لوحة التحكم وإدارة حلقاتك القرآنية</p>
                    </div>

                    <form className="login-form" onSubmit={handleSubmit}>
                        {/* Username */}
                        <div className="login-field">
                            <label htmlFor="username">اسم المستخدم</label>
                            <div className="login-input-wrapper">
                                <User size={20} className="login-input-icon" />
                                <input
                                    id="username"
                                    type="text"
                                    name="username"
                                    value={form.username}
                                    onChange={handleChange}
                                    placeholder="name@example.com"
                                    className="login-input with-icon"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="login-field">
                            <div className="login-field-row">
                                <label htmlFor="password">كلمة المرور</label>
                                <button type="button" className="login-forgot">نسيت كلمة المرور؟</button>
                            </div>
                            <div className="login-input-wrapper">
                                <Lock size={20} className="login-input-icon" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="••••••••••••"
                                    className="login-input with-icon"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="login-eye-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                                >
                                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="login-remember">
                            <label className="login-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="login-checkbox"
                                />
                                <span>تذكرني</span>
                            </label>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="login-error" role="alert">
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            id="login-submit-btn"
                            type="submit"
                            className="login-btn-primary"
                            disabled={loading}
                        >
                            {loading ? <span className="login-spinner"></span> : 'تسجيل الدخول'}
                        </button>

                        {/* تسجيل الدخول بواسطة جوجل: معطّل مؤقتاً — فعّله من config/features.js */}
                        {FEATURES.GOOGLE_LOGIN && (
                            <>
                            <div className="login-divider"><span>أو</span></div>

                            <button type="button" className="login-btn-google">
                                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                تسجيل الدخول بواسطة جوجل
                            </button>
                            </>
                        )}

                        <button type="button" className="login-btn-secondary" onClick={() => navigate('/register')}>طلب تسجيل</button>

                        <p className="login-register-link">
                            ليس لديك حساب؟ <button type="button" className="login-link-btn" onClick={() => navigate('/register')}>سجل الآن</button>
                        </p>
                    </form>

                    <button type="button" className="login-assistant-btn">
                        <Sparkle size={18} weight="fill" />
                        مساعد منارة الذكي
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
