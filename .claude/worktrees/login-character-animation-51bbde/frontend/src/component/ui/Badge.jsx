/**
 * Badge — شارة الحالة الملوّنة
 * Props: children, variant ('success'|'warning'|'danger'|'info'|'neutral'), size ('sm'|'md')
 */
const Badge = ({ children, variant = 'neutral', size = 'md' }) => {
    const variantStyles = {
        success: { background: '#e8f5e9', color: '#2e7d32' },
        warning: { background: '#fff8e1', color: '#f57f17' },
        danger:  { background: '#fce4ec', color: '#c62828' },
        info:    { background: '#e3f2fd', color: '#1565c0' },
        neutral: { background: '#f5f5f5', color: '#616161' },
    };

    const sizeStyles = {
        sm: { padding: '0.2rem 0.55rem', fontSize: '0.72rem' },
        md: { padding: '0.3rem 0.75rem', fontSize: '0.8rem' },
    };

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: '20px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            ...variantStyles[variant],
            ...sizeStyles[size],
        }}>
            {children}
        </span>
    );
};

export default Badge;
