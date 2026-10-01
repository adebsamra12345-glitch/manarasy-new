/**
 * Button — مكوّن الزر الأساسي القابل لإعادة الاستخدام
 * Props: variant ('primary'|'secondary'|'danger'|'ghost'), size ('sm'|'md'|'lg'), disabled, loading, onClick, children
 */
const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    onClick,
    type = 'button',
    className = '',
    ...rest
}) => {
    const baseStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        border: 'none',
        borderRadius: '10px',
        fontFamily: 'inherit',
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'all 0.2s',
    };

    const sizes = {
        sm: { padding: '0.4rem 0.9rem', fontSize: '0.82rem' },
        md: { padding: '0.65rem 1.4rem', fontSize: '0.95rem' },
        lg: { padding: '0.9rem 2rem', fontSize: '1.05rem' },
    };

    const variants = {
        primary:   { background: 'var(--primary-green, #133315)', color: '#fff' },
        secondary: { background: '#f0f4f0', color: '#133315' },
        danger:    { background: '#e57373', color: '#fff' },
        ghost:     { background: 'transparent', color: 'var(--primary-green, #133315)', border: '1.5px solid currentColor' },
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            className={className}
            style={{ ...baseStyle, ...sizes[size], ...variants[variant] }}
            {...rest}
        >
            {loading && <span className="btn-spinner" />}
            {children}
        </button>
    );
};

export default Button;
