// Header.tsx
import React from 'react';
import { Bell, Clock, Users, Car, LogOut, Menu } from 'lucide-react';

interface HeaderProps {
  pageTitle: string;
  activeDriversCount: number;
  availableVehiclesCount: number;
  pendingCustomerBookingsCount: number;
  upcomingSoonCount: number;
  onLogout: () => void;
  onOpenMenu: () => void;
}

const Header: React.FC<HeaderProps> = ({
  pageTitle,
  activeDriversCount,
  availableVehiclesCount,
  pendingCustomerBookingsCount,
  upcomingSoonCount,
  onLogout,
  onOpenMenu,
}) => {
  const driversAtLimit = activeDriversCount >= 3;

  return (
    <header className="admin-header">
      <div className="admin-header-content">
        <div className="admin-header-brand">
          <button type="button" className="admin-menu-button" onClick={onOpenMenu} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <img src="/assets/spireslogo.svg" alt="" className="admin-header-mark" />
          <div>
            <p className="admin-header-kicker">Spires Taxis</p>
            <h1 className="admin-header-title">{pageTitle}</h1>
          </div>
        </div>

        <div className="admin-header-actions">
          <div className="admin-header-stats">
            <div className={`admin-stat-chip${driversAtLimit ? ' admin-stat-chip--warn' : ''}`}>
              <Users className="admin-stat-chip__icon" aria-hidden="true" />
              <div>
                <span className="admin-stat-chip__label">Active drivers</span>
                <span className="admin-stat-chip__value">{activeDriversCount} of 3</span>
              </div>
            </div>
            <div className="admin-stat-chip">
              <Car className="admin-stat-chip__icon" aria-hidden="true" />
              <div>
                <span className="admin-stat-chip__label">Available vehicles</span>
                <span className="admin-stat-chip__value">{availableVehiclesCount}</span>
              </div>
            </div>
          </div>

          <div className="admin-header-alerts">
            {upcomingSoonCount > 0 && (
              <div className="header-alert">
                <div className="header-alert__btn header-alert__btn--upcoming" aria-label={`${upcomingSoonCount} active bookings in the next 48 hours`}>
                  <Clock className="h-5 w-5" />
                  <span className="header-alert__badge header-alert__badge--indigo">{upcomingSoonCount}</span>
                </div>
                <div className="notification-tooltip" role="tooltip">
                  <div className="notification-tooltip-title">Upcoming jobs</div>
                  <div className="notification-tooltip-text">
                    {upcomingSoonCount} active {upcomingSoonCount === 1 ? 'booking' : 'bookings'} in the next 48 hours
                  </div>
                </div>
              </div>
            )}
            {pendingCustomerBookingsCount > 0 && (
              <div className="header-alert">
                <div className="header-alert__btn header-alert__btn--pending" aria-label={`${pendingCustomerBookingsCount} pending customer bookings`}>
                  <Bell className="h-5 w-5" />
                  <span className="header-alert__badge">{pendingCustomerBookingsCount}</span>
                </div>
                <div className="notification-tooltip" role="tooltip">
                  <div className="notification-tooltip-title">
                    {pendingCustomerBookingsCount} new {pendingCustomerBookingsCount === 1 ? 'booking' : 'bookings'}
                  </div>
                  <div className="notification-tooltip-text">Pending customer bookings need review</div>
                </div>
              </div>
            )}
          </div>

          <button type="button" onClick={onLogout} className="admin-header-logout">
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
