import React, { useState } from 'react';

/**
 * دالة مساعدة موثوقة لاستخراج الحروف الأولية من الاسم
 * تدعم الأسماء المركبة العربية والإنجليزية وأسماء المستخدمين (Usernames)
 */
export const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'م';
    const trimmed = name.trim();
    if (!trimmed) return 'م';

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const first = Array.from(parts[0])[0] || '';
        const second = Array.from(parts[1])[0] || '';
        return `${first}${second}`.toUpperCase();
    }

    const chars = Array.from(trimmed);
    if (chars.length === 1) return chars[0].toUpperCase();

    // للكلمات الإنجليزية (مثل manager) نعرض أول حرفين كبيرين (MA) أو الحرف الأول
    const isAscii = /^[\x00-\x7F]+$/.test(trimmed);
    if (isAscii && chars.length >= 2) {
        return (chars[0] + chars[1]).toUpperCase();
    }

    return chars[0].toUpperCase();
};

/**
 * مكون UserAvatar المستقل
 * يحل محل الخدمات الخارجية (مثل ui-avatars.com) بالكامل
 * - 0ms زمن استجابة (Zero Network Request)
 * - يدعم العمل دون اتصال بالإنترنت 100% (Offline-ready)
 * - حماية الخصوصية ومنع تسريب بيانات المستخدمين (No PII Leakage)
 * - دعم الـ Fallback التلقائي للأحرف الأولى عند تعذر تحميل الصورة المخصصة
 */
const UserAvatar = ({
    name = 'المستخدم',
    src = null,
    size = 40,
    background = '#1a5c1e',
    color = '#ffffff',
    className = '',
    style = {},
    alt = ''
}) => {
    const [imgFailed, setImgFailed] = useState(false);

    const initials = getInitials(name);
    const fontSize = Math.max(11, Math.floor(size * 0.4));

    if (src && !imgFailed) {
        return (
            <img
                src={src}
                alt={alt || name}
                width={size}
                height={size}
                onError={() => setImgFailed(true)}
                className={className}
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                    ...style
                }}
            />
        );
    }

    return (
        <div
            className={`user-avatar-initials ${className}`.trim()}
            title={name}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                minWidth: `${size}px`,
                minHeight: `${size}px`,
                borderRadius: '50%',
                backgroundColor: background,
                color: color,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: `${fontSize}px`,
                userSelect: 'none',
                letterSpacing: '0.5px',
                flexShrink: 0,
                lineHeight: 1,
                ...style
            }}
        >
            <span>{initials}</span>
        </div>
    );
};

export default UserAvatar;
