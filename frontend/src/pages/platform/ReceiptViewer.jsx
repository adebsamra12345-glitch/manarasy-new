import { useCallback, useEffect, useState } from 'react';
import {
    ArrowClockwise, DownloadSimple, MagnifyingGlassMinus, MagnifyingGlassPlus, Warning,
} from '@phosphor-icons/react';
import { fetchReceiptBlob } from '../../services/platformService';
import PlatformModal from './PlatformModal';

/**
 * معاينة إيصال الدفع: صورة (تكبير/تصغير/تدوير) أو PDF.
 * الملف يُجلب عبر طلب موثَّق كـ Blob ويُعرض من object URL — لا يوجد رابط عام للإيصال ولا توكن في الرابط.
 */
const ReceiptViewer = ({ registrationId, receipt, onClose }) => {
    const [state, setState] = useState({ loading: true, error: '', url: null, kind: null });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        let revoke = null;
        let cancelled = false;
        (async () => {
            try {
                const { blob, contentType } = await fetchReceiptBlob(registrationId, receipt.id);
                if (cancelled) return;
                const type = (contentType || blob.type || '').split(';')[0];
                const url = URL.createObjectURL(new Blob([blob], { type }));
                revoke = url;
                setState({ loading: false, error: '', url, kind: type === 'application/pdf' ? 'pdf' : 'image' });
            } catch {
                if (!cancelled) setState({ loading: false, error: 'تعذّر تحميل الإيصال', url: null, kind: null });
            }
        })();
        return () => {
            cancelled = true;
            if (revoke) URL.revokeObjectURL(revoke);
        };
    }, [registrationId, receipt.id]);

    const onWheel = useCallback((e) => {
        setZoom((z) => Math.min(5, Math.max(0.25, z + (e.deltaY < 0 ? 0.15 : -0.15))));
    }, []);

    return (
        <PlatformModal title={receipt.original_name} onClose={onClose} wide>
            {state.loading && <div className="pl-center pl-muted">جارٍ تحميل الإيصال…</div>}
            {state.error && <div className="pl-alert error"><Warning size={16} /> {state.error}</div>}

            {state.kind === 'image' && (
                <>
                    <div className="pl-viewer-tools">
                        <button type="button" className="pl-btn ghost sm" onClick={() => setZoom((z) => Math.min(5, z + 0.25))}><MagnifyingGlassPlus size={16} /> تكبير</button>
                        <button type="button" className="pl-btn ghost sm" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><MagnifyingGlassMinus size={16} /> تصغير</button>
                        <button type="button" className="pl-btn ghost sm" onClick={() => setRotation((r) => (r + 90) % 360)}><ArrowClockwise size={16} /> تدوير</button>
                        <button type="button" className="pl-btn ghost sm" onClick={() => { setZoom(1); setRotation(0); }}>إعادة ضبط</button>
                        <a className="pl-btn ghost sm" href={state.url} download={receipt.original_name}><DownloadSimple size={16} /> تنزيل</a>
                    </div>
                    <div className="pl-viewer-stage" onWheel={onWheel}>
                        <img
                            src={state.url} alt="إيصال الدفع" draggable={false}
                            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                        />
                    </div>
                </>
            )}

            {state.kind === 'pdf' && (
                <>
                    <div className="pl-viewer-tools">
                        <a className="pl-btn ghost sm" href={state.url} download={receipt.original_name}><DownloadSimple size={16} /> تنزيل</a>
                        <a className="pl-btn ghost sm" href={state.url} target="_blank" rel="noopener noreferrer">فتح في تبويب</a>
                    </div>
                    {/* عارض PDF المدمج للمتصفح (sandbox يعطّله في Chrome). المحتوى فُحص خادمياً (نوع + عدم وجود JS/Launch) */}
                    <iframe title="إيصال PDF" src={state.url} className="pl-viewer-pdf" referrerPolicy="no-referrer" />
                </>
            )}
        </PlatformModal>
    );
};

export default ReceiptViewer;
