import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ArrowsClockwise, CheckCircle, FilePdf, Image as ImageIcon, MagnifyingGlass, Warning, XCircle,
} from '@phosphor-icons/react';
import {
    approveRegistration, getRegistration, listRegistrations, rejectRegistration, retryRegistration,
} from '../../services/platformService';
import { extractApiError } from '../../services/api/registrationService';
import PlatformModal from './PlatformModal';
import ReceiptViewer from './ReceiptViewer';
import Pagination from './Pagination';
import { EVENT_LABEL, FILTERS, SOURCE_LABEL, STATUS_META, fmtDate } from './platformConstants';
import './platform.css';

export const StatusBadge = ({ status }) => {
    const meta = STATUS_META[status] || { label: status, tone: 'gray' };
    return <span className={`pl-badge ${meta.tone}`}>{meta.label}</span>;
};

const RegistrationRequests = () => {
    const [filter, setFilter] = useState('PENDING_APPROVAL');
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ results: [], count: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    // Debounce للبحث
    useEffect(() => {
        const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [q]);

    const reqSeq = useRef(0);
    const load = useCallback(async () => {
        const seq = ++reqSeq.current;          // يتجاهل استجابات قديمة تصل متأخرة (race)
        setLoading(true);
        setError('');
        try {
            const res = await listRegistrations({ status: filter || undefined, q: debouncedQ || undefined, page });
            if (seq === reqSeq.current) setData(res);
        } catch (err) {
            if (seq === reqSeq.current) setError(extractApiError(err, 'تعذّر تحميل الطلبات'));
        } finally {
            if (seq === reqSeq.current) setLoading(false);
        }
    }, [filter, debouncedQ, page]);

    useEffect(() => { load(); }, [load]);

    return (
        <section>
            <header className="pl-page-head">
                <div>
                    <h2>طلبات التسجيل</h2>
                    <p className="pl-muted">راجع إشعارات الدفع ووافق على الطلبات لإنشاء قواعد بيانات المساجد.</p>
                </div>
                <button type="button" className="pl-btn ghost" onClick={load} disabled={loading}>
                    <ArrowsClockwise size={16} /> تحديث
                </button>
            </header>

            <div className="pl-toolbar">
                <div className="pl-tabs" role="tablist">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key || 'all'} type="button" role="tab" aria-selected={filter === f.key}
                            className={`pl-tab ${filter === f.key ? 'active' : ''}`}
                            onClick={() => { setFilter(f.key); setPage(1); }}
                        >{f.label}</button>
                    ))}
                </div>
                <label className="pl-search">
                    <MagnifyingGlass size={16} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو النطاق أو الهاتف" />
                </label>
            </div>

            {error && <div className="pl-alert error"><Warning size={16} /> {error}</div>}

            <div className="pl-card pl-table-wrap">
                <table className="pl-table">
                    <thead>
                        <tr>
                            <th>المسجد</th><th>النطاق</th><th>الخطة / المبلغ</th><th>الإيصالات</th>
                            <th>الحالة</th><th>تاريخ الطلب</th><th />
                        </tr>
                    </thead>
                    <tbody>
                        {data.results.map((r) => (
                            <tr key={r.id} onClick={() => setSelectedId(r.id)} className="clickable">
                                <td>
                                    <strong>{r.mosque_name}</strong>
                                    <div className="pl-muted sm" dir="ltr">{r.contact_phone}</div>
                                </td>
                                <td dir="ltr">{r.subdomain}</td>
                                <td>{r.plan_name || '—'}{r.amount_usd ? <div className="pl-muted sm" dir="ltr">${r.amount_usd}</div> : null}</td>
                                <td>{r.receipts_count}</td>
                                <td><StatusBadge status={r.status} /></td>
                                <td className="pl-muted sm">{fmtDate(r.created_at)}</td>
                                <td><button type="button" className="pl-btn ghost sm">فتح</button></td>
                            </tr>
                        ))}
                        {!loading && data.results.length === 0 && (
                            <tr><td colSpan="7" className="pl-center pl-muted">لا توجد طلبات في هذا التصنيف</td></tr>
                        )}
                        {loading && (
                            <tr><td colSpan="7" className="pl-center pl-muted">جارٍ التحميل…</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination page={page} count={data.count} pageSize={20} onChange={setPage} />

            {selectedId && (
                <RequestDetail id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
            )}
        </section>
    );
};

/* ------------------------------------------------------------------ تفاصيل الطلب + إجراءات */
const RequestDetail = ({ id, onClose, onChanged }) => {
    const [req, setReq] = useState(null);
    const [error, setError] = useState('');
    const [viewing, setViewing] = useState(null);
    const [mode, setMode] = useState(null);           // 'approve' | 'reject' | null
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState('');

    const refresh = useCallback(async () => {
        try {
            const res = await getRegistration(id);
            setReq(res.data);
        } catch (err) {
            setError(extractApiError(err, 'تعذّر تحميل الطلب'));
        }
    }, [id]);

    useEffect(() => { refresh(); }, [refresh]);

    const run = async (label, fn) => {
        setBusy(label);
        setError('');
        try {
            await fn();
            setMode(null);
            setReason('');
        } catch (err) {
            setError(extractApiError(err, 'فشلت العملية'));
        } finally {
            setBusy('');
            await refresh();
            onChanged();
        }
    };

    const canReview = req && ['PENDING_APPROVAL'].includes(req.status);
    const canReject = req && ['PENDING_PAYMENT', 'PENDING_APPROVAL'].includes(req.status);
    const canRetry = req && ['PROVISIONING_FAILED', 'PROVISIONING'].includes(req.status);

    return (
        <PlatformModal title={req ? req.mosque_name : 'تفاصيل الطلب'} onClose={onClose} busy={!!busy} wide>
            {!req && !error && <div className="pl-center pl-muted">جارٍ التحميل…</div>}
            {error && <div className="pl-alert error" role="alert"><Warning size={16} /> {error}</div>}

            {req && (
                <>
                    <div className="pl-detail-grid">
                        <Info label="الحالة"><StatusBadge status={req.status} /></Info>
                        <Info label="المصدر">{SOURCE_LABEL[req.source] || req.source}</Info>
                        <Info label="النطاق"><span dir="ltr">{req.subdomain}.manarasy.com</span></Info>
                        <Info label="الهاتف"><span dir="ltr">{req.contact_phone}</span></Info>
                        <Info label="البريد"><span dir="ltr">{req.contact_email || '—'}</span></Info>
                        <Info label="الخطة / المبلغ">{req.plan_name || '—'} {req.amount_usd ? `($${req.amount_usd})` : ''}</Info>
                        <Info label="مدير المسجد"><span dir="ltr">{req.admin_username}</span></Info>
                        <Info label="أنشئ في">{fmtDate(req.created_at)}</Info>
                    </div>

                    {req.rejection_reason && <div className="pl-alert error"><strong>سبب الرفض:</strong> {req.rejection_reason}</div>}
                    {req.provisioning_error && (
                        <div className="pl-alert error"><strong>خطأ التجهيز (محاولة {req.provisioning_attempts}):</strong> {req.provisioning_error}</div>
                    )}

                    <h4 className="pl-h4">إيصالات الدفع ({req.receipts.length})</h4>
                    {req.receipts.length === 0 && <p className="pl-muted">لم يُرفع أي إيصال بعد.</p>}
                    <ul className="pl-receipts">
                        {req.receipts.map((rc) => (
                            <li key={rc.id}>
                                {rc.content_type === 'application/pdf' ? <FilePdf size={22} /> : <ImageIcon size={22} />}
                                <div className="grow">
                                    <strong>{rc.original_name}</strong>
                                    <div className="pl-muted sm">
                                        {(rc.size / 1024).toFixed(0)} KB · {fmtDate(rc.uploaded_at)}
                                        {rc.reference_number ? <> · رقم العملية: <span dir="ltr">{rc.reference_number}</span></> : null}
                                    </div>
                                </div>
                                <button type="button" className="pl-btn ghost sm" onClick={() => setViewing(rc)}>عرض</button>
                            </li>
                        ))}
                    </ul>

                    <h4 className="pl-h4">السجل</h4>
                    <ol className="pl-timeline">
                        {req.events.map((ev, i) => (
                            <li key={`${ev.created_at}-${i}`}>
                                <strong>{EVENT_LABEL[ev.action] || ev.action}</strong>
                                <span className="pl-muted sm"> — {ev.actor_label} · {fmtDate(ev.created_at)}</span>
                                {ev.detail && <div className="pl-muted sm">{ev.detail}</div>}
                            </li>
                        ))}
                    </ol>

                    <div className="pl-actions">
                        {canReview && (
                            <button type="button" className="pl-btn primary" disabled={!!busy} onClick={() => setMode('approve')}>
                                <CheckCircle size={18} /> موافقة وتجهيز المسجد
                            </button>
                        )}
                        {canRetry && (
                            <button type="button" className="pl-btn primary" disabled={!!busy}
                                onClick={() => run('retry', () => retryRegistration(req.id))}>
                                <ArrowsClockwise size={18} /> {busy === 'retry' ? 'جارٍ التجهيز…' : 'إعادة محاولة التجهيز'}
                            </button>
                        )}
                        {canReject && (
                            <button type="button" className="pl-btn danger" disabled={!!busy} onClick={() => setMode('reject')}>
                                <XCircle size={18} /> رفض
                            </button>
                        )}
                    </div>
                </>
            )}

            {viewing && <ReceiptViewer registrationId={id} receipt={viewing} onClose={() => setViewing(null)} />}

            {mode === 'approve' && (
                <PlatformModal
                    title="تأكيد الموافقة" busy={busy === 'approve'} onClose={() => setMode(null)}
                    footer={(
                        <>
                            <button type="button" className="pl-btn ghost" disabled={busy === 'approve'} onClick={() => setMode(null)}>إلغاء</button>
                            <button type="button" className="pl-btn primary" disabled={busy === 'approve'}
                                onClick={() => run('approve', () => approveRegistration(req.id))}>
                                {busy === 'approve' ? 'جارٍ إنشاء قاعدة البيانات…' : 'نعم، وافق وجهّز'}
                            </button>
                        </>
                    )}
                >
                    <p>سيتم إنشاء قاعدة بيانات مستقلة للمسجد <strong>{req?.mosque_name}</strong> وتطبيق الترحيلات وإنشاء حساب المدير وتفعيل الاشتراك.</p>
                    <p className="pl-muted">قد تستغرق العملية بضع دقائق. لا تُغلق النافذة حتى تنتهي.</p>
                    {req?.receipts.length === 0 && <div className="pl-alert error"><Warning size={16} /> لا يوجد إيصال مرفق.</div>}
                </PlatformModal>
            )}

            {mode === 'reject' && (
                <PlatformModal
                    title="رفض الطلب" busy={busy === 'reject'} onClose={() => setMode(null)}
                    footer={(
                        <>
                            <button type="button" className="pl-btn ghost" onClick={() => setMode(null)}>إلغاء</button>
                            <button type="button" className="pl-btn danger" disabled={busy === 'reject' || reason.trim().length < 5}
                                onClick={() => run('reject', () => rejectRegistration(req.id, reason.trim()))}>
                                {busy === 'reject' ? 'جارٍ الرفض…' : 'تأكيد الرفض'}
                            </button>
                        </>
                    )}
                >
                    <label className="pl-field">
                        <span>سبب الرفض (يظهر لمقدّم الطلب)</span>
                        <textarea rows="4" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
                            placeholder="مثال: الإشعار غير واضح أو المبلغ غير مطابق" />
                    </label>
                </PlatformModal>
            )}
        </PlatformModal>
    );
};

const Info = ({ label, children }) => (
    <div className="pl-info"><span className="pl-muted sm">{label}</span><div>{children}</div></div>
);

export default RegistrationRequests;
