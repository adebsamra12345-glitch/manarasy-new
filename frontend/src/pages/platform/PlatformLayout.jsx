import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardText, Mosque, SignOut } from '@phosphor-icons/react';
import { usePlatformAuth } from '../../context/PlatformAuthContext';
import './platform.css';

const PlatformLayout = () => {
    const { admin, logout } = usePlatformAuth();
    const navigate = useNavigate();

    const doLogout = async () => {
        await logout();
        navigate('/platform/login', { replace: true });
    };

    return (
        <div className="pl-shell">
            <aside className="pl-side">
                <div className="pl-brand"><span>✦</span> مَنَارَة <small>المنصة</small></div>
                <nav>
                    <NavLink to="/platform/requests" className={({ isActive }) => `pl-nav ${isActive ? 'active' : ''}`}>
                        <ClipboardText size={20} /> طلبات التسجيل
                    </NavLink>
                    <NavLink to="/platform/mosques" className={({ isActive }) => `pl-nav ${isActive ? 'active' : ''}`}>
                        <Mosque size={20} /> المساجد
                    </NavLink>
                </nav>
                <div className="pl-side-foot">
                    <div className="pl-admin" title={admin?.email}>{admin?.full_name || admin?.email}</div>
                    <button type="button" className="pl-btn ghost sm" onClick={doLogout}><SignOut size={16} /> خروج</button>
                </div>
            </aside>
            <main className="pl-main"><Outlet /></main>
        </div>
    );
};

export default PlatformLayout;
