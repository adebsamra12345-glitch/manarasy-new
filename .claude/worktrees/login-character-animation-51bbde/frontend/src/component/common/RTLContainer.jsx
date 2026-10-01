/**
 * RTLContainer — غلاف يُجبر اتجاه العرض من اليمين إلى اليسار (RTL)
 * Props: children, className, style
 */
const RTLContainer = ({ children, className = '', style = {} }) => {
    return (
        <div
            dir="rtl"
            lang="ar"
            className={className}
            style={{ direction: 'rtl', textAlign: 'right', fontFamily: 'inherit', ...style }}
        >
            {children}
        </div>
    );
};

export default RTLContainer;
