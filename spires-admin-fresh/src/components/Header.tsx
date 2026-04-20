// Header.tsx
import React from 'react';
import { Car, Bell, Clock } from 'lucide-react';

interface HeaderProps {
  activeDriversCount: number;
  availableVehiclesCount: number;
  pendingCustomerBookingsCount: number;
  upcomingSoonCount: number;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  activeDriversCount, 
  availableVehiclesCount, 
  pendingCustomerBookingsCount,
  upcomingSoonCount,
  onLogout
}) => {
  return (
    <header className="admin-header">
      <div className="admin-header-content">
        <div className="admin-header-left">
          <Car className="h-8 w-8" style={{ color: '#fff' }} />
          <div>
            <h1 className="admin-header-title">Spires Taxis Admin</h1>
            <p className="admin-header-subtitle">Oxford City Council Licensed Operator</p>
          </div>
        </div>
        <div className="admin-header-right">
          {upcomingSoonCount > 0 && (
            <div className="notification-bell" aria-label="Upcoming pickups in the next 48 hours">
              <Clock className="h-6 w-6" style={{ color: '#a5b4fc' }} />
              <span className="notification-badge" style={{ backgroundColor: '#4f46e5' }}>
                {upcomingSoonCount}
              </span>
              <div className="notification-tooltip">
                <div className="notification-tooltip-title">Upcoming jobs</div>
                <div className="notification-tooltip-text">
                  {upcomingSoonCount} active {upcomingSoonCount === 1 ? 'booking' : 'bookings'} in the next 48 hours
                </div>
              </div>
            </div>
          )}
          {pendingCustomerBookingsCount > 0 && (
            <div className="notification-bell">
              <Bell className="h-6 w-6" style={{ color: '#fbbf24' }} />
              <span className="notification-badge">{pendingCustomerBookingsCount}</span>
              <div className="notification-tooltip">
                <div className="notification-tooltip-title">
                  {pendingCustomerBookingsCount} New {pendingCustomerBookingsCount === 1 ? 'Booking' : 'Bookings'}
                </div>
                <div className="notification-tooltip-text">Pending customer bookings need review</div>
              </div>
            </div>
          )}
          <div style={{ textAlign: 'right', marginRight: '1rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
              Active Drivers: {activeDriversCount}/3
            </p>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
              Available Vehicles: {availableVehiclesCount}
            </p>
          </div>
          <button onClick={onLogout} className="btn btn-danger btn-sm">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
