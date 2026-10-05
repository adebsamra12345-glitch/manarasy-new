import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeSlash, ShieldCheck, Warning } from '@phosphor-icons/react';
import { usePlatformAuth } from '../../context/PlatformAuthContext';
import { extractApiError } from '../../services/api/registrationService';
import './platform.css';

const PlatformLogin = () => {
    const { isAuthenticated, login } = usePlatformAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    if (isAuthenticated) return <Navigate to="/platform/requests" replace />;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await login(email.trim(), password);
            const from = location.state?.from;
            navigate(from && from.startsWith('/platform') && !from.startsWith('/platform/login') ? from : '/platform/requests', { replace: true });
        } catch (err) {
            setError(extractApiError(err, 'تعذّر تسجيل الدخول'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="pl-login-page">
            <form className="pl-login-card" onSubmit={submit} noValidate>
                <div className="pl-login-icon"><ShieldCheck size={34} weight="duotone" /></div>
                <h1>إدارة المنصة</h1>
                <p className="pl-muted">دخول مخصص لأدمن منارة العام. هذه الصفحة منفصلة عن دخول المساجد.</p>

                <label className="pl-field">
                    <span>البريد الإلكتروني</span>
                    <input type="email" dir="ltr" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="pl-field">
                    <span>كلمة المرور</span>
                    <div className="pl-pass">
                        <input type={show ? 'text' : 'password'} dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                        <button type="button" className="pl-icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'إخفاء' : 'إظهار'}>
                            {show ? <EyeSlash size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </label>

                {error && <div className="pl-alert error" role="alert"><Warning size={16} /> {error}</div>}

                <button className="pl-btn primary block" disabled={busy || !email || !password}>
                    {busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
                </button>
            </form>
        </div>
    );
};

export default PlatformLogin;
