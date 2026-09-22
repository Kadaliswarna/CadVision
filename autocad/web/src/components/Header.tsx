import React from 'react';

interface HeaderProps {
  serverConnected: boolean;
  serverUrl: string;
  onOpenHistory: () => void;
  onOpenAruco: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serverConnected,
  serverUrl,
  onOpenHistory,
  onOpenAruco,
}) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="brand-badge">iQOO</span>
        <div>
          <h1 className="header-title">CADVision</h1>
          <p className="header-tagline">Real-World Object → Intelligent AutoCAD Drawing</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          id="btn-aruco-marker"
          className="btn-secondary"
          onClick={onOpenAruco}
          title="Display or print 50mm ArUco reference marker"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <rect x="7" y="7" width="3" height="3" fill="currentColor" />
            <rect x="14" y="7" width="3" height="3" fill="currentColor" />
            <rect x="7" y="14" width="3" height="3" fill="currentColor" />
            <rect x="14" y="14" width="3" height="3" fill="currentColor" />
          </svg>
          50mm Target
        </button>

        <button
          id="btn-scan-history"
          className="btn-secondary"
          onClick={onOpenHistory}
          title="View previous scans and generated DXFs"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          History
        </button>

        <div className="header-status-badge">
          <div className="status-dot" style={{ background: serverConnected ? '#00e676' : '#ff5252' }} />
          <span>{serverConnected ? 'PC Server Online' : 'Server Disconnected'}</span>
          <span style={{ color: '#64748b', fontSize: '11px' }}>({serverUrl})</span>
        </div>
      </div>
    </header>
  );
};
