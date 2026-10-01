import { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((msg, type = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, msg, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 4000);
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
            {/* Toast Container */}
            <div style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notifications.map(n => (
                    <div key={n.id} onClick={() => removeNotification(n.id)} style={{
                        background: n.type === 'error' ? '#e53935' : n.type === 'success' ? '#2e7d32' : '#1565c0',
                        color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '10px',
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '0.9rem'
                    }}>
                        {n.msg}
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
    return ctx;
};

export default NotificationContext;
