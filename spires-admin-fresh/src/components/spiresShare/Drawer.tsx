import React from "react";

export function Drawer({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="share-ops-drawer-backdrop" onClick={onClose} role="presentation">
      <aside className={`share-ops-drawer${wide ? " is-wide" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="share-ops-drawer-head">
          <h3>{title}</h3>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="share-ops-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
