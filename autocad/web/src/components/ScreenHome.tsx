import { Camera, ImageUp, Image as ImageIcon } from 'lucide-react';
import { useRef } from 'react';

interface Props {
  onNavigate: (screen: 'camera') => void;
  onUpload: (dataUrl: string) => void;
}

export default function ScreenHome({ onNavigate, onUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          onUpload(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const loadDemo = (demoFile: string) => {
    onUpload(`/sample_data/${demoFile}`);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 flex-1 max-w-lg mx-auto w-full">
      <div className="text-center space-y-4 mb-10">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
          Real-World Object <span className="text-iqoo block mt-2">→ Intelligent CAD Drawing</span>
        </h2>
        <p className="text-text-muted text-sm leading-relaxed text-gray-400 max-w-sm mx-auto">
          Scan a physical component and convert its geometry into CAD-ready data.
        </p>
      </div>

      <div className="w-full space-y-4 mb-8">
        <button 
          onClick={() => onNavigate('camera')}
          className="w-full bg-iqoo text-black font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-yellow-500 transition-colors shadow-[0_0_20px_rgba(242,169,0,0.3)]"
        >
          <Camera size={24} />
          Scan with Camera
        </button>
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-card border border-gray-700 text-white font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-800 transition-colors"
        >
          <ImageUp size={24} />
          Upload Image
        </button>
        
        <input 
          type="file" 
          accept="image/png, image/jpeg, image/webp" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
        />
      </div>

      <div className="w-full bg-black/50 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-4 font-bold">Try Mechanical Sample Images</h3>
        <div className="grid grid-cols-2 gap-2.5">
           <button onClick={() => loadDemo('machined_plate.jpg')} className="bg-card text-xs text-iqoo font-medium py-2 px-3 rounded flex items-center gap-2 hover:bg-gray-800 border border-iqoo/40">
             <ImageIcon size={14} className="text-iqoo"/> Machined Plate
           </button>
           <button onClick={() => loadDemo('circular_flange.jpg')} className="bg-card text-xs text-iqoo font-medium py-2 px-3 rounded flex items-center gap-2 hover:bg-gray-800 border border-iqoo/40">
             <ImageIcon size={14} className="text-iqoo"/> Steel Flange
           </button>
           <button onClick={() => loadDemo('mounting_bracket.jpg')} className="bg-card text-xs text-iqoo font-medium py-2 px-3 rounded flex items-center gap-2 hover:bg-gray-800 border border-iqoo/40">
             <ImageIcon size={14} className="text-iqoo"/> Mount Bracket
           </button>
           <button onClick={() => loadDemo('mechanical_plate_mvp.png')} className="bg-card text-xs text-cyan-tech font-medium py-2 px-3 rounded flex items-center gap-2 hover:bg-gray-800 border border-cyan-tech/40">
             <ImageIcon size={14} className="text-cyan-tech"/> Plate with 4 Holes
           </button>
           <button onClick={() => loadDemo('blurry_sample.png')} className="bg-card text-xs text-amber-400 py-2 px-3 rounded flex items-center gap-2 hover:bg-gray-800 border border-amber-500/30">
             <ImageIcon size={14} className="text-amber-400"/> Blurry Image Test
           </button>
           <button onClick={() => loadDemo('empty_blank.png')} className="bg-card text-xs text-red-400 py-2 px-3 rounded flex items-center gap-2 hover:bg-gray-800 border border-red-500/30">
             <ImageIcon size={14} className="text-red-400"/> Empty Frame Test
           </button>
        </div>
        <p className="text-[10px] text-gray-500 mt-4 text-center">
          Click any sample above to test automated CAD geometry extraction and dimensional verification.
        </p>
      </div>
    </div>
  );
}
