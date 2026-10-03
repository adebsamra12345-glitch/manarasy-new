import React from 'react';

/**
 * مكون BrandLogo - الشعار الرمزي لمنارة
 * يحل محل استدعاء صورة الحرف "م" من الخدمة الخارجية ui-avatars.com
 * يضمن ظهور الشعار فورياً بدون أي اتصالات شبكية أو أخطاء DNS
 */
export const BrandLogo = ({ size = 36, className = '', style = {} }) => {
    return (
        <div
            className={`manara-brand-emblem ${className}`.trim()}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                minWidth: `${size}px`,
                minHeight: `${size}px`,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1a5c1e 0%, #133315 100%)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: `${Math.round(size * 0.52)}px`,
                userSelect: 'none',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                border: '1.5px solid rgba(255,255,255,0.15)',
                lineHeight: 1,
                ...style
            }}
            title="شعار منارة"
            aria-label="شعار منارة"
        >
            <span>م</span>
        </div>
    );
};

export default BrandLogo;
