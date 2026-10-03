import React from 'react';
import './LoadingScreen.css';

/**
 * LoadingScreen Component
 * 
 * شاشة تحميل موحدة، تدعم إمكانية الوصول وتستخدم شعار المنصة.
 * 
 * @param {Object} props
 * @param {boolean} [props.fullScreen=true] - هل يجب أن تغطي شاشة التحميل الشاشة بالكامل.
 * @param {string} [props.text="جاري التحميل..."] - النص الذي يظهر أسفل الشعار.
 */
const LoadingScreen = ({ fullScreen = true, text = "جاري التحميل..." }) => {
    return (
        <div 
            className={`loading-container ${fullScreen ? 'fullscreen' : 'inline'}`}
            role="status"
            aria-live="polite"
            aria-label="جاري تحميل المنصة"
            dir="rtl"
        >
            <div className="loading-content">
                <div className="loading-logo-wrapper">
                    {/* Official Manarasy Logo (favicon.svg used as fallback) */}
                    <img 
                        src="/favicon.svg" 
                        alt="منارة" 
                        className="loading-logo"
                    />
                </div>
                <p className="loading-text">
                    {text}
                </p>
            </div>
        </div>
    );
};

export default LoadingScreen;
