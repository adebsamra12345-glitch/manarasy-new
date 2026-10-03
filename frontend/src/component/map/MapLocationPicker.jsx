import React, { useState, useEffect, useRef, Suspense, lazy, useCallback } from 'react';
import { MagnifyingGlass, Crosshair } from '@phosphor-icons/react';

// Lazy load Leaflet components to avoid including them in the main bundle
const LeafletMap = lazy(() => import('./LeafletMap'));

// Debounce hook
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

const MapLocationPicker = ({
    initialPosition,
    onLocationChange,
    height = '300px',
    placeholder = 'ابحث عن مدينة، حي، أو شارع...',
    mode = 'picker' // 'picker' or 'view'
}) => {
    // Default position: Center of Syria [34.8, 38.9]
    const DEFAULT_POS = [34.8, 38.9];
    
    const [position, setPosition] = useState(initialPosition ? {lat: initialPosition.lat, lng: initialPosition.lng} : null);
    const [mapCenter, setMapCenter] = useState(initialPosition ? [initialPosition.lat, initialPosition.lng] : DEFAULT_POS);
    const [address, setAddress] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loadingLocation, setLoadingLocation] = useState(false);
    
    const mapRef = useRef();
    const isViewMode = mode === 'view';

    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // Reverse Geocoding: Get address from LatLng via Backend
    const fetchAddress = async (lat, lng) => {
        try {
            const response = await fetch(`http://localhost:8000/api/geodata/reverse/?lat=${lat}&lon=${lng}`);
            const data = await response.json();
            
            if (data && data.display_name) {
                const a = data.address || {};
                const city = a.city || a.town || a.village || a.county || '';
                const neighborhood = a.neighbourhood || a.suburb || '';
                const country = a.country || '';
                
                let formattedAddress = data.display_name;
                const parts = [neighborhood, city, country].filter(Boolean);
                if (parts.length > 0) {
                    formattedAddress = parts.join('، ');
                }

                setAddress(formattedAddress);
                if (onLocationChange && !isViewMode) {
                    onLocationChange({ lat, lng, address: formattedAddress, rawAddressDetails: a });
                }
            } else {
                setAddress('موقع غير محدد');
                if (onLocationChange && !isViewMode) {
                    onLocationChange({ lat, lng, address: 'موقع غير محدد', rawAddressDetails: {} });
                }
            }
        } catch (error) {
            console.error("Error doing reverse geocoding via backend", error);
        }
    };

    // Forward Geocoding: Get LatLng from Address Search via Backend
    useEffect(() => {
        const handleSearch = async () => {
            if (debouncedSearchQuery.length > 2) {
                try {
                    const response = await fetch(`http://localhost:8000/api/geodata/geocode/?query=${encodeURIComponent(debouncedSearchQuery)}`);
                    const data = await response.json();
                    setSearchResults(data);
                } catch (error) {
                    console.error("Error doing forward geocoding via backend", error);
                }
            } else {
                setSearchResults([]);
            }
        };
        if (!isViewMode) handleSearch();
    }, [debouncedSearchQuery, isViewMode]);

    const handleSelectResult = (result) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setPosition({ lat, lng });
        setMapCenter([lat, lng]);
        setSearchQuery('');
        setSearchResults([]);
        fetchAddress(lat, lng);
    };

    const getCurrentLocation = () => {
        setLoadingLocation(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setPosition({ lat, lng });
                    setMapCenter([lat, lng]);
                    fetchAddress(lat, lng);
                    setLoadingLocation(false);
                },
                (error) => {
                    console.error("Error getting location", error);
                    setLoadingLocation(false);
                }
            );
        } else {
            setLoadingLocation(false);
        }
    };

    useEffect(() => {
        if (!initialPosition && !isViewMode) {
            getCurrentLocation();
        } else if (initialPosition) {
            fetchAddress(initialPosition.lat, initialPosition.lng);
            setMapCenter([initialPosition.lat, initialPosition.lng]);
        }
    }, []);

    const handlePositionChange = useCallback((latlng) => {
        if (isViewMode) return;
        setPosition(latlng);
        fetchAddress(latlng.lat, latlng.lng);
    }, [isViewMode]);

    return (
        <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Search Bar (Only in Picker mode) */}
            {!isViewMode && (
                <div style={{ position: 'relative', zIndex: 1000 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                            type="text" 
                            placeholder={placeholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 40px 10px 15px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e0',
                                fontSize: '0.95rem',
                                outline: 'none',
                            }}
                        />
                        <MagnifyingGlass 
                            size={20} 
                            color="#a0aec0" 
                            style={{ position: 'absolute', right: '10px' }} 
                        />
                        <button 
                            type="button"
                            onClick={getCurrentLocation}
                            title="موقعي الحالي"
                            disabled={loadingLocation}
                            style={{
                                position: 'absolute',
                                left: '5px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '5px',
                                color: loadingLocation ? '#cbd5e0' : '#4a5568'
                            }}
                        >
                            <Crosshair size={22} />
                        </button>
                    </div>

                    {/* Autocomplete Dropdown */}
                    {searchResults.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            left: 0,
                            background: '#fff',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            borderRadius: '8px',
                            marginTop: '5px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1001,
                            border: '1px solid #e2e8f0'
                        }}>
                            {searchResults.map((res, i) => (
                                <div 
                                    key={i}
                                    onClick={() => handleSelectResult(res)}
                                    style={{
                                        padding: '10px 15px',
                                        borderBottom: '1px solid #f1f5f9',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        color: '#2d3748',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                >
                                    {res.display_name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Display Currently Selected Address */}
            {address && (
                <div style={{
                    padding: '10px',
                    background: '#edf7ed',
                    color: '#2f855a',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span style={{flex: 1}}>{address}</span>
                </div>
            )}

            {/* Map */}
            <div style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <Suspense fallback={<div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>جاري تحميل الخريطة...</div>}>
                    <LeafletMap 
                        center={mapCenter}
                        position={position}
                        onPositionChange={handlePositionChange}
                        readOnly={isViewMode}
                        mapRef={mapRef}
                    />
                </Suspense>
            </div>
        </div>
    );
};

export default MapLocationPicker;
