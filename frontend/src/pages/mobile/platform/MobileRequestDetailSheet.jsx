import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Warning, CheckCircle, XCircle, ArrowsClockwise,
    FilePdf, Image as ImageIcon, CaretDown
} from '@phosphor-icons/react';
import {
    getRegistration, approveRegistration, rejectRegistration, retryRegistration
} from '../../../services/platformService';
import { extractApiError } from '../../../services/api/registrationService';
import ReceiptViewer from '../../platform/ReceiptViewer';
import { MobileStatusBadge } from './MobileRegistrationRequests';
import { EVENT_LABEL, SOURCE_LABEL, fmtDate } from '../../platform/platformConstants';
import './mobilePlatform.css';

const MobileRequestDetailSheet = ({ id, onClose, onChanged }) => {
    const [req, setReq] = useState(null);
    const [error, setError] = useState('');
    const [viewing, setViewing] = useState(null);
    const [mode, setMode] = useState(null); // 'approve' | 'reject' | null
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState('');

    const refresh = useCallback(async () => {
        try {
            const res = await getRegistration(id);
            setReq(res.data);
        } catch (err) {
            setError(extractApiError(err, 'تعذّر تحميل تفاصيل الطلب'));
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
        <div className="pl-m-sheet-backdrop" onClick={onClose}>
            <div className="pl-m-sheet" onClick={(e) => e.stopPropagation()}>
                {/* مقبض السحب ورأس الورقة */}
                <div className="pl-m-sheet-handle"></div>
                <div className="pl-m-sheet-header">
                    <div>
                        <h2 className="pl-m-sheet-title">{req ? req.mosque_name : 'تفاصيل الطلب'}</h2>
                        {req && <div className="pl-m-sheet-sub" dir="ltr">{req.subdomain}.manarasy.io</div>}
                    </div>
                    <button type="button" className="pl-m-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* جسم الورقة القابل للتمرير */}
                <div className="pl-m-sheet-body">
                    {error && (
                        <div className="pl-m-alert error">
                            <Warning size={18} weight="fill" />
                            <span>{error}</span>
                        </div>
                    )}

                    {!req && !error && (
                        <div className="pl-m-loading-state">
                            <div className="pl-m-spinner"></div>
                            <span>جارٍ جلب البيانات…</span>
                        </div>
                    )}

                    {req && (
                        <>
                            {/* شبكة المعلومات المنسقة طولياً */}
                            <div className="pl-m-details-box">
                                <div className="pl-m-detail-item">
                                    <span className="pl-m-detail-lbl">الحالة</span>
                                    <div><MobileStatusBadge status={req.status} /></div>
                                </div>
                                <div className="pl-m-detail-item">
                                    <span className="pl-m-detail-lbl">المصدر</span>
                                    <span className="pl-m-detail-val">{SOURCE_LABEL[req.source] || req.source}</span>
                                </div>
                                <div className="pl-m-detail-item">
                                    <span className="pl-m-detail-lbl">هاتف المسؤول</span>
                                    <a href={`tel:${req.contact_phone}`} className="pl-m-phone-link" dir="ltr">
                                        {req.contact_phone}
                                    </a>
                                </div>
                                <div className="pl-m-detail-item">
                                    <span className="pl-m-detail-lbl">البريد الإلكتروني</span>
                                    <span className="pl-m-detail-val" dir="ltr">{req.contact_email || '—'}</span>
                                </div>
                                <div className="pl-m-detail-item">
                                    <span className="pl-m-detail-lbl">الخطة والمبلغ</span>
                                    <span className="pl-m-detail-val">
                                        {req.plan_name || '—'} {req.amount_usd ? `($${req.amount_usd})` : ''}
                                    </span>
                                </div>
                                <div className="pl-m-detail-item">
                                    <span className="pl-m-detail-lbl">اسم مستخدم المدير</span>
                                    <span className="pl-m-detail-val font-mono" dir="ltr">{req.admin_username}</span>
                                </div>
                                <div className="pl-m-detail-item">
                                    <span className="pl-m-detail-lbl">تاريخ الطلب</span>
                                    <span className="pl-m-detail-val">{fmtDate(req.created_at)}</span>
                                </div>
                            </div>

                            {/* تنبيهات الرفض أو الخطأ */}
                            {req.rejection_reason && (
                                <div className="pl-m-alert error">
                                    <strong>سبب الرفض: </strong> {req.rejection_reason}
                                </div>
                            )}
                            {req.provisioning_error && (
                                <div className="pl-m-alert error">
                                    <strong>خطأ التجهيز ({req.provisioning_attempts}): </strong>
                                    {req.provisioning_error}
                                </div>
                            )}

                            {/* قسم إيصالات الدفع */}
                            <div className="pl-m-section">
                                <h3 className="pl-m-section-title">إيصالات الدفع ({req.receipts.length})</h3>
                                {req.receipts.length === 0 ? (
                                    <p className="pl-m-muted">لم يُرفع أي إيصال لهذا الطلب.</p>
                                ) : (
                                    <div className="pl-m-receipts-list">
                                        {req.receipts.map((rc) => (
                                            <div key={rc.id} className="pl-m-receipt-card" onClick={() => setViewing(rc)}>
                                                <div className="pl-m-receipt-icon">
                                                    {rc.content_type === 'application/pdf' ? <FilePdf size={24} /> : <ImageIcon size={24} />}
                                                </div>
                                                <div className="pl-m-receipt-info">
                                                    <strong className="pl-m-receipt-name">{rc.original_name}</strong>
                                                    <span className="pl-m-receipt-meta">
                                                        {(rc.size / 1024).toFixed(0)} KB · {fmtDate(rc.uploaded_at)}
                                                    </span>
                                                    {rc.reference_number && (
                                                        <span className="pl-m-receipt-ref">رقم العملية: {rc.reference_number}</span>
                                                    )}
                                                </div>
                                                <button type="button" className="pl-m-btn-view">معاينة</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* السجل الزمني للأحداث */}
                            <div className="pl-m-section">
                                <h3 className="pl-m-section-title">السجل الزمني</h3>
                                <div className="pl-m-timeline">
                                    {req.events.map((ev, i) => (
                                        <div key={`${ev.created_at}-${i}`} className="pl-m-timeline-node">
                                            <div className="pl-m-timeline-dot"></div>
                                            <div className="pl-m-timeline-content">
                                                <strong>{EVENT_LABEL[ev.action] || ev.action}</strong>
                                                <span className="pl-m-timeline-meta">
                                                    {ev.actor_label} · {fmtDate(ev.created_at)}
                                                </span>
                                                {ev.detail && <p className="pl-m-timeline-desc">{ev.detail}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* الشريط السفلي الثابت للأزرار التفاعلية */}
                {req && (
                    <div className="pl-m-sheet-sticky-footer">
                        {canReview && (
                            <button
                                type="button"
                                className="pl-m-btn primary full"
                                disabled={!!busy}
                                onClick={() => setMode('approve')}
                            >
                                <CheckCircle size={20} weight="bold" /> موافقة وتجهيز المسجد
                            </button>
                        )}
                        {canRetry && (
                            <button
                                type="button"
                                className="pl-m-btn warning full"
                                disabled={!!busy}
                                onClick={() => run('retry', () => retryRegistration(req.id))}
                            >
                                <ArrowsClockwise size={20} weight="bold" />
                                {busy === 'retry' ? 'جارٍ التجهيز…' : 'إعادة محاولة التجهيز'}
                            </button>
                        )}
                        {canReject && (
                            <button
                                type="button"
                                className="pl-m-btn danger full"
                                disabled={!!busy}
                                onClick={() => setMode('reject')}
                            >
                                <XCircle size={20} weight="bold" /> رفض الطلب
                            </button>
                        )}
                    </div>
                )}

                {/* نوافذ التأكيد السفلية (Approve / Reject) */}
                {mode === 'approve' && (
                    <div className="pl-m-nested-modal-backdrop">
                        <div className="pl-m-nested-modal">
                            <h3>تأكيد الموافقة على المسجد</h3>
                            <p>سيتم إنشاء قاعدة بيانات مستقلة للمسجد وتطبيق الترحيلات وتعيين المدير.</p>
                            <div className="pl-m-nested-actions">
                                <button type="button" className="pl-m-btn ghost" onClick={() => setMode(null)}>إلغاء</button>
                                <button
                                    type="button"
                                    className="pl-m-btn primary"
                                    disabled={busy === 'approve'}
                                    onClick={() => run('approve', () => approveRegistration(req.id))}
                                >
                                    {busy === 'approve' ? 'جارٍ الإنشاء…' : 'تأكيد وتجهيز'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'reject' && (
                    <div className="pl-m-nested-modal-backdrop">
                        <div className="pl-m-nested-modal">
                            <h3>سبب رفض الطلب</h3>
                            <textarea
                                rows="3"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="اكتب سبب الرفض لمقدم الطلب..."
                                className="pl-m-input"
                            />
                            <div className="pl-m-nested-actions">
                                <button type="button" className="pl-m-btn ghost" onClick={() => setMode(null)}>إلغاء</button>
                                <button
                                    type="button"
                                    className="pl-m-btn danger"
                                    disabled={busy === 'reject' || reason.trim().length < 5}
                                    onClick={() => run('reject', () => rejectRegistration(req.id, reason.trim()))}
                                >
                                    {busy === 'reject' ? 'جارٍ الرفض…' : 'تأكيد الرفض'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* عارض الإيصال */}
                {viewing && (
                    <ReceiptViewer
                        registrationId={id}
                        receipt={viewing}
                        onClose={() => setViewing(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default MobileRequestDetailSheet;
