import React, { useState, useEffect, useRef } from 'react';
import { changePassword } from '../../services/api/userService';
import { X, LockKey } from '@phosphor-icons/react';
import './ChangePasswordModal.css';

const ChangePasswordModal = ({ isOpen, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const modalRef = useRef(null);
    const initialInputRef = useRef(null);

    // Escape key and Scroll lock
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
            
            // Focus first input
            setTimeout(() => {
                if (initialInputRef.current) {
                    initialInputRef.current.focus();
                }
            }, 100);
        } else {
            document.body.style.overflow = 'unset';
            // Reset state when closed
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setError('');
            setSuccess('');
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const handleOverlayClick = (e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            onClose();
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('يرجى تعبئة جميع الحقول');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('كلمة المرور الجديدة وتأكيدها لا يتطابقان');
            return;
        }

        if (newPassword.length < 6) {
            setError('يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل');
            return;
        }

        try {
            setLoading(true);
            const res = await changePassword({
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword
            });

            if (res.status === 'success') {
                setSuccess('تم تغيير كلمة المرور بنجاح');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => {
                    onClose();
                    setSuccess('');
                }, 2000);
            } else {
                setError(res.message || 'حدث خطأ أثناء تغيير كلمة المرور');
            }
        } catch (err) {
            console.error('Error changing password', err);
            setError(err.response?.data?.message || 'حدث خطأ أثناء الاتصال بالخادم');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content cp-modal" ref={modalRef}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>
                <div className="cp-header">
                    <div className="cp-icon-wrapper">
                        <LockKey size={32} weight="fill" />
                    </div>
                    <h2>تغيير كلمة المرور</h2>
                    <p>قم بإدخال كلمة المرور الحالية لاختيار كلمة مرور جديدة لحسابك</p>
                </div>

                <form onSubmit={handleSubmit} className="cp-form">
                    {error && <div className="cp-alert cp-error">{error}</div>}
                    {success && <div className="cp-alert cp-success">{success}</div>}

                    <div className="form-group">
                        <label>كلمة المرور الحالية</label>
                        <input
                            type="password"
                            ref={initialInputRef}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="أدخل كلمة المرور الحالية"
                            disabled={loading || success}
                        />
                    </div>
                    <div className="form-group">
                        <label>كلمة المرور الجديدة</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="أدخل كلمة المرور الجديدة"
                            disabled={loading || success}
                        />
                    </div>
                    <div className="form-group">
                        <label>تأكيد كلمة المرور الجديدة</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="أعد إدخال كلمة المرور الجديدة"
                            disabled={loading || success}
                        />
                    </div>

                    <div className="cp-actions">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading || success}>
                            إلغاء
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading || success}>
                            {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
