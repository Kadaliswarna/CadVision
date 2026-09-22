import { useState } from 'react';
import ScreenHome from './components/ScreenHome';
import ScreenCamera from './components/ScreenCamera';
import ScreenAnalysis from './components/ScreenAnalysis';
import ScreenMeasurements from './components/ScreenMeasurements';
import ScreenPreview from './components/ScreenPreview';
import type { Geometry } from './types/geometry';
import type { AnalysisResult } from './utils/cvHelper';

export type ScreenState = 'home' | 'camera' | 'analysis' | 'measurements' | 'preview';

function App() {
  const [screen, setScreen] = useState<ScreenState>('home');
  const [image, setImage] = useState<string | null>(null);
  
  // Real dynamic CV state
  const [geometries, setGeometries] = useState<Geometry[]>([]);
  const [debugImage, setDebugImage] = useState<string | null>(null);

  const handleCapture = (imgDataUrl: string) => {
    setImage(imgDataUrl);
    setScreen('analysis');
  };

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setGeometries(result.geometries);
    setDebugImage(result.debugImageBase64 || null);
    setScreen('measurements');
  };

  const steps = [
    { id: 'camera', label: 'Scan', number: 1 },
    { id: 'analysis', label: 'Analyze', number: 2 },
    { id: 'measurements', label: 'Verify', number: 3 },
    { id: 'preview', label: 'Generate CAD', number: 4 },
  ];

  const getStepIndex = (s: ScreenState) => {
    if (s === 'home' || s === 'camera') return 0;
    if (s === 'analysis') return 1;
    if (s === 'measurements') return 2;
    if (s === 'preview') return 3;
    return 0;
  };

  const currentStepIdx = getStepIndex(screen);

  return (
    <div className="min-h-screen bg-dark text-white flex flex-col font-sans">
      <header className="p-4 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-wider text-iqoo cursor-pointer" onClick={() => setScreen('home')}>
          iQOO CADVision
        </h1>
        
        {screen !== 'home' && (
          <div className="flex items-center text-xs font-mono md:text-sm gap-2 text-gray-500 overflow-x-auto whitespace-nowrap pb-1 md:pb-0">
            {steps.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-1 ${idx <= currentStepIdx ? 'text-cyan-tech' : ''}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${idx <= currentStepIdx ? 'bg-cyan-tech/20 text-cyan-tech' : 'bg-gray-800 text-gray-500'}`}>
                    {s.number}
                  </span>
                  <span className={idx === currentStepIdx ? 'font-bold' : ''}>{s.label}</span>
                </div>
                {idx < steps.length - 1 && <span className="text-gray-700">→</span>}
              </div>
            ))}
          </div>
        )}
      </header>
      
      <main className="flex-1 flex flex-col overflow-y-auto">
        {screen === 'home' && <ScreenHome onNavigate={setScreen} onUpload={handleCapture} />}
        {screen === 'camera' && <ScreenCamera onCapture={handleCapture} onCancel={() => setScreen('home')} />}
        {screen === 'analysis' && <ScreenAnalysis image={image} onComplete={handleAnalysisComplete} />}
        {screen === 'measurements' && (
          <ScreenMeasurements 
            image={debugImage || image}
            geometries={geometries} 
            onChange={setGeometries} 
            onNext={() => setScreen('preview')} 
            onRetry={() => {
              setImage(null);
              setScreen('home');
            }}
          />
        )}
        {screen === 'preview' && (
          <ScreenPreview 
            image={image}
            geometries={geometries} 
            onEdit={() => setScreen('measurements')} 
            onNewScan={() => {
              setImage(null);
              setGeometries([]);
              setScreen('home');
            }} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
