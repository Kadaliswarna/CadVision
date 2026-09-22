import React, { useState } from 'react';
import type { CADModel, Hole } from '../types';

interface CadPreviewCanvasProps {
  cadData: CADModel | null;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  holes: Hole[];
}

export const CadPreviewCanvas: React.FC<CadPreviewCanvasProps> = ({
  cadData,
  widthMm,
  heightMm,
  thicknessMm,
  holes,
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showCenterlines, setShowCenterlines] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showTitleBlock, setShowTitleBlock] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'2d' | 'iso'>('2d');

  const w = widthMm || 120.0;
  const h = heightMm || 80.0;
  const t = thicknessMm || 10.0;
  const partName = cadData?.component?.name || 'Mechanical Plate';

  // SVG Drawing Coordinate Calculations
  // Viewbox coordinates: add padding for dimensions and title block
  const padding = 50;
  const titleBlockWidth = 90;
  const vbWidth = w + titleBlockWidth + padding * 2;
  const vbHeight = h + padding * 2;
  const originX = padding;
  const originY = padding; // In SVG, top is Y=0

  return (
    <div className="glass-panel cad-viewport">
      {/* Top Toolbar */}
      <div className="cad-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="card-title" style={{ fontSize: '13px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            2. Structured CAD Model Viewport
          </span>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(0, 240, 255, 0.1)',
              color: 'var(--accent-cyan)',
            }}
          >
            1:1 mm Scale
          </span>
        </div>

        {/* View Controls & Toggles */}
        <div className="cad-toggles">
          <button
            className={`toggle-btn ${viewMode === '2d' ? 'active' : ''}`}
            onClick={() => setViewMode('2d')}
          >
            2D Orthographic
          </button>
          <button
            className={`toggle-btn ${viewMode === 'iso' ? 'active' : ''}`}
            onClick={() => setViewMode('iso')}
          >
            Isometric 2.5D
          </button>
          <button
            className={`toggle-btn ${showDimensions ? 'active' : ''}`}
            onClick={() => setShowDimensions(!showDimensions)}
          >
            Dims
          </button>
          <button
            className={`toggle-btn ${showCenterlines ? 'active' : ''}`}
            onClick={() => setShowCenterlines(!showCenterlines)}
          >
            Centerlines
          </button>
          <button
            className={`toggle-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
          >
            Grid
          </button>
          <button
            className={`toggle-btn ${showTitleBlock ? 'active' : ''}`}
            onClick={() => setShowTitleBlock(!showTitleBlock)}
          >
            TitleBlock
          </button>

          <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
            <button
              className="toggle-btn"
              onClick={() => setZoom((z) => Math.min(z + 0.2, 2.5))}
              title="Zoom In"
            >
              +
            </button>
            <button
              className="toggle-btn"
              onClick={() => setZoom((z) => Math.max(z - 0.2, 0.5))}
              title="Zoom Out"
            >
              -
            </button>
            <button className="toggle-btn" onClick={() => setZoom(1.0)} title="Reset Zoom">
              100%
            </button>
          </div>
        </div>
      </div>

      {/* SVG CAD Drawing Area */}
      <div className="cad-svg-container">
        <svg
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          style={{
            width: `${100 * zoom}%`,
            height: `${100 * zoom}%`,
            maxHeight: '440px',
            transition: 'width 0.2s ease, height 0.2s ease',
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="cadGrid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.5" />
            </pattern>
            <pattern id="cadMajorGrid" width="50" height="50" patternUnits="userSpaceOnUse">
              <rect width="50" height="50" fill="url(#cadGrid)" />
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0, 240, 255, 0.08)" strokeWidth="1" />
            </pattern>

            {/* Dimension Arrowhead Markers */}
            <marker id="arrowStart" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
              <polygon points="6 0, 0 3, 6 6" fill="#00e676" />
            </marker>
            <marker id="arrowEnd" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#00e676" />
            </marker>
          </defs>

          {/* Background Tech Grid */}
          {showGrid && <rect width="100%" height="100%" fill="url(#cadMajorGrid)" />}

          {/* 2.5D Isometric Extrusion Mode */}
          {viewMode === 'iso' ? (
            <g transform={`translate(${originX + 20}, ${originY + 20})`}>
              {/* Back edge */}
              <polygon
                points={`0,0 ${w},0 ${w + t * 0.7},${-t * 0.7} ${t * 0.7},${-t * 0.7}`}
                fill="rgba(0, 240, 255, 0.08)"
                stroke="#00f0ff"
                strokeWidth="1"
              />
              <polygon
                points={`${w},0 ${w + t * 0.7},${-t * 0.7} ${w + t * 0.7},${h - t * 0.7} ${w},${h}`}
                fill="rgba(0, 240, 255, 0.15)"
                stroke="#00f0ff"
                strokeWidth="1"
              />
              {/* Front Plate Body */}
              <rect
                x="0"
                y="0"
                width={w}
                height={h}
                fill="rgba(15, 25, 45, 0.85)"
                stroke="#00f0ff"
                strokeWidth="2"
              />
              {/* Holes */}
              {holes.map((hole) => (
                <g key={hole.id}>
                  {/* Extruded inner hole cylinder */}
                  <path
                    d={`M ${hole.x_mm - hole.radius_mm} ${hole.y_mm} A ${hole.radius_mm} ${hole.radius_mm} 0 0 0 ${hole.x_mm + hole.radius_mm} ${hole.y_mm} L ${hole.x_mm + hole.radius_mm + t * 0.4} ${hole.y_mm - t * 0.4} A ${hole.radius_mm} ${hole.radius_mm} 0 0 1 ${hole.x_mm - hole.radius_mm + t * 0.4} ${hole.y_mm - t * 0.4} Z`}
                    fill="rgba(0, 0, 0, 0.5)"
                  />
                  <circle
                    cx={hole.x_mm}
                    cy={hole.y_mm}
                    r={hole.radius_mm}
                    fill="#060910"
                    stroke="#ff2a85"
                    strokeWidth="1.5"
                  />
                </g>
              ))}
              <text
                x={w / 2}
                y={h + 20}
                textAnchor="middle"
                fill="#ffb800"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                Extruded Depth: {t.toFixed(1)} mm
              </text>
            </g>
          ) : (
            /* Standard 2D Orthographic Mode */
            <g transform={`translate(${originX}, ${originY})`}>
              {/* Coordinate Axes at (0, 0) */}
              <g opacity="0.6">
                <line x1="0" y1="0" x2="20" y2="0" stroke="#ff2a85" strokeWidth="1.5" />
                <line x1="0" y1="0" x2="0" y2="20" stroke="#00f0ff" strokeWidth="1.5" />
                <text x="22" y="3" fill="#ff2a85" fontSize="8" fontFamily="var(--font-mono)">+X</text>
                <text x="-2" y="28" fill="#00f0ff" fontSize="8" fontFamily="var(--font-mono)">+Y</text>
              </g>

              {/* OUTLINE Layer: Outer Plate Border */}
              <rect
                x="0"
                y="0"
                width={w}
                height={h}
                fill="rgba(0, 240, 255, 0.03)"
                stroke="#00f0ff"
                strokeWidth="1.8"
                rx="1"
              />

              {/* HOLES Layer & CENTERLINES Layer */}
              {holes.map((hole) => {
                const ext = Math.max(3, hole.radius_mm * 0.5);
                return (
                  <g key={hole.id}>
                    {/* Centerlines */}
                    {showCenterlines && (
                      <g stroke="#ffb800" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.85">
                        {/* Horizontal */}
                        <line
                          x1={hole.x_mm - hole.radius_mm - ext}
                          y1={hole.y_mm}
                          x2={hole.x_mm + hole.radius_mm + ext}
                          y2={hole.y_mm}
                        />
                        {/* Vertical */}
                        <line
                          x1={hole.x_mm}
                          y1={hole.y_mm - hole.radius_mm - ext}
                          x2={hole.x_mm}
                          y2={hole.y_mm + hole.radius_mm + ext}
                        />
                      </g>
                    )}

                    {/* Circular Cutout */}
                    <circle
                      cx={hole.x_mm}
                      cy={hole.y_mm}
                      r={hole.radius_mm}
                      fill="#070a12"
                      stroke="#ff2a85"
                      strokeWidth="1.5"
                    />

                    {/* Hole Label */}
                    <text
                      x={hole.x_mm}
                      y={hole.y_mm - hole.radius_mm - 4}
                      textAnchor="middle"
                      fill="#ff2a85"
                      fontSize="7"
                      fontFamily="var(--font-mono)"
                    >
                      H{hole.id}: Ø{hole.diameter_mm.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* DIMENSIONS Layer */}
              {showDimensions && (
                <g stroke="#00e676" strokeWidth="1" fill="#00e676">
                  {/* Width Dimension (Top) */}
                  <line x1="0" y1="-12" x2={w} y2="-12" markerStart="url(#arrowStart)" markerEnd="url(#arrowEnd)" />
                  <line x1="0" y1="-2" x2="0" y2="-16" strokeWidth="0.5" strokeOpacity="0.6" />
                  <line x1={w} y1="-2" x2={w} y2="-16" strokeWidth="0.5" strokeOpacity="0.6" />
                  <text
                    x={w / 2}
                    y="-16"
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fontWeight="bold"
                  >
                    {w.toFixed(1)} mm
                  </text>

                  {/* Height Dimension (Left) */}
                  <line x1="-12" y1="0" x2="-12" y2={h} markerStart="url(#arrowStart)" markerEnd="url(#arrowEnd)" />
                  <line x1="-2" y1="0" x2="-16" y2="0" strokeWidth="0.5" strokeOpacity="0.6" />
                  <line x1="-2" y1={h} x2="-16" y2={h} strokeWidth="0.5" strokeOpacity="0.6" />
                  <text
                    x="-18"
                    y={h / 2}
                    textAnchor="middle"
                    transform={`rotate(-90, -18, ${h / 2})`}
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fontWeight="bold"
                  >
                    {h.toFixed(1)} mm
                  </text>
                </g>
              )}

              {/* TITLEBLOCK Layer */}
              {showTitleBlock && (
                <g transform={`translate(${w + 24}, 0)`}>
                  <rect
                    x="0"
                    y="0"
                    width="84"
                    height="38"
                    fill="rgba(10, 18, 32, 0.85)"
                    stroke="#2979ff"
                    strokeWidth="1"
                  />
                  <line x1="0" y1="12" x2="84" y2="12" stroke="#2979ff" strokeWidth="0.5" />
                  <line x1="0" y1="24" x2="84" y2="24" stroke="#2979ff" strokeWidth="0.5" />
                  
                  <text x="4" y="9" fill="#00f0ff" fontSize="7" fontFamily="var(--font-mono)" fontWeight="bold">
                    iQOO CADVision v1.0
                  </text>
                  <text x="4" y="19" fill="#f0f4fc" fontSize="6" fontFamily="var(--font-mono)">
                    {partName.toUpperCase()}
                  </text>
                  <text x="4" y="32" fill="#94a3b8" fontSize="5.5" fontFamily="var(--font-mono)">
                    {w.toFixed(1)} × {h.toFixed(1)} × {t.toFixed(1)} mm
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
