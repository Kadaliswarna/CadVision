import React from 'react';

interface DemoBannerProps {
  onTriggerDemo: () => void;
  isLoading: boolean;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ onTriggerDemo, isLoading }) => {
  return (
    <div className="demo-banner">
      <div className="demo-banner-text">
        <h4>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          HACKATHON DEMO MODE (60-SECOND COMPLETE PIPELINE)
        </h4>
        <p>
          Execute live end-to-end detection: Physical Mechanical Plate (120×80mm, 4 holes) + 50mm ArUco scale reference → DXF export.
        </p>
      </div>

      <button
        id="btn-trigger-demo"
        className="btn-demo-trigger"
        onClick={onTriggerDemo}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <div className="loader-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
            Processing Vision...
          </>
        ) : (
          <>
            <span>⚡ Run MVP Demo</span>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>(1-Click)</span>
          </>
        )}
      </button>
    </div>
  );
};
