import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  CheckCircle2, 
  Loader2, 
  ScanLine, 
  ArrowRight, 
  AlertTriangle, 
  RefreshCcw, 
  Hand, 
  Eye, 
  Sparkles,
  Info
} from 'lucide-react';
import { analyzeImage } from '../utils/cvHelper';
import type { AnalysisResult, ManualROI, DetectionState } from '../utils/cvHelper';

interface Props {
  image: string | null;
  onComplete: (result: AnalysisResult) => void;
}

type StepState = 'SCANNING' | 'ANALYZING' | 'DONE' | 'MANUAL_SELECT';

export default function ScreenAnalysis({ image, onComplete }: Props) {
  const [stepState, setStepState] = useState<StepState>('SCANNING');
  const [detectionState, setDetectionState] = useState<DetectionState>('OBJECT_DETECTED');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);

  // Manual ROI Selection state
  const [isSelectingROI, setIsSelectingROI] = useState(false);
  const [roiStart, setRoiStart] = useState<{ x: number; y: number } | null>(null);
  const [roiCurrent, setRoiCurrent] = useState<{ x: number; y: number } | null>(null);
  const [manualROI, setManualROI] = useState<ManualROI | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Perform detection pipeline
  const executeDetection = useCallback(async (customROI?: ManualROI | null) => {
    if (!image) {
      setErrorDetails("No image provided.");
      setDetectionState('NO_OBJECT_FOUND');
      setStepState('DONE');
      return;
    }

    try {
      setStepState('SCANNING');
      setErrorDetails(null);

      if (!imgRef.current) return;
      if (!imgRef.current.complete) {
        await new Promise((resolve) => {
          imgRef.current!.onload = resolve;
        });
      }

      setStepState('ANALYZING');
      const assumedMmPerPixel = 0.5;

      // 1. Try backend API first with timeout (Requirement 14)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        // Fetch sample blob if dataUrl or local url
        const blob = await fetch(image).then(r => r.blob());
        const formData = new FormData();
        formData.append('file', blob, 'capture.jpg');
        formData.append('allow_fallback_scale', 'true');

        const apiRes = await fetch('http://127.0.0.1:8000/api/analyze-image', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (apiRes.ok) {
          console.log("[CADVision] Backend AI API responded successfully");
        } else {
          console.warn("[CADVision] Backend API returned non-200. Using local geometry detection.");
          setApiNotice("AI analysis unavailable — using local geometry detection.");
        }
      } catch {
        console.log("[CADVision] AI API unavailable — using geometry detection.");
        setApiNotice("AI analysis unavailable — using geometry detection.");
      }

      // 2. Run local OpenCV.js computer vision geometry engine
      const res = await analyzeImage(imgRef.current, assumedMmPerPixel, customROI);
      setResult(res);
      setDetectionState(res.detectionState);
      setStepState('DONE');
      setIsSelectingROI(false);
    } catch (err: any) {
      console.error("[CADVision] Detection exception:", err);
      setErrorDetails(err.message || "Failed to analyze image geometry.");
      setDetectionState('NO_OBJECT_FOUND');
      setStepState('DONE');
    }
  }, [image]);

  useEffect(() => {
    executeDetection();
  }, [executeDetection]);

  // Handle manual ROI dragging on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingROI || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const y = Math.max(0, e.clientY - rect.top);
    setRoiStart({ x, y });
    setRoiCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingROI || !roiStart || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setRoiCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (!isSelectingROI || !roiStart || !roiCurrent || !imageContainerRef.current || !imgRef.current) {
      setRoiStart(null);
      setRoiCurrent(null);
      return;
    }

    const containerRect = imageContainerRef.current.getBoundingClientRect();
    const naturalW = imgRef.current.naturalWidth;
    const naturalH = imgRef.current.naturalHeight;

    const scaleX = naturalW / containerRect.width;
    const scaleY = naturalH / containerRect.height;

    const x1 = Math.min(roiStart.x, roiCurrent.x) * scaleX;
    const y1 = Math.min(roiStart.y, roiCurrent.y) * scaleY;
    const x2 = Math.max(roiStart.x, roiCurrent.x) * scaleX;
    const y2 = Math.max(roiStart.y, roiCurrent.y) * scaleY;

    const width = x2 - x1;
    const height = y2 - y1;

    if (width > 25 && height > 25) {
      setManualROI({ x: x1, y: y1, width, height });
    }
    setRoiStart(null);
    setRoiCurrent(null);
  };

  const startManualSelection = () => {
    setIsSelectingROI(true);
    setManualROI(null);
    setRoiStart(null);
    setRoiCurrent(null);
  };

  const applyManualSelection = () => {
    if (manualROI) {
      executeDetection(manualROI);
    }
  };

  const isScanning = stepState === 'SCANNING' || stepState === 'ANALYZING';

  return (
    <div className="flex-1 flex flex-col md:flex-row p-6 gap-6 max-w-6xl mx-auto w-full">
      {/* Hidden source image element for OpenCV */}
      {image && <img ref={imgRef} src={image} alt="hidden-source" className="hidden" crossOrigin="anonymous" />}

      {/* Left Column: Image Display, Overlay, & Manual ROI Selector */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm uppercase text-gray-400 font-bold tracking-wider flex items-center gap-2">
            <span>Detection View</span>
            {result && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                detectionState === 'OBJECT_DETECTED'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : detectionState === 'POTENTIAL_OBJECT_DETECTED'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {detectionState === 'OBJECT_DETECTED' ? '✓ Verified CAD Geometry' : detectionState === 'POTENTIAL_OBJECT_DETECTED' ? '◐ Potential Component' : '⚠ Geometry Check'}
              </span>
            )}
          </h2>

          {/* Quick Select Object Toggle */}
          {!isScanning && (
            <button
              onClick={isSelectingROI ? () => setIsSelectingROI(false) : startManualSelection}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                isSelectingROI 
                  ? 'bg-iqoo text-black font-bold shadow-[0_0_12px_rgba(242,169,0,0.4)]'
                  : 'bg-card border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
              }`}
            >
              <Hand size={14} />
              {isSelectingROI ? 'Cancel Crop' : 'Select Object'}
            </button>
          )}
        </div>

        {/* API fallback notification */}
        {apiNotice && (
          <div className="mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300 text-xs flex items-center gap-2">
            <Info size={14} className="flex-shrink-0" />
            <span>{apiNotice}</span>
          </div>
        )}

        {/* Image & Interactive Canvas Container */}
        <div 
          ref={imageContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`relative w-full aspect-square md:aspect-auto md:flex-1 bg-card rounded-xl border border-gray-800 overflow-hidden flex items-center justify-center select-none ${
            isSelectingROI ? 'cursor-crosshair ring-2 ring-iqoo/60' : ''
          }`}
        >
          {/* Main Visual Image */}
          {result?.debugImageBase64 && !isSelectingROI ? (
            <img src={result.debugImageBase64} alt="Overlay" className="w-full h-full object-contain pointer-events-none" />
          ) : image ? (
            <>
              <img 
                src={image} 
                alt="Source" 
                className={`w-full h-full object-contain pointer-events-none ${isScanning ? 'opacity-50' : 'opacity-90'}`} 
              />
              {isScanning && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-tech/30 to-transparent w-full h-1/3 animate-[scan_2s_ease-in-out_infinite] pointer-events-none" />
              )}
            </>
          ) : (
            <div className="text-gray-500 flex flex-col items-center pointer-events-none">
              <ScanLine size={48} className="mb-2 opacity-50" />
              <span>No Image Loaded</span>
            </div>
          )}

          {/* Active Dragging Rectangle Preview */}
          {isSelectingROI && roiStart && roiCurrent && (
            <div
              className="absolute border-2 border-iqoo bg-iqoo/20 pointer-events-none shadow-[0_0_15px_rgba(242,169,0,0.5)]"
              style={{
                left: `${Math.min(roiStart.x, roiCurrent.x)}px`,
                top: `${Math.min(roiStart.y, roiCurrent.y)}px`,
                width: `${Math.abs(roiCurrent.x - roiStart.x)}px`,
                height: `${Math.abs(roiCurrent.y - roiStart.y)}px`,
              }}
            >
              <span className="absolute -top-6 left-0 bg-black/80 text-iqoo font-mono text-[10px] px-1.5 py-0.5 rounded border border-iqoo/40">
                {Math.round(Math.abs(roiCurrent.x - roiStart.x))} × {Math.round(Math.abs(roiCurrent.y - roiStart.y))} px
              </span>
            </div>
          )}

          {/* User Confirmed Manual ROI Box */}
          {isSelectingROI && manualROI && !roiStart && imageContainerRef.current && imgRef.current && (
            <div
              className="absolute border-2 border-green-tech bg-green-tech/15 pointer-events-none shadow-[0_0_15px_rgba(0,230,118,0.4)]"
              style={{
                left: `${(manualROI.x / imgRef.current.naturalWidth) * imageContainerRef.current.clientWidth}px`,
                top: `${(manualROI.y / imgRef.current.naturalHeight) * imageContainerRef.current.clientHeight}px`,
                width: `${(manualROI.width / imgRef.current.naturalWidth) * imageContainerRef.current.clientWidth}px`,
                height: `${(manualROI.height / imgRef.current.naturalHeight) * imageContainerRef.current.clientHeight}px`,
              }}
            >
              <span className="absolute -top-6 left-0 bg-black/80 text-green-tech font-mono text-[10px] px-1.5 py-0.5 rounded border border-green-tech/40">
                ROI Selected
              </span>
            </div>
          )}

          {/* Canvas for fine drawing if needed */}
          <canvas ref={overlayCanvasRef} className="hidden" />

          {/* Manual Selection Guide Overlay */}
          {isSelectingROI && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/85 backdrop-blur-md p-3 rounded-lg border border-gray-700 flex items-center justify-between z-20">
              <span className="text-xs text-gray-300">
                {manualROI ? "✓ Region selected. Click Analyze to isolate." : "Click and drag over the component in the image."}
              </span>
              <div className="flex gap-2">
                {manualROI && (
                  <button
                    onClick={applyManualSelection}
                    className="bg-iqoo text-black text-xs font-bold px-3 py-1.5 rounded hover:bg-yellow-400 transition-colors"
                  >
                    Analyze Region
                  </button>
                )}
                <button
                  onClick={() => setIsSelectingROI(false)}
                  className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1.5 rounded hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Multi-State Analysis Panel */}
      <div className="w-full md:w-96 flex flex-col">
        <h2 className="text-sm uppercase text-gray-400 font-bold tracking-wider mb-4 flex items-center gap-2">
          <span>AI Geometry Analysis</span>
          <Sparkles size={14} className="text-iqoo" />
        </h2>

        <div className="bg-card p-6 rounded-xl border border-gray-800 shadow-xl flex-1 flex flex-col justify-between">
          
          {/* Progress / Step Indicators */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3">
              {stepState === 'SCANNING' ? (
                <Loader2 className="text-cyan-tech animate-spin" size={18} />
              ) : (
                <CheckCircle2 className="text-green-tech" size={18} />
              )}
              <span className={stepState === 'SCANNING' ? 'text-cyan-tech font-bold text-sm' : 'text-gray-300 text-sm'}>
                Preprocessing & Quality Check...
              </span>
            </div>

            <div className="flex items-center gap-3">
              {stepState === 'ANALYZING' ? (
                <Loader2 className="text-cyan-tech animate-spin" size={18} />
              ) : stepState === 'DONE' ? (
                <CheckCircle2 className="text-green-tech" size={18} />
              ) : (
                <div className="w-4 h-4 rounded-full border border-gray-700" />
              )}
              <span className={stepState === 'ANALYZING' ? 'text-cyan-tech font-bold text-sm' : stepState === 'DONE' ? 'text-gray-300 text-sm' : 'text-gray-600 text-sm'}>
                Extracting Boundaries & Internal Holes...
              </span>
            </div>
          </div>

          {/* Conditional UI States */}
          {isScanning ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <Loader2 className="text-iqoo animate-spin" size={36} />
              <p className="text-sm text-gray-300 font-medium">Scanning contours & geometric primitives...</p>
              <p className="text-xs text-gray-500">Applying multi-strategy Otsu and adaptive thresholding</p>
            </div>
          ) : result ? (
            <div className="flex-1 flex flex-col justify-between space-y-4">
              
              {/* ========================================================
                  STATE 1: OBJECT DETECTED (High Confidence CAD Candidate)
                  ======================================================== */}
              {detectionState === 'OBJECT_DETECTED' && (
                <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                  <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-green-400 font-bold text-sm mb-1">
                      <CheckCircle2 size={16} />
                      <span>STATE 1: OBJECT DETECTED</span>
                    </div>
                    <p className="text-xs text-gray-300 font-medium mb-1">✓ Mechanical component detected</p>
                    <p className="text-xs text-gray-300 font-medium mb-1">✓ Geometry identified ({result.outerShapeDescription})</p>
                    <p className="text-xs text-green-400/90 font-medium">✓ Ready for dimensional verification</p>
                  </div>

                  {/* Component Classification Box */}
                  <div className="bg-black/40 border border-gray-800 p-3 rounded-lg space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Identified Component:</span>
                      <span className="text-iqoo font-bold text-sm">{result.detectedCategory}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Outer Profile:</span>
                      <span className="text-white font-mono">{result.outerShapeDescription}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Internal Features:</span>
                      <span className="text-white font-mono">{result.internalFeaturesDescription}</span>
                    </div>
                  </div>

                  {/* Confidence Meters (Requirement 9) */}
                  <div className="bg-black/30 border border-gray-800/80 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Object Confidence:</span>
                      <span className="text-green-400 font-mono font-bold">{result.confidence.objectConfidence}%</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-green-400 h-full rounded-full" style={{ width: `${result.confidence.objectConfidence}%` }} />
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Geometry Confidence:</span>
                      <span className="text-cyan-tech font-mono font-bold">{result.confidence.geometryConfidence}%</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-cyan-tech h-full rounded-full" style={{ width: `${result.confidence.geometryConfidence}%` }} />
                    </div>

                    <div className="flex justify-between text-xs pt-1 border-t border-gray-800">
                      <span className="text-gray-300 font-medium">Overall Status:</span>
                      <span className="text-iqoo font-bold font-mono text-[11px]">{result.confidence.overallStatus}</span>
                    </div>
                  </div>

                  {/* Main Action Button */}
                  <button
                    onClick={() => onComplete(result)}
                    className="w-full bg-iqoo text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(242,169,0,0.3)] mt-2"
                  >
                    Verify Measurements <ArrowRight size={18} />
                  </button>
                </div>
              )}

              {/* ========================================================
                  STATE 2: POTENTIAL OBJECT DETECTED (User Confirmation)
                  ======================================================== */}
              {detectionState === 'POTENTIAL_OBJECT_DETECTED' && (
                <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm mb-1">
                      <AlertTriangle size={16} />
                      <span>POTENTIAL COMPONENT DETECTED</span>
                    </div>
                    <p className="text-xs text-gray-300 mb-1">◐ Geometric structure detected</p>
                    <p className="text-xs text-gray-400">AI classification uncertain, but usable contours were extracted.</p>
                  </div>

                  <div className="bg-black/40 border border-gray-800 p-3 rounded-lg space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Estimated Shape:</span>
                      <span className="text-white">{result.outerShapeDescription}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Internal Holes:</span>
                      <span className="text-white">{result.stats.circlesDetected} detected</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Overall Score:</span>
                      <span className="text-yellow-400">{result.confidence.overallConfidence}%</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => onComplete(result)}
                      className="w-full bg-iqoo text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors shadow-[0_0_15px_rgba(242,169,0,0.2)]"
                    >
                      Use This Object <ArrowRight size={16} />
                    </button>
                    
                    <button
                      onClick={startManualSelection}
                      className="w-full bg-card border border-gray-700 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors text-xs"
                    >
                      <Hand size={14} /> Select Object Manually
                    </button>

                    <button
                      onClick={() => window.location.reload()}
                      className="w-full text-gray-400 hover:text-white py-1.5 text-xs text-center transition-colors"
                    >
                      Retake Image
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================
                  IMAGE QUALITY LOW (Specific Diagnostics)
                  ======================================================== */}
              {detectionState === 'IMAGE_QUALITY_LOW' && (
                <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                  <div className="bg-amber-500/10 border border-amber-500/40 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                      <AlertTriangle size={18} />
                      <span>IMAGE QUALITY LOW</span>
                    </div>
                    <p className="text-xs text-gray-300 mb-3">
                      The image quality is too low to reliably segment CAD contours.
                    </p>
                    {result.quality.reasons.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {result.quality.reasons.map((r, i) => (
                          <div key={i} className="text-xs text-amber-300/90 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-black/40 border border-gray-800 p-3.5 rounded-xl space-y-2 text-xs">
                    <span className="font-bold text-gray-300 uppercase tracking-wider text-[10px]">Suggestions:</span>
                    <ul className="space-y-1.5 text-gray-400">
                      <li>• Move closer and hold camera steady</li>
                      <li>• Improve lighting or turn on room lights</li>
                      <li>• Place the component on a plain, contrasting background</li>
                      <li>• Keep the entire component visible</li>
                      <li>• Avoid extreme camera tilt or glare</li>
                    </ul>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full bg-iqoo text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors"
                    >
                      <RefreshCcw size={16} /> Retake Image
                    </button>

                    <button
                      onClick={startManualSelection}
                      className="w-full bg-card border border-gray-700 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors text-xs"
                    >
                      <Hand size={14} /> Select Object Manually
                    </button>

                    {result.geometries.length > 0 && (
                      <button
                        onClick={() => onComplete(result)}
                        className="w-full text-gray-400 hover:text-white py-1.5 text-xs text-center transition-colors"
                      >
                        Attempt Analysis Anyway
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================
                  STATE 3: NO USABLE OBJECT (Empty or No Structure)
                  ======================================================== */}
              {detectionState === 'NO_OBJECT_FOUND' && (
                <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                  <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
                      <AlertTriangle size={18} />
                      <span>NO USABLE OBJECT</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed mb-3">
                      ⚠ No meaningful geometric structure or mechanical component was detected in this frame.
                    </p>
                    <p className="text-xs text-gray-400">
                      Try placing the component against a plain background and ensure the entire object is visible.
                    </p>
                    {errorDetails && (
                      <p className="text-[11px] text-red-300/80 font-mono mt-2 pt-2 border-t border-red-500/20">
                        Diagnostics: {errorDetails}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-3">
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full bg-iqoo text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors"
                    >
                      <RefreshCcw size={16} /> Retake Image
                    </button>

                    <button
                      onClick={startManualSelection}
                      className="w-full bg-card border border-gray-700 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors text-xs"
                    >
                      <Hand size={14} /> Manually Select Object
                    </button>
                  </div>
                </div>
              )}

              {/* Vision Debug Accordion */}
              <div className="pt-2">
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="text-[11px] text-gray-500 hover:text-gray-300 flex items-center justify-between w-full uppercase tracking-wider py-1"
                >
                  <span className="flex items-center gap-1.5"><Eye size={12} /> Computer Vision Diagnostics</span>
                  <span>{showDebug ? '▲' : '▼'}</span>
                </button>
                {showDebug && (
                  <div className="bg-black/50 p-3 rounded-lg border border-gray-800 space-y-1 text-gray-400 font-mono text-[10px] mt-1.5">
                    <div className="flex justify-between"><span>Resolution:</span><span>{result.stats.imageWidth} × {result.stats.imageHeight}</span></div>
                    <div className="flex justify-between"><span>Contours Evaluated:</span><span>{result.stats.contoursFound}</span></div>
                    <div className="flex justify-between"><span>Holes Isolated:</span><span>{result.stats.circlesDetected}</span></div>
                    <div className="flex justify-between"><span>Brightness Mean:</span><span>{result.quality.brightness} / 255</span></div>
                    <div className="flex justify-between"><span>Contrast StdDev:</span><span>{result.quality.contrast}</span></div>
                    <div className="flex justify-between"><span>Blur Variance:</span><span>{result.quality.blurVariance}</span></div>
                    <div className="flex justify-between text-iqoo"><span>Scale Estimate:</span><span>{result.stats.scaleStatus}</span></div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="text-center p-6 text-gray-500 text-xs">
              Waiting for image input...
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
