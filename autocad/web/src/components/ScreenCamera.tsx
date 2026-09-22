import { useEffect, useRef, useState } from 'react';
import { X, Aperture } from 'lucide-react';

interface Props {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function ScreenCamera({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        setError("Camera permission denied or unavailable. Please use image upload.");
      }
    }
    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      onCapture(canvas.toDataURL('image/jpeg'));
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 flex-1 h-full">
        <div className="bg-red-500/20 text-red-200 p-4 rounded-lg border border-red-500/50 mb-6 text-center">
          {error}
        </div>
        <button onClick={onCancel} className="bg-card px-6 py-3 rounded-lg border border-gray-700">Go Back</button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 bg-black flex flex-col">
      <div className="absolute top-4 left-0 right-0 z-10 flex justify-between px-4 items-center">
        <button onClick={onCancel} className="bg-black/50 p-2 rounded-full text-white backdrop-blur-md">
          <X size={24} />
        </button>
        <div className="bg-black/60 px-3 py-1 rounded-full text-xs text-cyan-tech border border-cyan-tech/30 font-mono">
          SCANNING MODE
        </div>
      </div>
      
      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Viewfinder overlay */}
        <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none transition-all">
          <div className="absolute inset-0 border-2 border-iqoo/50">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-iqoo -ml-1 -mt-1"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-iqoo -mr-1 -mt-1"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-iqoo -ml-1 -mb-1"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-iqoo -mr-1 -mb-1"></div>
          </div>
        </div>
        
        <div className="absolute bottom-32 left-0 right-0 text-center z-10 space-y-2 pointer-events-none drop-shadow-md text-sm font-medium">
          <p>Place the component inside the frame</p>
          <p className="text-yellow-300">Place a 50mm ArUco reference beside the object</p>
        </div>
      </div>
      
      <div className="h-28 bg-black flex items-center justify-center pb-4 z-10">
        <button 
          onClick={handleCapture}
          className="w-16 h-16 bg-transparent border-4 border-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all focus:scale-95"
        >
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
             <Aperture className="text-black" size={24} />
          </div>
        </button>
      </div>
    </div>
  );
}
