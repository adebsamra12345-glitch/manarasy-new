import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { MobileTopbar, MobileNavbar } from './MobileNavbar';

const MainLayout = () => {
    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content">
                <MobileTopbar />
                <Outlet />
            </main>
            <MobileNavbar />
        </div>
    );
};

export default MainLayout;
