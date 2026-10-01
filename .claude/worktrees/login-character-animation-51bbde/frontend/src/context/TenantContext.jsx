import { createContext, useContext, useState, useEffect } from 'react';

const TenantContext = createContext(null);

export const TenantProvider = ({ children }) => {
    const [tenantId, setTenantId] = useState(localStorage.getItem('tenant_id') || null);
    const [tenantInfo, setTenantInfo] = useState(null);

    const subdomain = (() => {
        const parts = window.location.hostname.split('.');
        return parts.length >= 2 && parts[0] !== 'www' ? parts[0] : '';
    })();

    return (
        <TenantContext.Provider value={{ tenantId, setTenantId, tenantInfo, setTenantInfo, subdomain }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenantContext = () => {
    const ctx = useContext(TenantContext);
    if (!ctx) throw new Error('useTenantContext must be used within TenantProvider');
    return ctx;
};

export default TenantContext;
