import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Copy, Check, MagnifyingGlassPlus, X, UploadSimple, FilePdf, Trash, Warning, ShieldCheck,
} from '@phosphor-icons/react';
import { useNotification } from '../../../context/NotificationContext';
import { RECEIPT_ACCEPT, formatBytes, validateReceiptFile } from '../../../utils/receiptValidation';
// ↓↓↓ استبدل الصورة بملف رمز QR الحقيقي (نفس المسار والاسم) ↓↓↓
import shamCashQrCode from '@/assets/images/sham-cash-qr.png';
import './ShamCashPayment.css';

// ↓↓↓ ضع رقم حساب شام كاش الحقيقي هنا ↓↓↓
export const SHAM_CASH_ACCOUNT_NUMBER = 'ENTER_SHAM_CASH_NUMBER_HERE';

const isPlaceholderAccount = SHAM_CASH_ACCOUNT_NUMBER.startsWith('ENTER_');

/**
 * ShamCashPayment — مكوّن مضبوط (controlled): الأب يملك الملف المختار ويرسله عند الإرسال.
 *
 * Props:
 *  - amount        : مبلغ الاشتراك (USD) للعرض
 *  - planName      : اسم الخطة للعرض
 *  - file          : File | null
 *  - onFileChange  : (File | null) => void
 *  - reference     : رقم عملية شام كاش (اختياري)
 *  - onReferenceChange : (string) => void
 *  - uploadProgress: 0-100 أثناء الرفع (اختياري)
 *  - disabled      : يعطّل التفاعل أثناء الإرسال
 */
const ShamCashPayment = ({
    amount, planName, file, onFileChange, reference, onReferenceChange, uploadProgress = null, disabled = false,
}) => {
    const { addNotification } = useNotification();
    const [copied, setCopied] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);
    const [fileError, setFileError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const inputRef = useRef(null);

    // معاينة الصورة المختارة + تحرير الـ object URL عند التغيير/الإزالة (منع تسرّب الذاكرة)
    useEffect(() => {
        if (file && file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setPreviewUrl(null);
        return undefined;
    }, [file]);

    // إغلاق نافذة QR بـ Esc
    useEffect(() => {
        if (!qrOpen) return undefined;
        const onKey = (e) => e.key === 'Escape' && setQrOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [qrOpen]);

    const copyAccount = useCallback(async () => {
        if (isPlaceholderAccount) {
            addNotification('رقم الحساب لم يُضبط بعد — حدّث SHAM_CASH_ACCOUNT_NUMBER', 'error');
            return;
        }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(SHAM_CASH_ACCOUNT_NUMBER);
            } else {
                // بديل للمتصفحات/السياقات غير الآمنة (http)
                const ta = document.createElement('textarea');
                ta.value = SHAM_CASH_ACCOUNT_NUMBER;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (!ok) throw new Error('copy failed');
            }
            setCopied(true);
            addNotification('تم نسخ رقم الحساب', 'success');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            addNotification('تعذّر النسخ، انسخ الرقم يدوياً', 'error');
        }
    }, [addNotification]);

    const acceptFile = useCallback(async (picked) => {
        if (!picked) return;
        const err = await validateReceiptFile(picked);
        if (err) {
            setFileError(err);
            onFileChange(null);
            return;
        }
        setFileError('');
        onFileChange(picked);
    }, [onFileChange]);

    const onInputChange = (e) => {
        acceptFile(e.target.files?.[0]);
        e.target.value = '';            // يسمح باختيار نفس الملف مرة أخرى بعد إزالته
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        acceptFile(e.dataTransfer.files?.[0]);
    };

    const removeFile = () => {
        setFileError('');
        onFileChange(null);
    };

    return (
        <div className="scp" dir="rtl">
            <div className="scp-brand">
                <div className="scp-logo" aria-hidden="true">SC</div>
                <div>
                    <strong>الدفع عبر شام كاش</strong>
                    <p>حوّل المبلغ ثم ارفع إشعار التحويل ليتم تفعيل مسجدك بعد المراجعة</p>
                </div>
            </div>

            <div className="scp-amount">
                <span>المبلغ المطلوب{planName ? ` — ${planName}` : ''}</span>
                <strong dir="ltr">${amount}</strong>
            </div>

            <div className="scp-grid">
                {/* رقم الحساب + QR */}
                <section className="scp-box" aria-labelledby="scp-account-title">
                    <h4 id="scp-account-title">1) حوّل المبلغ إلى الحساب التالي</h4>

                    <div className="scp-account">
                        <span className="scp-account-label">رقم حساب شام كاش</span>
                        <div className="scp-account-row">
                            <code dir="ltr" className={isPlaceholderAccount ? 'scp-placeholder' : ''}>
                                {SHAM_CASH_ACCOUNT_NUMBER}
                            </code>
                            <button
                                type="button" className={`scp-copy ${copied ? 'done' : ''}`}
                                onClick={copyAccount} aria-label="نسخ رقم الحساب"
                            >
                                {copied ? <Check size={18} weight="bold" /> : <Copy size={18} />}
                                {copied ? 'تم النسخ' : 'نسخ'}
                            </button>
                        </div>
                    </div>

                    <div className="scp-qr-wrap">
                        <button
                            type="button" className="scp-qr-btn" onClick={() => setQrOpen(true)}
                            aria-label="تكبير رمز الاستجابة السريعة"
                        >
                            <img src={shamCashQrCode} alt="رمز QR لحساب شام كاش" className="scp-qr" width="168" height="168" />
                            <span className="scp-qr-zoom"><MagnifyingGlassPlus size={16} /> اضغط للتكبير</span>
                        </button>
                        <p className="scp-hint">أو امسح الرمز من تطبيق شام كاش</p>
                    </div>
                </section>

                {/* رفع الإشعار */}
                <section className="scp-box" aria-labelledby="scp-upload-title">
                    <h4 id="scp-upload-title">2) ارفع إشعار (إيصال) التحويل</h4>

                    {!file ? (
                        <div
                            className={`scp-drop ${dragOver ? 'over' : ''} ${disabled ? 'disabled' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={onDrop}
                            onClick={() => !disabled && inputRef.current?.click()}
                            role="button" tabIndex={0}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && inputRef.current?.click()}
                        >
                            <UploadSimple size={32} weight="duotone" />
                            <strong>اسحب الملف هنا أو اضغط للاختيار</strong>
                            <span>PNG · JPG · WEBP · PDF — حتى 5 ميغابايت</span>
                        </div>
                    ) : (
                        <div className="scp-file">
                            {previewUrl
                                ? <img src={previewUrl} alt="معاينة الإشعار" className="scp-thumb" />
                                : <div className="scp-thumb pdf"><FilePdf size={36} weight="duotone" /></div>}
                            <div className="scp-file-meta">
                                <strong title={file.name}>{file.name}</strong>
                                <span>{formatBytes(file.size)}</span>
                                {uploadProgress !== null && (
                                    <div className="scp-progress" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100">
                                        <div style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                )}
                            </div>
                            <button type="button" className="scp-remove" onClick={removeFile} disabled={disabled} aria-label="إزالة الملف">
                                <Trash size={18} />
                            </button>
                        </div>
                    )}

                    <input
                        ref={inputRef} type="file" accept={RECEIPT_ACCEPT} onChange={onInputChange}
                        hidden disabled={disabled} data-testid="receipt-input"
                    />

                    {fileError && (
                        <div className="scp-error" role="alert"><Warning size={16} /> {fileError}</div>
                    )}

                    <label className="scp-ref">
                        <span>رقم العملية (اختياري)</span>
                        <input
                            type="text" dir="ltr" maxLength={60} value={reference} disabled={disabled}
                            onChange={(e) => onReferenceChange(e.target.value)} placeholder="مثال: 1234567890"
                        />
                    </label>
                </section>
            </div>

            <p className="scp-secure">
                <ShieldCheck size={16} /> يُحفظ الإشعار في مخزن خاص ولا يطّلع عليه إلا أدمن المنصة. لا نطلب بيانات بطاقات مصرفية.
            </p>

            {qrOpen && (
                <div className="scp-modal" role="dialog" aria-modal="true" aria-label="رمز QR" onClick={() => setQrOpen(false)}>
                    <div className="scp-modal-body" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="scp-modal-close" onClick={() => setQrOpen(false)} aria-label="إغلاق">
                            <X size={20} />
                        </button>
                        <img src={shamCashQrCode} alt="رمز QR لحساب شام كاش" />
                        <code dir="ltr">{SHAM_CASH_ACCOUNT_NUMBER}</code>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShamCashPayment;
