import React from 'react';

interface ArucoModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl: string;
}

export const ArucoModal: React.FC<ArucoModalProps> = ({ isOpen, onClose, serverUrl }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--accent-cyan)' }}>
            Physical 50mm ArUco Reference Target
          </h3>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '4px 10px' }}>
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px', textAlign: 'left' }}>
          Place this 50mm reference marker on the same plane beside your mechanical component.
          The OpenCV computer vision pipeline detects its 4 corner coordinates to establish the exact pixel-to-millimeter ratio.
        </p>

        {/* Printable Image View */}
        <div
          style={{
            background: '#ffffff',
            padding: '16px',
            borderRadius: '10px',
            display: 'inline-block',
            boxShadow: '0 0 25px rgba(255, 255, 255, 0.1)',
            marginBottom: '18px',
          }}
        >
          <img
            src={`${serverUrl}/api/sample-image/aruco_marker_50mm.png`}
            alt="50mm ArUco Target"
            style={{ maxWidth: '320px', width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <a
            href={`${serverUrl}/api/sample-image/aruco_marker_50mm.png`}
            download="aruco_marker_50mm.png"
            className="btn-primary"
            style={{ width: 'auto', textDecoration: 'none', padding: '8px 20px' }}
          >
            📥 Download Target PNG
          </a>
          <button
            className="btn-secondary"
            onClick={() => window.print()}
            style={{ padding: '8px 20px' }}
          >
            🖨️ Print at 100% Scale
          </button>
        </div>
      </div>
    </div>
  );
};
