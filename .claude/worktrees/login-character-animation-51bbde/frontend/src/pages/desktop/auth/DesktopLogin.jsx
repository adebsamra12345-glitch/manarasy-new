import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeSlash, User, Lock, Sparkle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../../../services/api/authService';
import { useAuthContext } from '../../../context/AuthContext';

const ROLE_DEFAULT_ROUTE = {
    super_admin: '/super/dashboard',
    tenant_admin: '/admin/dashboard',
    teacher: '/teacher/dashboard',
    TEACHER: '/teacher/dashboard',
    parent: '/parent/dashboard',
};

const Login = () => {
    const navigate = useNavigate();
    const { login: authLogin } = useAuthContext();

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
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [characterIdle, setCharacterIdle] = useState(false);
    const [delivering, setDelivering] = useState(false);
    // Hidden by default only when the character is actually visible and able to deliver it
    // (wide desktop viewport, no reduced-motion preference) — otherwise the form must never
    // stay hidden, so it starts revealed everywhere else.
    const [formRevealed, setFormRevealed] = useState(() => {
        if (typeof window === 'undefined') return true;
        const wideEnough = window.matchMedia('(min-width: 1025px)').matches;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return !(wideEnough && !reducedMotion);
    });

    const paperRef = useRef(null);
    const cardRef = useRef(null);
    const flyingPaperRef = useRef(null);

    const deliverPaper = () => {
        try {
            const paperEl = paperRef.current;
            const cardEl = cardRef.current;
            const flyEl = flyingPaperRef.current;
            if (!paperEl || !cardEl || !flyEl) {
                setFormRevealed(true);
                return;
            }

            const fromRect = paperEl.getBoundingClientRect();
            const toRect = cardEl.getBoundingClientRect();
            if (fromRect.width === 0 || toRect.width === 0) {
                setFormRevealed(true);
                return;
            }

            setDelivering(true);

            const dx = fromRect.left - toRect.left;
            const dy = fromRect.top - toRect.top;
            const sx = fromRect.width / toRect.width;
            const sy = fromRect.height / toRect.height;

            flyEl.style.transformOrigin = '0 0';
            flyEl.style.left = `${toRect.left}px`;
            flyEl.style.top = `${toRect.top}px`;
            flyEl.style.width = `${toRect.width}px`;
            flyEl.style.height = `${toRect.height}px`;
            flyEl.style.transition = 'none';
            flyEl.style.opacity = '1';
            flyEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

            // Force a reflow so the browser registers the start position before we transition.
            void flyEl.offsetHeight;

            requestAnimationFrame(() => {
                flyEl.style.transition = 'transform 0.85s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.3s ease 0.55s';
                flyEl.style.transform = 'translate(0px, 0px) scale(1, 1)';
                flyEl.style.opacity = '0';
            });

            setTimeout(() => setFormRevealed(true), 600);
        } catch {
            setFormRevealed(true);
        }
    };

    useEffect(() => {
        const idleTimer = setTimeout(() => setCharacterIdle(true), 1850);
        let deliverTimer;
        let fallbackTimer;
        if (!formRevealed) {
            deliverTimer = setTimeout(deliverPaper, 2700);
            // Safety net: the login form must never stay hidden if the delivery animation
            // fails to fire for any reason (measurement error, layout change, etc.).
            fallbackTimer = setTimeout(() => setFormRevealed(true), 6000);
        }
        return () => {
            clearTimeout(idleTimer);
            if (deliverTimer) clearTimeout(deliverTimer);
            if (fallbackTimer) clearTimeout(fallbackTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            const data = await loginApi(form);
            if (data.status === 'success') {
                const userData = {
                    id: data.data.user.id,
                    username: data.data.user.username,
                    role: data.data.user.role,
                    tenant_id: data.data.tenant.id,
                    tenant_name: data.data.tenant.name,
                };
                // حفظ في localStorage للتوافق مع الكود القديم
                localStorage.setItem('access_token', data.data.access_token);
                localStorage.setItem('tenant_id', data.data.tenant.id);
                localStorage.setItem('tenant_name', data.data.tenant.name);
                localStorage.setItem('user_role', data.data.user.role);
                localStorage.setItem('username', data.data.user.username);
                localStorage.setItem('user', JSON.stringify(userData));
                // تحديث AuthContext
                authLogin(userData, { access: data.data.access_token });
                // التوجيه حسب الدور
                const userRole = data.data.user.role ? data.data.user.role.toLowerCase() : '';
                const route = ROLE_DEFAULT_ROUTE[userRole] || '/admin/dashboard';
                navigate(route, { replace: true });
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

                {/* Animated student character: walks in, unfolds a paper, and delivers it to become the login form */}
                <div className="login-character-stage" aria-hidden="true">
                    <div className="login-character-shadow"></div>
                    <div
                        className={[
                            'login-character',
                            characterIdle ? 'is-idle' : '',
                            passwordFocused ? 'is-covering-eyes' : '',
                            loading ? 'is-celebrating' : '',
                            delivering ? 'is-delivering' : '',
                        ].filter(Boolean).join(' ')}
                    >
                        <div className="login-character-bounce">
                            <svg className="login-character-rig" viewBox="0 0 220 340" width="100%" height="100%">
                                {/* Legs: sirwal peeking below the robe hem */}
                                <g className="login-character-leg-left" style={{ transformOrigin: '94px 206px' }}>
                                    <rect x="82" y="206" width="24" height="76" rx="11" fill="#f0ede2" />
                                    <rect x="77" y="278" width="32" height="15" rx="6" fill="#8b5e3c" />
                                    <line x1="82" y1="285" x2="108" y2="285" stroke="#6e4a2e" strokeWidth="2" />
                                </g>
                                <g className="login-character-leg-right" style={{ transformOrigin: '124px 206px' }}>
                                    <rect x="112" y="206" width="24" height="76" rx="11" fill="#f0ede2" />
                                    <rect x="109" y="278" width="32" height="15" rx="6" fill="#8b5e3c" />
                                    <line x1="112" y1="285" x2="138" y2="285" stroke="#6e4a2e" strokeWidth="2" />
                                </g>

                                {/* Torso: white jalabiya */}
                                <g className="login-character-torso">
                                    <path d="M64,126 Q59,182 55,254 Q110,268 165,254 Q161,182 156,126 Q110,116 64,126 Z" fill="#ffffff" />
                                    <path d="M80,160 Q77,208 73,248" stroke="#e6e2d5" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
                                    <path d="M141,160 Q144,208 148,248" stroke="#e6e2d5" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
                                    <path d="M96,124 Q110,140 124,124" stroke="#dcd7c8" strokeWidth="2.5" fill="none" />
                                    <circle cx="110" cy="146" r="2.2" fill="#c9c4b8" />
                                    <circle cx="110" cy="167" r="2.2" fill="#c9c4b8" />
                                    <circle cx="110" cy="188" r="2.2" fill="#c9c4b8" />

                                    {/* Paper the student unfolds, then delivers to the form panel */}
                                    <g className="login-character-paper" ref={paperRef}>
                                        <rect x="113" y="169" width="34" height="50" rx="3" fill="#ffffff" stroke="var(--primary-green)" strokeWidth="1.4" />
                                        <rect x="113" y="169" width="34" height="9" rx="3" fill="var(--primary-green)" />
                                        <rect x="117" y="185" width="26" height="6" rx="3" fill="#e3e0d3" />
                                        <rect x="117" y="195" width="26" height="6" rx="3" fill="#e3e0d3" />
                                        <rect x="117" y="207" width="26" height="8" rx="4" fill="var(--accent-orange)" />
                                    </g>

                                    {/* Arms: jalabiya sleeves */}
                                    <g className="login-character-arm-left" style={{ transformOrigin: '67px 134px' }}>
                                        <rect x="55" y="134" width="24" height="72" rx="12" fill="#ffffff" />
                                        <circle cx="67" cy="204" r="12" fill="#e3a97e" />
                                    </g>
                                    <g className="login-character-arm-right" style={{ transformOrigin: '151px 134px' }}>
                                        <rect x="139" y="134" width="24" height="72" rx="12" fill="#ffffff" />
                                        <circle cx="151" cy="204" r="12" fill="#e3a97e" />
                                    </g>

                                    {/* Head */}
                                    <g className="login-character-head" style={{ transformOrigin: '110px 126px' }}>
                                        <circle cx="110" cy="78" r="40" fill="#e3a97e" />
                                        <circle cx="72" cy="80" r="7" fill="#e3a97e" />
                                        <circle cx="148" cy="80" r="7" fill="#e3a97e" />

                                        {/* White taqiyah cap */}
                                        <path d="M68,70 Q68,38 110,36 Q152,38 152,70 Q152,54 110,52 Q68,54 68,70 Z" fill="#ffffff" stroke="#e2ded2" strokeWidth="1.5" />
                                        <circle cx="86" cy="49" r="1.4" fill="#d8d4c8" />
                                        <circle cx="101" cy="44" r="1.4" fill="#d8d4c8" />
                                        <circle cx="119" cy="44" r="1.4" fill="#d8d4c8" />
                                        <circle cx="134" cy="49" r="1.4" fill="#d8d4c8" />
                                        <circle cx="93" cy="59" r="1.4" fill="#d8d4c8" />
                                        <circle cx="127" cy="59" r="1.4" fill="#d8d4c8" />

                                        <g className="login-character-brow">
                                            <rect x="90" y="70" width="13" height="4" rx="2" fill="#3a2a1e" />
                                            <rect x="117" y="70" width="13" height="4" rx="2" fill="#3a2a1e" />
                                        </g>
                                        <g className="login-character-eye"><ellipse cx="97" cy="82" rx="4" ry="5" fill="var(--primary-green)" /></g>
                                        <g className="login-character-eye login-character-eye-right"><ellipse cx="123" cy="82" rx="4" ry="5" fill="var(--primary-green)" /></g>
                                        <circle cx="82" cy="94" r="6" fill="var(--accent-orange)" opacity="0.18" />
                                        <circle cx="138" cy="94" r="6" fill="var(--accent-orange)" opacity="0.18" />
                                        <path d="M98 96 q12 10 24 0" stroke="#a05a2c" strokeWidth="3" fill="none" strokeLinecap="round" />

                                        {/* Peeking hands, shown while typing the password */}
                                        <g className="login-character-peek-hands">
                                            <circle cx="95" cy="80" r="13" fill="#e3a97e" />
                                            <circle cx="125" cy="80" r="13" fill="#e3a97e" />
                                        </g>
                                    </g>
                                </g>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="login-form-panel">
                <div
                    ref={cardRef}
                    className={`login-card${formRevealed ? '' : ' login-card-hidden'}`}
                >
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
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
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

            {/* Flies from the character's hand to the form panel, growing into the real card */}
            <div ref={flyingPaperRef} className="login-paper-flight" aria-hidden="true">
                <div className="login-paper-flight-header"></div>
                <div className="login-paper-flight-line"></div>
                <div className="login-paper-flight-line"></div>
                <div className="login-paper-flight-button"></div>
            </div>
        </div>
    );
};

export default Login;


