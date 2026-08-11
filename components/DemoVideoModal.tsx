
import React, { useState, useEffect, useRef } from 'react';
// Added CheckCircle2 to the lucide-react imports
import { X, Play, Loader2, Sparkles, Video, Mic, Info, ExternalLink, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

declare var window: any;

interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEMO_NARRATION = "Üdvözöljük az ICT Europa Smart Autodoc világában. Ez az alkalmazás mesterséges intelligencia segítségével elemzi, átnevezi és rendszerezi dokumentumait. Legyen szó PDF-ről, Word-ről vagy képről, a rendszer pillanatok alatt kinyeri a legfontosabb adatokat, határidőket és projekt neveket. Próbálja ki a jövő dokumentumkezelését még ma!";

const DemoVideoModal: React.FC<DemoVideoModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'init' | 'key' | 'generating' | 'ready' | 'error'>('init');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('init');
      setVideoUrl(null);
      setAudioBuffer(null);
    }
  }, [isOpen]);

  const handleStartGeneration = async () => {
    if (!window.aistudio) {
      setError("AI Studio API nem elérhető.");
      setStep('error');
      return;
    }

    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      setStep('key');
      return;
    }

    generateDemo();
  };

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    generateDemo();
  };

  const decodeAudio = async (base64: string, ctx: AudioContext) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  };

  const generateDemo = async () => {
    setStep('generating');
    setProgress(10);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 1. TTS Hang generálása
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say professionally: ${DEMO_NARRATION}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });
      setProgress(40);

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        const buffer = await decodeAudio(base64Audio, audioContextRef.current);
        setAudioBuffer(buffer);
      }

      // 2. Veo Videó generálása
      setProgress(50);
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'A cinematic high-tech 3D animation of a futuristic scanner digitizing paper documents into organized folders, glowing data labels, blue and white aesthetics, corporate style.',
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
        setProgress(p => Math.min(95, p + 5));
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const videoRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await videoRes.blob();
        setVideoUrl(URL.createObjectURL(blob));
      }

      setStep('ready');
      setProgress(100);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("entity was not found")) {
        setStep('key');
      } else {
        setError(err.message || "Ismeretlen hiba a generálás során.");
        setStep('error');
      }
    }
  };

  const handlePlay = () => {
    if (videoRef.current && audioBuffer && audioContextRef.current) {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      source.start();

      // Feliratozás szimulálása a hang hossza alapján
      const words = DEMO_NARRATION.split(' ');
      const totalDuration = audioBuffer.duration;
      const wordTime = totalDuration / words.length;

      words.forEach((word, i) => {
        setTimeout(() => {
          setCurrentSubtitle(words.slice(Math.max(0, i-5), i+1).join(' '));
        }, i * wordTime * 1000);
      });

      source.onended = () => {
        setCurrentSubtitle("");
      };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-6 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl">
                <Video className="w-6 h-6" />
             </div>
             <h3 className="text-xl font-black text-white">AI App Bemutató</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-grow flex flex-col items-center justify-center p-10 space-y-8 min-h-[400px]">
          
          {step === 'init' && (
            <div className="text-center space-y-6 animate-in zoom-in-95">
               <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/20">
                  <Sparkles className="w-12 h-12 text-white animate-pulse" />
               </div>
               <div>
                  <h4 className="text-2xl font-black text-white">Generáljunk egy demó videót?</h4>
                  <p className="text-slate-400 max-w-md mx-auto mt-2">A mesterséges intelligencia készít egy rövid bemutatót magyar narrációval és felirattal.</p>
               </div>
               <button 
                 onClick={handleStartGeneration}
                 className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-500 transition-all shadow-lg active:scale-95"
               >
                 VIDEÓ KÉSZÍTÉSE
               </button>
            </div>
          )}

          {step === 'key' && (
            <div className="text-center space-y-6 animate-in slide-in-from-bottom-4">
               <div className="p-6 bg-amber-500/10 text-amber-500 rounded-3xl w-fit mx-auto">
                  <Info className="w-12 h-12" />
               </div>
               <div>
                  <h4 className="text-xl font-black text-white">Fizetős API Kulcs Szükséges</h4>
                  <p className="text-slate-400 max-w-sm mx-auto mt-2">A videó generáláshoz egy számlázással összekötött projekt API kulcsára van szükség.</p>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-indigo-400 text-xs font-bold flex items-center justify-center gap-1 mt-3 hover:underline">
                    SZÁMLÁZÁSI DOKUMENTÁCIÓ <ExternalLink className="w-3 h-3" />
                  </a>
               </div>
               <button 
                 onClick={handleSelectKey}
                 className="px-10 py-4 bg-white text-slate-900 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all shadow-lg"
               >
                 API KULCS KIVÁLASZTÁSA
               </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="w-full max-w-md space-y-8 animate-in fade-in">
               <div className="relative flex justify-center">
                  <Loader2 className="w-24 h-24 text-indigo-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">{progress}%</div>
               </div>
               <div className="text-center space-y-4">
                  <h4 className="text-xl font-black text-white uppercase tracking-widest">AI Alkotás folyamatban...</h4>
                  <div className="flex justify-center gap-4">
                     <div className={`flex items-center gap-2 text-xs font-bold ${progress > 40 ? 'text-emerald-400' : 'text-slate-500'}`}><Mic className="w-4 h-4" /> Hang</div>
                     <div className={`flex items-center gap-2 text-xs font-bold ${progress > 80 ? 'text-emerald-400' : 'text-slate-500'}`}><Video className="w-4 h-4" /> Videó</div>
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase font-black px-8">Ez a folyamat 1-2 percet is igénybe vehet, kérjük várjon türelemmel.</p>
               </div>
            </div>
          )}

          {step === 'ready' && videoUrl && (
            <div className="w-full relative group animate-in zoom-in-95 duration-500">
               <div className="aspect-video bg-black rounded-[2rem] overflow-hidden shadow-2xl relative border border-slate-700">
                  <video ref={videoRef} src={videoUrl} className="w-full h-full object-cover" />
                  
                  {currentSubtitle && (
                    <div className="absolute bottom-10 left-0 right-0 px-10 text-center animate-in slide-in-from-bottom-2">
                       <span className="bg-black/60 backdrop-blur-md text-white px-6 py-2 rounded-xl text-lg font-bold shadow-2xl border border-white/10">
                          {currentSubtitle}
                       </span>
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-100 group-hover:opacity-100 transition-opacity">
                     <button onClick={handlePlay} className="p-6 bg-white text-slate-900 rounded-full hover:scale-110 transition-transform shadow-2xl">
                        <Play className="w-10 h-10 fill-current" />
                     </button>
                  </div>
               </div>
               <div className="mt-6 flex justify-between items-center px-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                    <CheckCircle2 className="w-4 h-4" /> Generálás kész
                  </div>
                  <button onClick={generateDemo} className="text-[10px] font-black text-slate-400 hover:text-white uppercase underline">Újra generálás</button>
               </div>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center space-y-6">
               <div className="p-6 bg-rose-500/10 text-rose-500 rounded-3xl w-fit mx-auto">
                  <X className="w-12 h-12" />
               </div>
               <div>
                  <h4 className="text-xl font-black text-white">Hiba történt</h4>
                  <p className="text-slate-400 max-w-sm mx-auto mt-2">{error}</p>
               </div>
               <button 
                 onClick={handleStartGeneration}
                 className="px-10 py-4 bg-slate-700 text-white rounded-2xl font-black text-sm hover:bg-slate-600 transition-all"
               >
                 PRÓBÁLJA ÚJRA
               </button>
            </div>
          )}

        </div>

        <div className="p-6 bg-slate-900/50 border-t border-slate-700 flex justify-end">
           <button onClick={onClose} className="px-6 py-2 text-slate-400 font-bold hover:text-white transition-colors">BEZÁRÁS</button>
        </div>
      </div>
    </div>
  );
};

export default DemoVideoModal;
