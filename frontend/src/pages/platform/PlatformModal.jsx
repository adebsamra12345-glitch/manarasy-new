import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';

/** نافذة منبثقة بسيطة: Esc للإغلاق، النقر على الخلفية للإغلاق (ما لم تكن busy) */
// مكدّس النوافذ المفتوحة: Esc يغلق العليا فقط
const openModals = [];

const PlatformModal = ({ title, onClose, busy = false, wide = false, children, footer }) => {
    const idRef = useRef(Symbol('modal'));

    useEffect(() => {
        const id = idRef.current;
        openModals.push(id);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            openModals.splice(openModals.indexOf(id), 1);
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && !busy && openModals[openModals.length - 1] === idRef.current) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, busy]);

    return (
        <div className="pl-modal-backdrop" onClick={() => !busy && onClose()}>
            <div
                className={`pl-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="pl-modal-head">
                    <h3>{title}</h3>
                    <button type="button" className="pl-icon-btn" onClick={onClose} disabled={busy} aria-label="إغلاق">
                        <X size={18} />
                    </button>
                </header>
                <div className="pl-modal-body">{children}</div>
                {footer && <footer className="pl-modal-foot">{footer}</footer>}
            </div>
        </div>
    );
};

export default PlatformModal;
