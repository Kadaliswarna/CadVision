import React, { useState, useRef, useEffect } from 'react';

interface ImageUploadPanelProps {
  onAnalyzeImage: (file: File, markerSize: number, thickness: number, allowFallbackScale?: boolean) => void;
  isLoading: boolean;
  annotatedImageUrl: string | null;
  errorMessage: string | null;
  onSelectSample: (sampleId: string) => void;
  selectedSampleId: string | null;
}

export const ImageUploadPanel: React.FC<ImageUploadPanelProps> = ({
  onAnalyzeImage,
  isLoading,
  annotatedImageUrl,
  errorMessage,
  onSelectSample,
  selectedSampleId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'annotated' | 'original'>('annotated');
  const [markerSize, setMarkerSize] = useState<number>(50.0);
  const [thickness, setThickness] = useState<number>(10.0);
  const [allowFallback, setAllowFallback] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      stopCamera();
    }
  };

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      stopCamera();
    }
  };

  // Camera handling
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      alert('Camera access unavailable or blocked: ' + (err as Error).message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const capturedFile = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
          setSelectedFile(capturedFile);
          setPreviewUrl(URL.createObjectURL(capturedFile));
          stopCamera();
        }
      }, 'image/jpeg', 0.95);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleRunAnalyze = (fallbackOverride?: boolean) => {
    if (selectedFile) {
      onAnalyzeImage(selectedFile, markerSize, thickness, fallbackOverride ?? allowFallback);
      setActiveTab('annotated');
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          1. Optical Capture & Calibration
        </div>
      </div>

      <div className="card-body">
        {/* Sample selection chips */}
        <div style={{ marginBottom: '14px' }}>
          <label className="dim-label" style={{ marginBottom: '6px', display: 'block' }}>
            Benchmarked Test Objects
          </label>
          <div className="sample-grid">
            <div
              className={`sample-chip ${selectedSampleId === 'mechanical-plate-mvp' ? 'active' : ''}`}
              onClick={() => {
                stopCamera();
                onSelectSample('mechanical-plate-mvp');
              }}
            >
              <span className="sample-chip-title">Mechanical Plate</span>
              <span className="sample-chip-desc">120×80mm | 4 Holes</span>
            </div>

            <div
              className={`sample-chip ${selectedSampleId === 'circular-flange' ? 'active' : ''}`}
              onClick={() => {
                stopCamera();
                onSelectSample('circular-flange');
              }}
            >
              <span className="sample-chip-title">Circular Flange</span>
              <span className="sample-chip-desc">100mm OD | 5 Holes</span>
            </div>
          </div>
        </div>

        {/* Input dropzone / camera view */}
        {isCameraActive ? (
          <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#000', marginBottom: '14px' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: '12px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button className="btn-primary" onClick={capturePhoto} style={{ width: 'auto', padding: '8px 18px' }}>
                📸 Capture Frame
              </button>
              <button className="btn-secondary" onClick={stopCamera}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ marginBottom: '14px' }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
              id="file-upload-input"
            />
            <div className="upload-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="upload-title">Drop component image here</div>
            <div className="upload-sub">or click to browse local files</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className="btn-secondary"
            onClick={isCameraActive ? stopCamera : startCamera}
            style={{ flex: 1 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {isCameraActive ? 'Close Camera' : 'Live Camera'}
          </button>
        </div>

        {/* Parameters */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label className="dim-label" style={{ marginBottom: '4px', display: 'block' }}>
              Reference Target (mm)
            </label>
            <select
              value={markerSize}
              onChange={(e) => setMarkerSize(parseFloat(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '8px 10px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
              }}
            >
              <option value="50.0">50.0 mm (ArUco 4x4 ID 0)</option>
              <option value="40.0">40.0 mm (ArUco Target)</option>
              <option value="85.6">85.6 mm (ISO ID Card)</option>
              <option value="30.0">30.0 mm (Mini Target)</option>
            </select>
          </div>

          <div>
            <label className="dim-label" style={{ marginBottom: '4px', display: 'block' }}>
              Part Thickness (mm)
            </label>
            <input
              type="number"
              value={thickness}
              onChange={(e) => setThickness(parseFloat(e.target.value) || 10.0)}
              step="1"
              min="1"
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '8px 10px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
              }}
            />
          </div>
        </div>

        {/* Fallback Estimated Scale Option */}
        <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="cb-estimated-scale"
            checked={allowFallback}
            onChange={(e) => setAllowFallback(e.target.checked)}
            style={{ accentColor: 'var(--accent-cyan)', width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <label htmlFor="cb-estimated-scale" style={{ fontSize: '12px', color: '#94a3b8', cursor: 'pointer' }}>
            Allow Estimated Scale (test arbitrary images without ArUco marker)
          </label>
        </div>

        {/* Run Analysis Action */}
        <button
          id="btn-analyze-image"
          className="btn-primary"
          onClick={() => handleRunAnalyze(allowFallback)}
          disabled={isLoading || (!selectedFile && !previewUrl)}
          style={{ marginBottom: '16px' }}
        >
          {isLoading ? (
            <>
              <div className="loader-spinner" />
              Running Computer Vision...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Run Computer Vision Analysis
            </>
          )}
        </button>

        {/* Error message alert with Quick Solutions */}
        {errorMessage && (
          <div
            style={{
              padding: '14px',
              background: 'rgba(255, 42, 133, 0.12)',
              border: '1px solid rgba(255, 42, 133, 0.4)',
              borderRadius: '8px',
              color: '#ff6b9d',
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <div>{errorMessage}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <button
                className="btn-secondary"
                onClick={() => onSelectSample('mechanical-plate-mvp')}
                style={{ fontSize: '11px', padding: '6px 12px', color: '#00f0ff', borderColor: '#00f0ff' }}
              >
                👉 Load Mechanical Plate Sample (with ArUco 50mm)
              </button>

              {selectedFile && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setAllowFallback(true);
                    handleRunAnalyze(true);
                  }}
                  style={{ fontSize: '11px', padding: '6px 12px', color: '#ffb800', borderColor: '#ffb800' }}
                >
                  ⚡ Analyze This Image with Estimated Scale
                </button>
              )}
            </div>
          </div>
        )}

        {/* Image Preview with Toggle between Original & Annotated Vision Overlay */}
        {(previewUrl || annotatedImageUrl) && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="dim-label">Image View</span>
              <div className="cad-toggles">
                <button
                  className={`toggle-btn ${activeTab === 'annotated' ? 'active' : ''}`}
                  onClick={() => setActiveTab('annotated')}
                  disabled={!annotatedImageUrl}
                >
                  CV Overlay
                </button>
                <button
                  className={`toggle-btn ${activeTab === 'original' ? 'active' : ''}`}
                  onClick={() => setActiveTab('original')}
                >
                  Original
                </button>
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                background: '#04070d',
                maxHeight: '260px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={activeTab === 'annotated' && annotatedImageUrl ? annotatedImageUrl : previewUrl || ''}
                alt="Component View"
                style={{ width: '100%', height: 'auto', maxHeight: '260px', objectFit: 'contain' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
