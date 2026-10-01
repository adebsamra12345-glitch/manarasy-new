import React from 'react';
import MosqueAdminDashboard from './MosqueAdminDashboard';
import TeacherDashboard from './TeacherDashboard';

const Dashboard = () => {
    // Determine user role. In Manara platform, 'SUPER_ADMIN' or 'ADMIN' manages the mosque.
    // 'TEACHER' is for teachers. We fallback to TeacherDashboard if role is missing or unknown.
    const userRole = localStorage.getItem('user_role');
    
    // For testing purposes, we can let SUPER_ADMIN and ADMIN see the admin dashboard
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

    // Temporary toggle button to allow the user to see both dashboards during testing without relogging
    const [forceAdmin, setForceAdmin] = React.useState(isAdmin);

    return (
        <div style={{ height: '100%' }}>
            {/* Temporary dev toggle for previewing both dashboards */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1000 }}>
                <button 
                    onClick={() => setForceAdmin(!forceAdmin)}
                    style={{ background: '#333', color: '#fff', padding: '5px 10px', borderRadius: '4px', fontSize: '12px' }}
                >
                    عرض كـ: {forceAdmin ? 'مدير' : 'معلم'}
                </button>
            </div>

            {forceAdmin ? <MosqueAdminDashboard /> : <TeacherDashboard />}
        </div>
    );
};

export default Dashboard;
