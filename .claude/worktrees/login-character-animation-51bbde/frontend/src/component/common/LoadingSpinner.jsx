/**
 * LoadingSpinner — مؤشر التحميل الدوّار
 * Props: size ('sm'|'md'|'lg'), color (CSS color string), fullScreen (boolean)
 */
const LoadingSpinner = ({ size = 'md', color = 'var(--primary-green, #133315)', fullScreen = false }) => {
    const sizes = { sm: 24, md: 40, lg: 64 };
    const px = sizes[size];

    const spinner = (
        <div style={{
            width: px, height: px,
            border: `${px / 8}px solid rgba(0,0,0,0.08)`,
            borderTop: `${px / 8}px solid ${color}`,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
        }} />
    );

    if (fullScreen) {
        return (
            <div style={{
                position: 'fixed', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.8)', zIndex: 9999
            }}>
                {spinner}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            {spinner}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default LoadingSpinner;
