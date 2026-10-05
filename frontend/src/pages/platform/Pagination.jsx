import { CaretLeft, CaretRight } from '@phosphor-icons/react';

const Pagination = ({ page, count, pageSize, onChange }) => {
    const pages = Math.max(1, Math.ceil(count / pageSize));
    if (pages <= 1) return null;
    return (
        <div className="pl-pager">
            <button type="button" className="pl-btn ghost sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
                <CaretRight size={14} /> السابق
            </button>
            <span className="pl-muted">صفحة {page} من {pages} · {count} نتيجة</span>
            <button type="button" className="pl-btn ghost sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
                التالي <CaretLeft size={14} />
            </button>
        </div>
    );
};

export default Pagination;
