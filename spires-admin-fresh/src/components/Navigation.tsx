// Navigation.tsx
import React from 'react';
import { navigation } from '../utils/constants';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="admin-nav" aria-label="Main navigation">
      <div className="admin-nav-content">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`admin-nav-button${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="admin-nav-button__icon" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
