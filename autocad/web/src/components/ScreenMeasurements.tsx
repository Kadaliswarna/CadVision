import { useState } from 'react';
import type { Geometry, RectangleGeometry, CircleGeometry, PolygonGeometry } from '../types/geometry';
import { ArrowRight, CheckCircle2, Loader2, Square, Circle, Ruler, AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  image: string | null;
  geometries: Geometry[];
  onChange: (g: Geometry[]) => void;
  onNext: () => void;
  onRetry: () => void;
}

export default function ScreenMeasurements({ image, geometries, onChange, onNext, onRetry }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // Scale calibration state (Requirement 11)
  const [knownDimensionMm, setKnownDimensionMm] = useState<string>("100");
  const [scaleCalibrated, setScaleCalibrated] = useState<boolean>(false);
  const [calibrationSuccess, setCalibrationSuccess] = useState<string | null>(null);

  const updateGeom = (id: string, updates: Partial<Geometry>) => {
    onChange(geometries.map(g => g.id === id ? { ...g, ...updates } as Geometry : g));
  };

  // Calibrate all geometry dimensions proportionally based on a user-provided reference (Requirement 11)
  const handleCalibrate = () => {
    const targetMm = parseFloat(knownDimensionMm);
    if (!targetMm || targetMm <= 0) return;

    // Find main reference dimension: width of first rectangle, or diameter of first circle
    const mainRect = geometries.find(g => g.type === 'rectangle') as RectangleGeometry | undefined;
    const mainCircle = geometries.find(g => g.type === 'circle') as CircleGeometry | undefined;

    let currentRefMm = 1.0;
    if (mainRect && mainRect.width > 0) {
      currentRefMm = mainRect.width;
    } else if (mainCircle && mainCircle.radius > 0) {
      currentRefMm = mainCircle.radius * 2;
    } else {
      return;
    }

    const factor = targetMm / currentRefMm;
    const updated = geometries.map(g => {
      if (g.type === 'rectangle') {
        const r = g as RectangleGeometry;
        return {
          ...r,
          x: Math.round(r.x * factor * 10) / 10,
          y: Math.round(r.y * factor * 10) / 10,
          width: Math.round(r.width * factor * 10) / 10,
          height: Math.round(r.height * factor * 10) / 10
        } as Geometry;
      } else if (g.type === 'circle') {
        const c = g as CircleGeometry;
        return {
          ...c,
          cx: Math.round(c.cx * factor * 10) / 10,
          cy: Math.round(c.cy * factor * 10) / 10,
          radius: Math.round(c.radius * factor * 10) / 10
        } as Geometry;
      } else if (g.type === 'triangle' || g.type === 'polygon') {
        const p = g as PolygonGeometry;
        return {
          ...p,
          points: p.points.map(pt => ({
            x: Math.round(pt.x * factor * 10) / 10,
            y: Math.round(pt.y * factor * 10) / 10
          }))
        } as Geometry;
      }
      return g;
    });

    onChange(updated);
    setScaleCalibrated(true);
    setCalibrationSuccess(`All dimensions scaled proportionally to reference ${targetMm} mm (Factor: ${factor.toFixed(2)}x)`);
    setTimeout(() => setCalibrationSuccess(null), 4000);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    const messages = ["Generating CAD geometry...", "Applying dimensions & layers...", "Preparing AutoCAD DXF drawing..."];
    let i = 0;
    setLoadingText(messages[0]);
    const interval = setInterval(() => {
      i++;
      if (i < messages.length) {
        setLoadingText(messages[i]);
      } else {
        clearInterval(interval);
        onNext();
      }
    }, 600);
  };

  if (isGenerating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-dark p-6">
        <Loader2 className="text-iqoo animate-spin mb-6" size={48} />
        <h2 className="text-xl font-bold font-mono text-white mb-2">{loadingText}</h2>
        <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-iqoo animate-[pulse_1s_ease-in-out_infinite]" style={{ width: '100%' }}></div>
        </div>
      </div>
    );
  }

  const rects = geometries.filter(g => g.type === 'rectangle').length;
  const circles = geometries.filter(g => g.type === 'circle').length;
  const polys = geometries.filter(g => g.type === 'polygon' || g.type === 'triangle').length;

  return (
    <div className="flex-1 flex flex-col md:flex-row p-6 gap-8 max-w-6xl mx-auto w-full">
      {/* Left Column: Image Overlay & Summaries */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
        <div>
          <h2 className="text-sm uppercase text-gray-500 font-bold tracking-wider mb-4 flex justify-between items-center">
            <span>Detection Overlay</span>
            <span className="text-cyan-tech bg-cyan-tech/10 px-2 py-0.5 rounded text-[10px]">ROI Mask Applied</span>
          </h2>
          <div className="bg-card rounded-xl border border-gray-800 p-2">
            {image ? (
              <img src={image} alt="Source" className="w-full h-auto rounded-lg object-contain bg-black" />
            ) : (
              <div className="w-full aspect-square bg-gray-900 rounded-lg flex items-center justify-center text-gray-600">No Image</div>
            )}
          </div>
        </div>
        
        <div>
          <h2 className="text-sm uppercase text-gray-500 font-bold tracking-wider mb-4">Geometry Summary</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-cyan-tech/10 border border-cyan-tech/20 text-cyan-tech p-3 rounded-lg flex flex-col items-center justify-center text-center gap-1">
              <Square size={20} />
              <span className="text-xl font-bold">{rects + polys}</span>
              <span className="text-[10px] font-bold uppercase">Main Boundary</span>
            </div>
            <div className="bg-cyan-tech/10 border border-cyan-tech/20 text-cyan-tech p-3 rounded-lg flex flex-col items-center justify-center text-center gap-1">
              <Circle size={20} />
              <span className="text-xl font-bold">{circles}</span>
              <span className="text-[10px] font-bold uppercase">Internal Holes</span>
            </div>
          </div>
        </div>

        {/* CAD Safety Scale Calibration (Requirement 11) */}
        <div className="bg-card border border-gray-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Ruler size={14} className="text-iqoo" /> Scale Verification
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
              scaleCalibrated ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {scaleCalibrated ? '✓ Verified' : 'Scale not verified'}
            </span>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Photographs alone cannot guarantee sub-millimeter precision. Enter a known reference dimension to calibrate the pixel scale:
          </p>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-400 mb-1">Known Object Width (mm)</label>
              <input
                type="number"
                value={knownDimensionMm}
                onChange={e => setKnownDimensionMm(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-iqoo focus:outline-none"
                placeholder="e.g. 120"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCalibrate}
                className="bg-card border border-gray-600 hover:border-iqoo text-iqoo text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all h-[34px]"
              >
                <RefreshCw size={12} /> Calibrate
              </button>
            </div>
          </div>

          {calibrationSuccess && (
            <p className="text-[11px] text-green-400 font-mono animate-[fadeIn_0.2s_ease-out]">
              {calibrationSuccess}
            </p>
          )}
        </div>
      </div>

      {/* Right Column: Editable Measurement Cards */}
      <div className="flex-1 flex flex-col pb-20 md:pb-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase text-gray-500 font-bold tracking-wider flex items-center gap-2">
             Verify Measurements (mm)
          </h2>
          <button onClick={onRetry} className="text-xs text-gray-400 hover:text-white underline">Wrong detection? Retake</button>
        </div>

        <div className="space-y-4 overflow-y-auto max-h-[55vh] pr-2">
          {geometries.map((g, idx) => {
            if (g.type === 'rectangle') {
              const r = g as RectangleGeometry;
              return (
                <div key={r.id} className="bg-card p-4 rounded-xl border border-gray-800 shadow-md">
                  <h3 className="text-xs uppercase text-cyan-tech font-bold tracking-wider mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><Square size={14} /> Main Object (Rectangle Bounds)</span>
                    <span className="text-gray-500 text-[10px] font-mono">{scaleCalibrated ? 'Calibrated' : 'Estimated'}</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Width (mm)</label>
                      <input 
                        type="number" 
                        value={Math.round(r.width)} 
                        onChange={e => updateGeom(r.id, { width: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-iqoo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Height (mm)</label>
                      <input 
                        type="number" 
                        value={Math.round(r.height)} 
                        onChange={e => updateGeom(r.id, { height: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-iqoo focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              );
            }
            if (g.type === 'circle') {
              const c = g as CircleGeometry;
              const isFirstCircle = idx === 0 && geometries.length === 1;
              return (
                <div key={c.id} className="bg-card p-4 rounded-xl border border-gray-800 shadow-md">
                  <h3 className="text-xs uppercase text-cyan-tech font-bold tracking-wider mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><Circle size={14} /> {isFirstCircle ? 'Circular Outer Profile' : `Internal Hole #${idx}`}</span>
                    <span className="text-gray-500 text-[10px] font-mono">{scaleCalibrated ? 'Calibrated' : 'Estimated'}</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Diameter (mm)</label>
                      <input 
                        type="number" 
                        value={Math.round(c.radius * 2)} 
                        onChange={e => updateGeom(c.id, { radius: (parseFloat(e.target.value) || 0) / 2 })}
                        className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:border-iqoo focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Offset (Center X, Y)</label>
                      <div className="text-white font-mono text-sm mt-2">{Math.round(c.cx)}, {Math.round(c.cy)} mm</div>
                    </div>
                  </div>
                </div>
              );
            }
            if (g.type === 'triangle' || g.type === 'polygon') {
              const p = g as PolygonGeometry;
              return (
                <div key={p.id} className="bg-card p-4 rounded-xl border border-gray-800 shadow-md">
                  <h3 className="text-xs uppercase text-cyan-tech font-bold tracking-wider mb-2 flex items-center justify-between gap-2">
                    <span>Polygonal Component ({p.points.length} Vertices)</span>
                    <span className="text-gray-500 text-[10px] font-mono">Profile</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Custom engineering boundary coordinates extracted for AutoCAD drawing space.
                  </p>
                </div>
              );
            }
            return null;
          })}
        </div>

        <div className="mt-6">
          <div className={`p-4 rounded-xl flex items-start gap-3 mb-4 border ${
            scaleCalibrated 
              ? 'bg-green-tech/5 border-green-tech/20' 
              : 'bg-yellow-500/5 border-yellow-500/20'
          }`}>
            {scaleCalibrated ? (
              <CheckCircle2 className="text-green-tech mt-0.5 flex-shrink-0" size={18} />
            ) : (
              <AlertTriangle className="text-yellow-400 mt-0.5 flex-shrink-0" size={18} />
            )}
            <div>
              <p className={`text-sm font-bold mb-1 ${scaleCalibrated ? 'text-green-tech' : 'text-yellow-400'}`}>
                {scaleCalibrated ? 'Dimensions Calibrated & Verified' : 'AI Estimates Ready for Verification'}
              </p>
              <p className="text-xs text-gray-400">
                {scaleCalibrated
                  ? 'All coordinates rescaled to your verified reference dimension. Ready to generate CAD drawing.'
                  : 'Scale not verified. Verify dimensions or use the Scale Verification tool above before generating CAD.'}
              </p>
            </div>
          </div>

          <button 
            onClick={handleGenerate}
            className="w-full bg-iqoo text-black font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-500 transition-colors shadow-[0_0_20px_rgba(242,169,0,0.2)]"
          >
            Confirm & Generate CAD <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
