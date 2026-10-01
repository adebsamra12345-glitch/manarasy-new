const PlaceholderView = ({ title = 'الصفحة' }) => (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa' }}>
        <h2 style={{ color: 'var(--primary-green, #133315)', marginBottom: '0.5rem' }}>{title}</h2>
        <p>هذه الصفحة قيد التطوير</p>
    </div>
);
export default PlaceholderView;
