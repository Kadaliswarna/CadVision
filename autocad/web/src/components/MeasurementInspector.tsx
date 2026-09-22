import React, { useState } from 'react';
import type { Hole, DxfResult } from '../types';

interface MeasurementInspectorProps {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  holes: Hole[];
  partName: string;
  onUpdateDimensions: (width: number, height: number, thickness: number, holes: Hole[]) => void;
  onGenerateDxf: () => void;
  isGeneratingDxf: boolean;
  dxfResult: DxfResult | null;
  serverUrl: string;
}

export const MeasurementInspector: React.FC<MeasurementInspectorProps> = ({
  widthMm,
  heightMm,
  thicknessMm,
  holes,
  partName,
  onUpdateDimensions,
  onGenerateDxf,
  isGeneratingDxf,
  dxfResult,
  serverUrl,
}) => {
  const [showAutoCadGuide, setShowAutoCadGuide] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editWidth, setEditWidth] = useState<number>(widthMm);
  const [editHeight, setEditHeight] = useState<number>(heightMm);
  const [editThickness, setEditThickness] = useState<number>(thicknessMm);

  // Sync edits when props change
  React.useEffect(() => {
    setEditWidth(widthMm);
    setEditHeight(heightMm);
    setEditThickness(thicknessMm);
  }, [widthMm, heightMm, thicknessMm]);

  const handleSnapTolerances = () => {
    const snappedW = Math.round(widthMm);
    const snappedH = Math.round(heightMm);
    const snappedT = Math.round(thicknessMm);
    const snappedHoles = holes.map((h) => ({
      ...h,
      x_mm: Math.round(h.x_mm),
      y_mm: Math.round(h.y_mm),
      diameter_mm: Math.round(h.diameter_mm),
      radius_mm: Math.round(h.diameter_mm) / 2.0,
    }));
    onUpdateDimensions(snappedW, snappedH, snappedT, snappedHoles);
  };

  const handleSaveEdits = () => {
    onUpdateDimensions(editWidth, editHeight, editThickness, holes);
    setIsEditing(false);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
          </svg>
          3. Geometric Inspection & DXF
        </div>
      </div>

      <div className="card-body">
        {/* Identified Component */}
        <div style={{ marginBottom: '14px' }}>
          <span className="dim-label">Identified Mechanical Component</span>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
            }}
          >
            <span>{partName}</span>
            <span
              style={{
                fontSize: '10px',
                background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                padding: '2px 6px',
                borderRadius: '4px',
                color: 'var(--accent-cyan)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              CV Verified
            </span>
          </div>
        </div>

        {/* Dimension Value Callout Cards */}
        {isEditing ? (
          <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
            <span className="dim-label" style={{ marginBottom: '8px', display: 'block' }}>
              Edit Dimensions (mm)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#94a3b8' }}>Width</label>
                <input
                  type="number"
                  value={editWidth}
                  onChange={(e) => setEditWidth(parseFloat(e.target.value) || 0)}
                  step="0.5"
                  style={{ width: '100%', padding: '6px', background: '#070a12', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#94a3b8' }}>Height</label>
                <input
                  type="number"
                  value={editHeight}
                  onChange={(e) => setEditHeight(parseFloat(e.target.value) || 0)}
                  step="0.5"
                  style={{ width: '100%', padding: '6px', background: '#070a12', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#94a3b8' }}>Thickness</label>
                <input
                  type="number"
                  value={editThickness}
                  onChange={(e) => setEditThickness(parseFloat(e.target.value) || 0)}
                  step="0.5"
                  style={{ width: '100%', padding: '6px', background: '#070a12', border: '1px solid #334155', color: '#fff', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" onClick={handleSaveEdits} style={{ padding: '6px 12px', fontSize: '12px' }}>
                Save
              </button>
              <button className="btn-secondary" onClick={() => setIsEditing(false)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="dimension-grid">
            <div className="dim-card">
              <span className="dim-label">Length / Width</span>
              <div className="dim-value">
                {widthMm.toFixed(1)} <span className="dim-unit">mm</span>
              </div>
            </div>

            <div className="dim-card amber">
              <span className="dim-label">Height / Width 2</span>
              <div className="dim-value">
                {heightMm.toFixed(1)} <span className="dim-unit">mm</span>
              </div>
            </div>

            <div className="dim-card magenta">
              <span className="dim-label">Thickness</span>
              <div className="dim-value">
                {thicknessMm.toFixed(1)} <span className="dim-unit">mm</span>
              </div>
            </div>

            <div className="dim-card">
              <span className="dim-label">Through Holes</span>
              <div className="dim-value">
                {holes.length} <span className="dim-unit">cutouts</span>
              </div>
            </div>
          </div>
        )}

        {/* Engineer tolerance buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className="btn-secondary"
            onClick={handleSnapTolerances}
            style={{ flex: 1, fontSize: '11px', padding: '6px 10px' }}
            title="Snap dimensions to nearest integer millimeter for precision manufacturing"
          >
            ⚡ Snap to 1mm Grid
          </button>
          <button
            className="btn-secondary"
            onClick={() => setIsEditing(!isEditing)}
            style={{ flex: 1, fontSize: '11px', padding: '6px 10px' }}
          >
            ✏️ Fine-Tune
          </button>
        </div>

        {/* Holes table */}
        <div>
          <span className="dim-label">Hole Coordinates (Origin at Top-Left)</span>
          <div className="holes-table-container">
            <table className="holes-table">
              <thead>
                <tr>
                  <th>Hole</th>
                  <th>X (mm)</th>
                  <th>Y (mm)</th>
                  <th>Diam (Ø)</th>
                </tr>
              </thead>
              <tbody>
                {holes.map((h) => (
                  <tr key={h.id}>
                    <td style={{ color: 'var(--accent-magenta)', fontWeight: 600 }}>#{h.id}</td>
                    <td>{h.x_mm.toFixed(1)}</td>
                    <td>{h.y_mm.toFixed(1)}</td>
                    <td style={{ color: 'var(--accent-cyan)' }}>Ø{h.diameter_mm.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Prominent Action: Generate DXF */}
        <div style={{ marginTop: '20px' }}>
          <button
            id="btn-generate-dxf"
            className="btn-primary"
            onClick={onGenerateDxf}
            disabled={isGeneratingDxf}
            style={{
              background: 'linear-gradient(135deg, var(--accent-cyan), #00e676)',
              boxShadow: '0 0 22px rgba(0, 240, 255, 0.4)',
            }}
          >
            {isGeneratingDxf ? (
              <>
                <div className="loader-spinner" />
                Compiling AutoCAD DXF...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                GENERATE AUTOCAD DXF
              </>
            )}
          </button>
        </div>

        {/* DXF Generation Result */}
        {dxfResult && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(0, 230, 118, 0.08)',
              border: '1px solid rgba(0, 230, 118, 0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00e676', fontWeight: 700, fontSize: '13px' }}>
              <span>✓</span>
              <span>AutoCAD DXF Ready for Download</span>
            </div>

            <div
              style={{
                marginTop: '8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: '#94a3b8',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div>File: <strong style={{ color: '#fff' }}>{dxfResult.filename}</strong></div>
              <div>Size: {(dxfResult.file_size_bytes / 1024).toFixed(1)} KB | Entities: {dxfResult.entity_count}</div>
              <div>Layers: {dxfResult.layers.join(', ')}</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <a
                id="btn-download-dxf"
                href={`${serverUrl}${dxfResult.download_url}`}
                download={dxfResult.filename}
                className="btn-primary"
                style={{
                  textDecoration: 'none',
                  flex: 1,
                  padding: '9px 12px',
                  fontSize: '13px',
                }}
              >
                📥 Download DXF
              </a>

              <button
                className="btn-secondary"
                onClick={() => setShowAutoCadGuide(true)}
                style={{ fontSize: '12px', padding: '9px 12px' }}
              >
                AutoCAD Guide
              </button>
            </div>
          </div>
        )}

        {/* AutoCAD Integration Guide Modal */}
        {showAutoCadGuide && (
          <div className="modal-overlay" onClick={() => setShowAutoCadGuide(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--accent-cyan)', marginBottom: '12px' }}>
                AutoCAD Integration Guide (MVP & Advanced)
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '14px' }}>
                The generated file is an industry-standard AutoCAD DXF (Release R2010 / AC1024) with complete millimeter dimensions and dedicated layers.
              </p>

              <div style={{ background: '#080c16', padding: '14px', borderRadius: '8px', marginBottom: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <div style={{ color: 'var(--accent-iqoo)', marginBottom: '6px' }}># Method 1: Direct Open in AutoCAD</div>
                <div style={{ color: '#cbd5e1' }}>1. Open Autodesk AutoCAD</div>
                <div style={{ color: '#cbd5e1' }}>2. Type command: OPEN or DXFIN</div>
                <div style={{ color: '#cbd5e1' }}>3. Select the downloaded file: {dxfResult?.filename || 'component.dxf'}</div>
                <div style={{ color: '#cbd5e1' }}>4. Type: ZOOM &gt; EXTENTS (Z &gt; E)</div>
              </div>

              <div style={{ background: '#080c16', padding: '14px', borderRadius: '8px', marginBottom: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <div style={{ color: 'var(--accent-iqoo)', marginBottom: '6px' }}># Method 2: AutoLISP Automation Script</div>
                <div style={{ color: '#cbd5e1' }}>Load the provided script from cad_scripts/import_cadvision.lsp:</div>
                <div style={{ color: '#00f0ff', marginTop: '4px' }}>(load &quot;import_cadvision.lsp&quot;)</div>
                <div style={{ color: '#00f0ff' }}>(cadvision-open &quot;{dxfResult?.filename || 'component.dxf'}&quot;)</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setShowAutoCadGuide(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
