import { useMemo } from 'react';

/**
 * useTenant — استخراج معرّف المسجد الحالي من النطاق الفرعي أو localStorage
 */
export const useTenant = () => {
    const subdomain = useMemo(() => {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
            return parts[0];
        }
        return localStorage.getItem('tenant_subdomain') || '';
    }, []);

    const tenantId = localStorage.getItem('tenant_id') || null;

    return { subdomain, tenantId };
};

export default useTenant;
