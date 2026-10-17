import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ArrowsClockwise, MagnifyingGlass, Warning, FilePdf,
    Image as ImageIcon, CheckCircle, XCircle, CaretLeft, X, Phone, Globe
} from '@phosphor-icons/react';
import {
    listRegistrations, getRegistration, approveRegistration,
    rejectRegistration, retryRegistration
} from '../../../services/platformService';
import { extractApiError } from '../../../services/api/registrationService';
import Pagination from '../../platform/Pagination';
import { FILTERS, STATUS_META, fmtDate } from '../../platform/platformConstants';
import MobileRequestDetailSheet from './MobileRequestDetailSheet';
import './mobilePlatform.css';

export const MobileStatusBadge = ({ status }) => {
    const meta = STATUS_META[status] || { label: status, tone: 'gray' };
    return <span className={`pl-m-badge-status ${meta.tone}`}>{meta.label}</span>;
};

const MobileRegistrationRequests = () => {
    const [filter, setFilter] = useState('PENDING_APPROVAL');
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ results: [], count: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [q]);

    const reqSeq = useRef(0);
    const load = useCallback(async () => {
        const seq = ++reqSeq.current;
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
        <div className="pl-m-page">
            {/* عنوان الصفحة وزر التحديث */}
            <div className="pl-m-title-bar">
                <div>
                    <h1 className="pl-m-h1">طلبات التسجيل</h1>
                    <p className="pl-m-subtitle">إدارة ومراجعة طلبات الانضمام للمنصة</p>
                </div>
                <button
                    type="button"
                    className="pl-m-icon-action"
                    onClick={load}
                    disabled={loading}
                    aria-label="تحديث"
                >
                    <ArrowsClockwise size={20} className={loading ? 'pl-m-spin' : ''} />
                </button>
            </div>

            {/* حقل البحث المتجاوب */}
            <div className="pl-m-search-wrap">
                <MagnifyingGlass size={18} className="pl-m-search-icon" />
                <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="بحث باسم المسجد، النطاق، أو الهاتف..."
                    className="pl-m-search-input"
                />
                {q && (
                    <button type="button" className="pl-m-clear-btn" onClick={() => setQ('')}>
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* شريط الفلاتر الأفقي */}
            <div className="pl-m-chips-container" role="tablist">
                {FILTERS.map((f) => (
                    <button
                        key={f.key || 'all'}
                        role="tab"
                        aria-selected={filter === f.key}
                        className={`pl-m-chip ${filter === f.key ? 'active' : ''}`}
                        onClick={() => { setFilter(f.key); setPage(1); }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="pl-m-alert error">
                    <Warning size={18} weight="fill" />
                    <span>{error}</span>
                </div>
            )}

            {/* قائمة البطاقات العمودية */}
            <div className="pl-m-cards-list">
                {data.results.map((r) => (
                    <div
                        key={r.id}
                        className="pl-m-card"
                        onClick={() => setSelectedId(r.id)}
                    >
                        <div className="pl-m-card-header">
                            <div>
                                <h3 className="pl-m-card-title">{r.mosque_name}</h3>
                                <div className="pl-m-card-sub" dir="ltr">
                                    <Globe size={14} /> {r.subdomain}.manarasy.io
                                </div>
                            </div>
                            <MobileStatusBadge status={r.status} />
                        </div>

                        <div className="pl-m-card-body">
                            <div className="pl-m-info-row">
                                <span className="pl-m-label">الهاتف:</span>
                                <span className="pl-m-val" dir="ltr">{r.contact_phone}</span>
                            </div>
                            <div className="pl-m-info-row">
                                <span className="pl-m-label">الخطة:</span>
                                <span className="pl-m-val">
                                    {r.plan_name || '—'}
                                    {r.amount_usd ? ` ($${r.amount_usd})` : ''}
                                </span>
                            </div>
                            <div className="pl-m-info-row">
                                <span className="pl-m-label">الإيصالات:</span>
                                <span className="pl-m-val-badge">
                                    {r.receipts_count > 0 ? `${r.receipts_count} إيصال` : 'لا يوجد'}
                                </span>
                            </div>
                        </div>

                        <div className="pl-m-card-footer">
                            <span className="pl-m-card-date">{fmtDate(r.created_at)}</span>
                            <span className="pl-m-card-action">
                                مراجعة الطلب <CaretLeft size={16} weight="bold" />
                            </span>
                        </div>
                    </div>
                ))}

                {!loading && data.results.length === 0 && (
                    <div className="pl-m-empty-state">
                        <p>لا توجد طلبات تسجيل تطابق هذا التصنيف</p>
                    </div>
                )}

                {loading && (
                    <div className="pl-m-loading-state">
                        <div className="pl-m-spinner"></div>
                        <span>جارٍ تحميل الطلبات…</span>
                    </div>
                )}
            </div>

            {/* الترقيم السفلي */}
            <div className="pl-m-pagination-wrap">
                <Pagination page={page} count={data.count} pageSize={20} onChange={setPage} />
            </div>

            {/* ورقة تفاصيل الطلب السفلية المنزلقة */}
            {selectedId && (
                <MobileRequestDetailSheet
                    id={selectedId}
                    onClose={() => setSelectedId(null)}
                    onChanged={load}
                />
            )}
        </div>
    );
};

export default MobileRegistrationRequests;
