import React, { useEffect, useState } from 'react';
import type { ScanRecord } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl: string;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, serverUrl }) => {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetchScans();
    }
  }, [isOpen]);

  const fetchScans = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/scans`);
      if (res.ok) {
        const data = await res.json();
        setScans(data);
      }
    } catch (err) {
      console.error('Failed to load scans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Scan &amp; CAD History (SQLite)
          </h3>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '4px 10px' }}>
            ✕
          </button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>
            <div className="loader-spinner" style={{ margin: '0 auto' }} />
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '10px' }}>Loading previous scans...</p>
          </div>
        ) : scans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
            <p>No scans recorded yet. Perform an object scan or run demo mode.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {scans.map((scan) => (
              <div
                key={scan.scan_id}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                {/* Thumbnail */}
                {scan.thumbnail_base64 ? (
                  <img
                    src={scan.thumbnail_base64}
                    alt="Thumbnail"
                    style={{ width: '60px', height: '45px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #1e293b' }}
                  />
                ) : (
                  <div style={{ width: '60px', height: '45px', background: '#0b101d', borderRadius: '4px' }} />
                )}

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#f0f4fc', fontSize: '14px' }}>
                    {scan.object_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                    {scan.width_mm.toFixed(1)} × {scan.height_mm.toFixed(1)} × {scan.thickness_mm.toFixed(1)} mm | {scan.hole_count} holes
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Scan ID: {scan.scan_id} • {new Date(scan.created_at).toLocaleString()}
                  </div>
                </div>

                {/* Action */}
                {scan.dxf_filename && (
                  <a
                    href={`${serverUrl}/api/download/${scan.dxf_filename}`}
                    download={scan.dxf_filename}
                    className="btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', textDecoration: 'none' }}
                  >
                    📥 DXF
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
