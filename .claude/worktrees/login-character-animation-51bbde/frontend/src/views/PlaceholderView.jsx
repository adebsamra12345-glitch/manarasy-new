import React from 'react';

const PlaceholderView = ({ title }) => {
    return (
        <div className="dashboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', color: '#888' }}>
                <h2>{title}</h2>
                <p>هذه الواجهة قيد التطوير...</p>
            </div>
        </div>
    );
};

export default PlaceholderView;
