import { 
    House, Users, FolderStar, GraduationCap, ChalkboardTeacher, 
    Books, MapPin, CalendarBlank, Medal, ChartBar, Gear, Sparkle, SignOut 
} from '@phosphor-icons/react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
    return (
        <aside id="desktop-sidebar-container" className="sidebar-container hide-on-mobile">
            <div className="sidebar-logo">
                <img src="https://ui-avatars.com/api/?name=م&background=133315&color=fff&rounded=true" alt="شعار منارة" />
                <span>مَنَارَة</span>
            </div>
            
            <div className="user-profile">
                <img src="https://i.pravatar.cc/150?img=11" alt="محمد العمري" />
                <div className="user-info">
                    <h3>أ. محمد العمري</h3>
                    <p>مدير النظام</p>
                </div>
            </div>
            
            <nav className="nav-menu">
                <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <House size={20} />
                    الرئيسية
                </NavLink>
                <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Users size={20} />
                    المستخدمون
                </NavLink>
                <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <FolderStar size={20} />
                    المشاريع
                </NavLink>
                <NavLink to="/students" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <GraduationCap size={20} />
                    الطلاب
                </NavLink>
                <NavLink to="/teachers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ChalkboardTeacher size={20} />
                    المعلمون
                </NavLink>
                <NavLink to="/rings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Books size={20} />
                    الحلقات
                </NavLink>
                <NavLink to="/centers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <MapPin size={20} />
                    المراكز
                </NavLink>
                <NavLink to="/sessions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <CalendarBlank size={20} />
                    الجلسات
                </NavLink>
                <NavLink to="/rewards" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Medal size={20} />
                    النقاط والمكافآت
                </NavLink>
                <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ChartBar size={20} />
                    التقارير
                </NavLink>
                <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Gear size={20} />
                    الإعدادات
                </NavLink>
            </nav>
            
            <div className="sidebar-bottom">
                <button className="smart-assistant-btn">
                    <Sparkle size={20} weight="fill" />
                    مساعد منارة الذكي
                </button>
                
                <div className="bottom-nav">
                    <button className="nav-item" style={{ padding: '12px 0', background: 'none', border: 'none', width: '100%', textAlign: 'right', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}>
                        <Gear size={20} />
                        الإعدادات
                    </button>
                    <button className="nav-item" style={{ padding: '12px 0', color: '#e57373', background: 'none', border: 'none', width: '100%', textAlign: 'right', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}>
                        الخروج
                        <SignOut size={20} style={{ transform: 'scaleX(-1)' }} />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
