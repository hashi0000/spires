// Header.tsx
import React from 'react';
import { Bell, Clock, Users, Car, LogOut } from 'lucide-react';

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
  onLogout,
}) => {
  const driversAtLimit = activeDriversCount >= 3;

  return (
    <header className="admin-header">
      <div className="admin-header-accent" aria-hidden="true" />
      <div className="admin-header-content">
        <div className="admin-header-brand">
          <div className="admin-header-logo" aria-hidden="true">
            <span className="admin-header-logo-text">ST</span>
          </div>
          <div>
            <h1 className="admin-header-title">Spires Taxis</h1>
            <p className="admin-header-subtitle">Admin Dashboard · Oxford City Council</p>
          </div>
        </div>

        <div className="admin-header-actions">
          <div className="admin-header-stats">
            <div className={`admin-stat-chip${driversAtLimit ? ' admin-stat-chip--warn' : ''}`}>
              <Users className="admin-stat-chip__icon" />
              <div>
                <span className="admin-stat-chip__label">Drivers</span>
                <span className="admin-stat-chip__value">{activeDriversCount}/3</span>
              </div>
            </div>
            <div className="admin-stat-chip">
              <Car className="admin-stat-chip__icon" />
              <div>
                <span className="admin-stat-chip__label">Vehicles</span>
                <span className="admin-stat-chip__value">{availableVehiclesCount}</span>
              </div>
            </div>
          </div>

          <div className="admin-header-alerts">
            {upcomingSoonCount > 0 && (
              <div className="header-alert" aria-label="Upcoming pickups in the next 48 hours">
                <div className="header-alert__btn header-alert__btn--upcoming">
                  <Clock className="h-5 w-5" />
                  <span className="header-alert__badge header-alert__badge--indigo">
                    {upcomingSoonCount}
                  </span>
                </div>
                <div className="notification-tooltip">
                  <div className="notification-tooltip-title">Upcoming jobs</div>
                  <div className="notification-tooltip-text">
                    {upcomingSoonCount} active{' '}
                    {upcomingSoonCount === 1 ? 'booking' : 'bookings'} in the next 48 hours
                  </div>
                </div>
              </div>
            )}
            {pendingCustomerBookingsCount > 0 && (
              <div className="header-alert" aria-label="Pending customer bookings">
                <div className="header-alert__btn header-alert__btn--pending">
                  <Bell className="h-5 w-5" />
                  <span className="header-alert__badge">{pendingCustomerBookingsCount}</span>
                </div>
                <div className="notification-tooltip">
                  <div className="notification-tooltip-title">
                    {pendingCustomerBookingsCount} new{' '}
                    {pendingCustomerBookingsCount === 1 ? 'booking' : 'bookings'}
                  </div>
                  <div className="notification-tooltip-text">
                    Pending customer bookings need review
                  </div>
                </div>
              </div>
            )}
          </div>

          <button type="button" onClick={onLogout} className="admin-header-logout">
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
