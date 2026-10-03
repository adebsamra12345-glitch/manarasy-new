import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

function LocationSelector({ setPosition, readOnly }) {
    useMapEvents({
        click(e) {
            if (!readOnly && setPosition) {
                setPosition(e.latlng);
            }
        },
    });
    return null;
}

const LeafletMap = ({ center, position, onPositionChange, readOnly, mapRef }) => {
    useEffect(() => {
        if (mapRef && mapRef.current && center) {
            mapRef.current.setView(center, 14);
        }
    }, [center, mapRef]);

    return (
        <MapContainer 
            center={center} 
            zoom={13} 
            style={{ height: '100%', width: '100%', zIndex: 1 }}
            ref={mapRef}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {!readOnly && <LocationSelector setPosition={onPositionChange} readOnly={readOnly} />}
            {position && <Marker position={position} interactive={!readOnly} />}
        </MapContainer>
    );
};

export default LeafletMap;
