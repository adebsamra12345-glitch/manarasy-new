import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlass, Plus, Warning, Globe, Phone, CalendarCheck } from '@phosphor-icons/react';
import { listMosques } from '../../../services/platformService';
import { extractApiError } from '../../../services/api/registrationService';
import Pagination from '../../platform/Pagination';
import AddMosqueModal from '../../platform/AddMosqueModal';
import { fmtDate } from '../../platform/platformConstants';
import './mobilePlatform.css';

const MobileMosquesPage = () => {
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
        <div className="pl-m-page">
            <div className="pl-m-title-bar">
                <div>
                    <h1 className="pl-m-h1">المساجد</h1>
                    <p className="pl-m-subtitle">المساجد المسجلة وحالة الاشتراكات</p>
                </div>
            </div>

            {/* البحث */}
            <div className="pl-m-search-wrap">
                <MagnifyingGlass size={18} className="pl-m-search-icon" />
                <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="بحث باسم المسجد أو النطاق..."
                    className="pl-m-search-input"
                />
            </div>

            {error && (
                <div className="pl-m-alert error">
                    <Warning size={18} weight="fill" />
                    <span>{error}</span>
                </div>
            )}

            {/* بطاقات المساجد */}
            <div className="pl-m-cards-list">
                {data.results.map((m) => (
                    <div key={m.id} className="pl-m-card">
                        <div className="pl-m-card-header">
                            <div>
                                <h3 className="pl-m-card-title">{m.name}</h3>
                                <div className="pl-m-card-sub" dir="ltr">
                                    <Globe size={14} /> {m.subdomain}.manarasy.io
                                </div>
                            </div>
                            <span className={`pl-m-badge-status ${m.is_active ? 'green' : 'gray'}`}>
                                {m.is_active ? 'نشط' : 'غير نشط'}
                            </span>
                        </div>

                        <div className="pl-m-card-body">
                            <div className="pl-m-info-row">
                                <span className="pl-m-label">الهاتف:</span>
                                <span className="pl-m-val" dir="ltr">{m.contact_phone}</span>
                            </div>
                            <div className="pl-m-info-row">
                                <span className="pl-m-label">الخطة:</span>
                                <span className="pl-m-val">{m.plan || '—'}</span>
                            </div>
                            <div className="pl-m-info-row">
                                <span className="pl-m-label">الاشتراك:</span>
                                <span className="pl-m-val">{m.subscription_status || '—'}</span>
                            </div>
                            <div className="pl-m-info-row">
                                <span className="pl-m-label">ينتهي في:</span>
                                <span className="pl-m-val">{fmtDate(m.subscription_ends_at)}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {!loading && data.results.length === 0 && (
                    <div className="pl-m-empty-state">لا توجد مساجد مسجلة حالياً</div>
                )}
            </div>

            {/* الترقيم */}
            <div className="pl-m-pagination-wrap">
                <Pagination page={page} count={data.count} pageSize={20} onChange={setPage} />
            </div>

            {/* زر الإضافة العائم المريح للإبهام (FAB) */}
            <button
                type="button"
                className="pl-m-fab"
                onClick={() => setAdding(true)}
                aria-label="إضافة مسجد"
            >
                <Plus size={24} weight="bold" />
                <span>إضافة مسجد</span>
            </button>

            {/* ورقة إضافة المسجد */}
            {adding && <AddMosqueModal onClose={() => setAdding(false)} onCreated={load} />}

        </div>
    );
};

export default MobileMosquesPage;
