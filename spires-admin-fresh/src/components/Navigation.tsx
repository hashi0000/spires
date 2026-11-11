// Navigation.tsx
import React, { useEffect, useRef } from 'react';
import { navigation } from '../utils/constants';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, open, onClose, isAdmin = false }) => {
  const items = navigation.filter((item) => !item.adminOnly || isAdmin);
  const firstQuiet = items.find((item) => item.quiet)?.id;
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>('button');
    focusable?.[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <button type="button" className={`admin-nav-backdrop${open ? ' is-open' : ''}`} aria-label="Close navigation" onClick={onClose} />
      <nav ref={panelRef} className={`admin-sidebar${open ? ' is-open' : ''}`} aria-label="Main navigation">
        <div className="admin-sidebar-brand">
          <img src="/assets/spireslogo.svg" alt="Spires Taxis" className="admin-sidebar-logo" />
          <p className="admin-sidebar-subtitle">Admin dashboard</p>
        </div>
        <div className="admin-nav-content">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <React.Fragment key={item.id}>
                {item.id === firstQuiet ? <p className="admin-nav-quiet-label">More</p> : null}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    onClose();
                  }}
                  className={`admin-nav-button${isActive ? ' active' : ''}${item.quiet ? ' is-quiet' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="admin-nav-button__icon" aria-hidden="true" />
                  <span>{item.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Navigation;
