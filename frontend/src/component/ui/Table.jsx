/**
 * Table — جدول بيانات قابل لإعادة الاستخدام
 * Props:
 *   columns: [{ key, label, render? }]
 *   data: array of objects
 *   emptyText: string (optional)
 *   loading: boolean (optional)
 */
const Table = ({ columns = [], data = [], emptyText = 'لا توجد بيانات', loading = false }) => {
    return (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #eee' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ background: '#f7f9f7' }}>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: '#555', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>
                                جارٍ التحميل...
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: '#aaa' }}>
                                {emptyText}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, idx) => (
                            <tr
                                key={idx}
                                style={{ borderBottom: '1px solid #f0f0f0', transition: 'background 0.15s' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#f7fff7')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                            >
                                {columns.map((col) => (
                                    <td key={col.key} style={{ padding: '0.85rem 1rem', color: '#333' }}>
                                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
