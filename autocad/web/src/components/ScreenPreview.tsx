import { useEffect, useRef, useState } from 'react';
import type { Geometry, RectangleGeometry, CircleGeometry, PolygonGeometry } from '../types/geometry';
import { generateDXF } from '../utils/dxfGenerator';
import { Download, CheckCircle2, ArrowLeft, Send, X, Loader2, FileCode2 } from 'lucide-react';

interface Props {
  image: string | null;
  geometries: Geometry[];
  onEdit: () => void;
  onNewScan: () => void;
}

export default function ScreenPreview({ image, geometries, onEdit, onNewScan }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalState, setModalState] = useState<'connecting' | 'success'>('connecting');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Find bounds of all geometry to center it
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (geometries.length === 0) return;
    
    geometries.forEach(g => {
      if (g.type === 'rectangle') {
        const r = g as RectangleGeometry;
        minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
      } else if (g.type === 'circle') {
        const c = g as CircleGeometry;
        minX = Math.min(minX, c.cx - c.radius); minY = Math.min(minY, c.cy - c.radius);
        maxX = Math.max(maxX, c.cx + c.radius); maxY = Math.max(maxY, c.cy + c.radius);
      } else if (g.type === 'triangle' || g.type === 'polygon') {
        const p = g as PolygonGeometry;
        p.points.forEach(pt => {
           minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y);
           maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y);
        });
      }
    });

    const geomWidth = maxX - minX;
    const geomHeight = maxY - minY;

    const padding = 60;
    const availWidth = canvas.width - padding * 2;
    const availHeight = canvas.height - padding * 2;
    
    // Default scale if math fails (e.g. point)
    const scale = (geomWidth === 0 || geomHeight === 0) ? 1 : Math.min(availWidth / geomWidth, availHeight / geomHeight);
    
    const offsetX = (canvas.width - (geomWidth * scale)) / 2 - (minX * scale);
    const offsetY = (canvas.height - (geomHeight * scale)) / 2 - (minY * scale);

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw Grid
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 20 * scale;
    // Draw a bounding grid
    for (let x = minX * scale; x <= maxX * scale + gridSize; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, minY * scale - gridSize); ctx.lineTo(x, maxY * scale + gridSize); ctx.stroke();
    }
    for (let y = minY * scale; y <= maxY * scale + gridSize; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(minX * scale - gridSize, y); ctx.lineTo(maxX * scale + gridSize, y); ctx.stroke();
    }

    // Draw Geometries
    geometries.forEach(g => {
       if (g.type === 'rectangle') {
         const r = g as RectangleGeometry;
         ctx.strokeStyle = '#00E676';
         ctx.lineWidth = 3;
         ctx.fillStyle = 'rgba(0, 230, 118, 0.05)';
         ctx.beginPath();
         ctx.rect(r.x * scale, r.y * scale, r.width * scale, r.height * scale);
         ctx.fill();
         ctx.stroke();

         // Dimensions
         ctx.fillStyle = '#A0A0A0';
         ctx.font = '12px monospace';
         ctx.textAlign = 'center';
         ctx.fillText(`${Math.round(r.width)} mm`, r.x * scale + (r.width * scale) / 2, r.y * scale - 15);
         ctx.save();
         ctx.translate(r.x * scale + r.width * scale + 25, r.y * scale + (r.height * scale) / 2);
         ctx.rotate(Math.PI / 2);
         ctx.fillText(`${Math.round(r.height)} mm`, 0, 0);
         ctx.restore();
       } else if (g.type === 'circle') {
         const c = g as CircleGeometry;
         ctx.beginPath();
         ctx.arc(c.cx * scale, c.cy * scale, c.radius * scale, 0, Math.PI * 2);
         ctx.strokeStyle = '#00E5FF';
         ctx.lineWidth = 2;
         ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
         ctx.fill();
         ctx.stroke();

         // Center mark
         ctx.beginPath();
         ctx.moveTo(c.cx * scale - 10, c.cy * scale); ctx.lineTo(c.cx * scale + 10, c.cy * scale);
         ctx.moveTo(c.cx * scale, c.cy * scale - 10); ctx.lineTo(c.cx * scale, c.cy * scale + 10);
         ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
         ctx.lineWidth = 1;
         ctx.stroke();
       } else if (g.type === 'triangle' || g.type === 'polygon') {
         const p = g as PolygonGeometry;
         if (p.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(p.points[0].x * scale, p.points[0].y * scale);
            for(let i=1; i<p.points.length; i++) {
               ctx.lineTo(p.points[i].x * scale, p.points[i].y * scale);
            }
            ctx.closePath();
            ctx.strokeStyle = '#F2A900';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(242, 169, 0, 0.1)';
            ctx.fill();
            ctx.stroke();
         }
       }
    });

    ctx.restore();
  }, [geometries]);

  const handleDownloadDXF = () => {
    const dxfString = generateDXF(geometries);
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cadvision_generated.dxf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendToAutoCAD = () => {
    // Also trigger actual download as requested
    handleDownloadDXF();
    
    setShowModal(true);
    setModalState('connecting');
    setTimeout(() => {
      setModalState('success');
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row p-6 gap-8 max-w-6xl mx-auto w-full relative">
      
      {/* Left Column: Details & Actions */}
      <div className="w-full md:w-1/3 flex flex-col gap-6">
        
        <div className="flex gap-4 mb-2">
          {image && (
            <div className="w-24 h-24 rounded-lg overflow-hidden border border-gray-700 flex-shrink-0 bg-black">
              <img src={image} alt="Source" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="flex flex-col justify-center text-sm space-y-1 text-gray-300">
            <h2 className="text-white font-bold mb-1">Generated Data</h2>
            <p>{geometries.filter(g=>g.type==='rectangle').length} × Rectangle</p>
            <p>{geometries.filter(g=>g.type==='circle').length} × Circles</p>
            <p>{geometries.filter(g=>g.type==='triangle' || g.type==='polygon').length} × Polygons</p>
          </div>
        </div>

        <div className="space-y-3 bg-card p-4 rounded-xl border border-gray-800">
          <div className="text-xs uppercase text-gray-500 font-bold mb-2">Status</div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <CheckCircle2 size={16} className="text-green-tech" /> Geometry generated
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <CheckCircle2 size={16} className="text-green-tech" /> Dimensions applied
          </div>
          <div className="flex items-center gap-2 text-sm text-white font-bold">
            <CheckCircle2 size={16} className="text-green-tech" /> CAD data ready
          </div>
        </div>

        <div className="mt-auto space-y-3 pt-6">
          <button 
            onClick={handleSendToAutoCAD}
            className="w-full bg-cyan-tech text-black font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-cyan-400 transition-colors shadow-[0_0_20px_rgba(0,229,255,0.2)]"
          >
            <Send size={20} /> Send to AutoCAD
          </button>
          
          <button 
            onClick={handleDownloadDXF}
            className="w-full bg-card border border-gray-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
          >
            <Download size={18} /> Download DXF
          </button>

          <button 
            onClick={onEdit}
            className="w-full bg-transparent text-gray-400 hover:text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft size={18} /> Edit Measurements
          </button>
        </div>
      </div>

      {/* Right Column: CAD Preview */}
      <div className="flex-1 bg-black rounded-xl border border-gray-800 shadow-inner flex flex-col overflow-hidden min-h-[400px]">
        <div className="p-3 border-b border-gray-800 bg-card/50 flex items-center justify-between">
          <div className="text-xs font-mono text-cyan-tech flex items-center gap-2">
            <FileCode2 size={14} /> cadvision_generated.dwg
          </div>
          <div className="text-xs text-gray-500">Dynamic CAD Preview</div>
        </div>
        
        <div className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 to-black p-4">
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* AutoCAD Integration Modal */}
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-card w-full max-w-md rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Send size={18} className="text-cyan-tech" />
                AutoCAD Integration Demo
              </h3>
              {modalState === 'success' && (
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="p-8 flex flex-col items-center text-center">
              {modalState === 'connecting' ? (
                <>
                  <Loader2 size={48} className="text-cyan-tech animate-spin mb-6" />
                  <h2 className="text-xl font-bold mb-2">Connecting to AutoCAD...</h2>
                  <p className="text-gray-400 text-sm">Generating DXF and pushing to cloud.</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-tech/20 border border-green-tech flex items-center justify-center mb-6">
                    <CheckCircle2 size={32} className="text-green-tech" />
                  </div>
                  <h2 className="text-xl font-bold mb-4 text-green-tech">✓ CAD file generated successfully</h2>
                  
                  <div className="w-full bg-black/50 rounded-lg p-4 text-left border border-gray-800 mb-6 font-mono text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-gray-500">Filename:</span><span className="text-cyan-tech">cadvision_generated.dxf</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Entities:</span><span className="text-white">{geometries.length} features</span></div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-gray-800"><span className="text-gray-500">Status:</span><span className="text-green-tech font-bold uppercase">Ready</span></div>
                  </div>

                  <p className="text-xs text-gray-400 mb-6 font-medium bg-gray-900 p-2 rounded">
                    Open the downloaded DXF in AutoCAD.
                  </p>
                  <p className="text-xs text-gray-500 mb-6 italic">Prototype mode — automatic CAD opening simulated.</p>

                  <button 
                    onClick={() => {
                      setShowModal(false);
                      onNewScan();
                    }}
                    className="w-full bg-iqoo text-black font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
