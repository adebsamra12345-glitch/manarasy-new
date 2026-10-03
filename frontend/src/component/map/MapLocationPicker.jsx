import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { MagnifyingGlass, Crosshair } from '@phosphor-icons/react';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';

// Fix for default marker icons in Leaflet when using Webpack/React
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Map Events component to handle clicks
function LocationSelector({ setPosition }) {
    useMapEvents({
        click(e) {
            setPosition(e.latlng);
        },
    });
    return null;
}

const MapLocationPicker = ({
    initialPosition,
    onLocationChange,
    height = '300px',
    placeholder = 'ابحث عن مدينة، حي، أو شارع...'
}) => {
    // Default position: Riyadh
    const DEFAULT_POS = [24.7136, 46.6753];
    
    const [position, setPosition] = useState(initialPosition ? [initialPosition.lat, initialPosition.lng] : null);
    const [mapCenter, setMapCenter] = useState(initialPosition ? [initialPosition.lat, initialPosition.lng] : DEFAULT_POS);
    const [address, setAddress] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loadingLocation, setLoadingLocation] = useState(false);
    
    const mapRef = useRef();

    // Reverse Geocoding: Get address from LatLng
    const fetchAddress = async (lat, lng) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ar`);
            const data = await response.json();
            
            if (data && data.display_name) {
                // Extract clean address parts
                const a = data.address || {};
                const city = a.city || a.town || a.village || a.county || '';
                const neighborhood = a.neighbourhood || a.suburb || '';
                const country = a.country || '';
                
                let formattedAddress = data.display_name;
                
                // Construct simpler address
                const parts = [neighborhood, city, country].filter(Boolean);
                if (parts.length > 0) {
                    formattedAddress = parts.join('، ');
                }

                setAddress(formattedAddress);
                if (onLocationChange) {
                    onLocationChange({ lat, lng, address: formattedAddress, rawAddressDetails: a });
                }
            } else {
                setAddress('موقع غير محدد');
                if (onLocationChange) {
                    onLocationChange({ lat, lng, address: 'موقع غير محدد', rawAddressDetails: {} });
                }
            }
        } catch (error) {
            console.error("Error doing reverse geocoding", error);
        }
    };

    // Forward Geocoding: Get LatLng from Address Search
    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (query.length > 2) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&accept-language=ar&limit=5`);
                const data = await response.json();
                setSearchResults(data);
            } catch (error) {
                console.error("Error doing forward geocoding", error);
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleSelectResult = (result) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setPosition({ lat, lng });
        setMapCenter({ lat, lng });
        setSearchQuery('');
        setSearchResults([]);
        fetchAddress(lat, lng);
        
        if (mapRef.current) {
            mapRef.current.setView([lat, lng], 14);
        }
    };

    const getCurrentLocation = () => {
        setLoadingLocation(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setPosition({ lat, lng });
                    setMapCenter({ lat, lng });
                    fetchAddress(lat, lng);
                    if (mapRef.current) {
                        mapRef.current.setView([lat, lng], 14);
                    }
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
        if (!initialPosition) {
            getCurrentLocation();
        } else {
            fetchAddress(initialPosition.lat, initialPosition.lng);
        }
    }, []);

    // When user clicks on map to set position
    const handlePositionChange = (latlng) => {
        setPosition(latlng);
        fetchAddress(latlng.lat, latlng.lng);
    };

    return (
        <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Search Bar */}
            <div style={{ position: 'relative', zIndex: 1000 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                        type="text" 
                        placeholder={placeholder}
                        value={searchQuery}
                        onChange={handleSearch}
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
                <MapContainer 
                    center={mapCenter} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                    ref={mapRef}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationSelector setPosition={handlePositionChange} />
                    {position && <Marker position={position} />}
                </MapContainer>
            </div>
        </div>
    );
};

export default MapLocationPicker;
