
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Camera, RefreshCw, Zap, Maximize, Check, AlertCircle } from 'lucide-react';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const ScanModal: React.FC<ScanModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFlashActive, setIsFlashActive] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          // Fix: Used 'ideal' property name for width as '理想' is not a valid property in media constraints.
          width: {ideal: 1920},
          // Fix: Used 'ideal' property name for height as '理想' is not a valid property in media constraints.
          height: {ideal: 1080}
        },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setError(null);
    } catch (err) {
      console.error("Kamera hiba:", err);
      setError("Nem sikerült elérni a kamerát. Ellenőrizze az engedélyeket!");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Villanás effektus
        setIsFlashActive(true);
        setTimeout(() => setIsFlashActive(false), 150);

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `scan_${new Date().getTime()}.jpg`, { type: 'image/jpeg' });
            onCapture(file);
            onClose();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Camera className="w-5 h-5" />
           </div>
           <div>
              <h3 className="text-white font-black text-sm uppercase tracking-widest">Dokumentum Szkennelés</h3>
              <p className="text-blue-400 text-[10px] font-bold">IGAZÍTSA KERETBE AZ IRATOT</p>
           </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera Viewport */}
      <div className="flex-grow relative overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-center p-8 space-y-4 animate-in zoom-in">
             <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
             <p className="text-white font-bold">{error}</p>
             <button onClick={startCamera} className="px-6 py-2 bg-white text-black rounded-xl font-black text-xs uppercase">Újrapróbálás</button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            
            {/* Guide Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-10">
               <div className="w-full max-w-md aspect-[1/1.4] border-2 border-white/30 rounded-[2rem] relative">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1 rounded-tl-2xl"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1 rounded-tr-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1 rounded-bl-2xl"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1 rounded-br-2xl"></div>
                  
                  <div className="absolute inset-0 flex items-center justify-center">
                     <Maximize className="w-12 h-12 text-white/10" />
                  </div>
               </div>
            </div>

            {/* Flash Effect */}
            {isFlashActive && <div className="absolute inset-0 bg-white z-20 animate-out fade-out duration-150" />}
          </>
        )}
      </div>

      {/* Footer / Controls */}
      <div className="p-10 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-12 relative z-10">
         <button 
           onClick={startCamera} 
           className="p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all"
         >
            <RefreshCw className="w-6 h-6" />
         </button>

         <button 
           onClick={capturePhoto}
           disabled={!!error || !stream}
           className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all group disabled:opacity-50"
         >
            <div className="w-16 h-16 rounded-full border-4 border-black/5 flex items-center justify-center">
               <div className="w-12 h-12 bg-blue-600 rounded-full group-hover:bg-blue-500 transition-colors"></div>
            </div>
         </button>

         <div className="w-14 h-14" /> {/* Spacer */}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ScanModal;
