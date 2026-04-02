// Navigation.tsx
import React from 'react';
import { navigation } from '../utils/constants';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="admin-nav">
      <div className="admin-nav-content">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`admin-nav-button ${activeTab === item.id ? 'active' : ''}`}
            >
              <Icon className="h-5 w-5" style={{ marginRight: '0.5rem' }} />
              {item.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
