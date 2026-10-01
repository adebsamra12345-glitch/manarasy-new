import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';

/**
 * Modal — نافذة منبثقة قابلة لإعادة الاستخدام
 * Props: isOpen, onClose, title, children, size ('sm'|'md'|'lg')
 */
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    const overlayRef = useRef(null);

    // إغلاق عند الضغط على Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const widths = { sm: '400px', md: '600px', lg: '860px' };

    return (
        <div
            ref={overlayRef}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, padding: '1rem'
            }}
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div style={{
                background: '#fff', borderRadius: '16px', width: '100%',
                maxWidth: widths[size], maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid #eee'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{title}</h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}
                    >
                        <X size={20} />
                    </button>
                </div>
                {/* Body */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
