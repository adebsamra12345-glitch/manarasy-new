import { useCallback, useEffect, useRef, useState } from 'react';
import { MagnifyingGlass, Plus, Warning } from '@phosphor-icons/react';
import { listMosques } from '../../services/platformService';
import { extractApiError } from '../../services/api/registrationService';
import AddMosqueModal from './AddMosqueModal';
import Pagination from './Pagination';
import { fmtDate } from './platformConstants';
import './platform.css';

const MosquesPage = () => {
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ results: [], count: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [q]);

    const seq = useRef(0);
    const load = useCallback(async () => {
        const mine = ++seq.current;
        setLoading(true);
        setError('');
        try {
            const res = await listMosques({ q: debouncedQ || undefined, page });
            if (mine === seq.current) setData(res);
        } catch (err) {
            if (mine === seq.current) setError(extractApiError(err, 'تعذّر تحميل المساجد'));
        } finally {
            if (mine === seq.current) setLoading(false);
        }
    }, [debouncedQ, page]);

    useEffect(() => { load(); }, [load]);

    return (
        <section>
            <header className="pl-page-head">
                <div>
                    <h2>المساجد</h2>
                    <p className="pl-muted">كل المساجد المسجَّلة على المنصة وحالة اشتراكها.</p>
                </div>
                <button type="button" className="pl-btn primary" onClick={() => setAdding(true)}>
                    <Plus size={16} weight="bold" /> إضافة مسجد
                </button>
            </header>

            <div className="pl-toolbar">
                <label className="pl-search">
                    <MagnifyingGlass size={16} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو النطاق" />
                </label>
            </div>

            {error && <div className="pl-alert error"><Warning size={16} /> {error}</div>}

            <div className="pl-card pl-table-wrap">
                <table className="pl-table">
                    <thead><tr><th>المسجد</th><th>النطاق</th><th>الخطة</th><th>الاشتراك</th><th>ينتهي في</th><th>الحالة</th></tr></thead>
                    <tbody>
                        {data.results.map((m) => (
                            <tr key={m.id}>
                                <td><strong>{m.name}</strong><div className="pl-muted sm" dir="ltr">{m.contact_phone}</div></td>
                                <td dir="ltr">{m.subdomain}</td>
                                <td>{m.plan || '—'}</td>
                                <td>{m.subscription_status || '—'}</td>
                                <td className="pl-muted sm">{fmtDate(m.subscription_ends_at)}</td>
                                <td><span className={`pl-badge ${m.is_active ? 'green' : 'gray'}`}>{m.is_active ? 'نشط' : 'غير نشط'}</span></td>
                            </tr>
                        ))}
                        {!loading && data.results.length === 0 && <tr><td colSpan="6" className="pl-center pl-muted">لا توجد مساجد</td></tr>}
                        {loading && <tr><td colSpan="6" className="pl-center pl-muted">جارٍ التحميل…</td></tr>}
                    </tbody>
                </table>
            </div>

            <Pagination page={page} count={data.count} pageSize={20} onChange={setPage} />

            {adding && <AddMosqueModal onClose={() => setAdding(false)} onCreated={load} />}
        </section>
    );
};

export default MosquesPage;
