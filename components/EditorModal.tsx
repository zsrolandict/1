
import React, { useState } from 'react';
import { X, Save, Type, RotateCw, Type as TextIcon } from 'lucide-react';
import { ScannedFile } from '../types.ts';

interface EditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: ScannedFile;
  onSave: (id: string, newContent: {html?: string, rotation?: number}) => void;
}

const EditorModal: React.FC<EditorModalProps> = ({ isOpen, onClose, file, onSave }) => {
  const [htmlContent, setHtmlContent] = useState(file.sourceHtml || "");
  const [rotation, setRotation] = useState(0);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(file.id, { html: file.fileType === 'docx' ? htmlContent : undefined, rotation });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-5xl h-full max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-black text-slate-900">Dokumentum szerkesztése</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{file.originalName}</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-all"><X className="w-6 h-6" /></button>
        </div>

        {/* Editor Body */}
        <div className="flex-grow p-8 overflow-y-auto bg-slate-100">
          {file.fileType === 'docx' ? (
            <div className="bg-white shadow-xl rounded-2xl p-8 min-h-full border border-slate-200">
               <textarea 
                  className="w-full h-[60vh] p-4 font-mono text-sm border-none focus:ring-0 focus:outline-none resize-none"
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder="Itt szerkesztheti a kinyert HTML kódot..."
               />
               <div className="mt-4 p-4 bg-blue-50 rounded-xl flex items-center gap-3 text-blue-700 text-xs font-bold">
                  <Type className="w-4 h-4" /> Tipp: A PDF automatikusan frissül a mentés után.
               </div>
            </div>
          ) : file.fileType === 'image' ? (
            <div className="flex flex-col items-center justify-center gap-8 h-full">
               <div className="relative bg-white p-4 rounded-3xl shadow-2xl border border-slate-200 transition-transform duration-500" style={{ transform: `rotate(${rotation}deg)` }}>
                  <img src={file.sourceImageUrl} alt="Original" className="max-h-[50vh] rounded-xl" />
               </div>
               <div className="flex gap-4">
                  <button onClick={() => setRotation(r => r + 90)} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all shadow-sm">
                    <RotateCw className="w-5 h-5" /> FORGATÁS
                  </button>
               </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 font-bold uppercase tracking-widest">
               Ezt a típusú PDF-et jelenleg nem lehet közvetlenül szerkeszteni.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-slate-50 flex justify-end gap-4">
          <button onClick={onClose} className="px-8 py-3 rounded-2xl text-slate-500 font-black text-sm hover:bg-slate-100 transition-all">MÉGSE</button>
          <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-slate-900 transition-all shadow-lg flex items-center gap-2">
            <Save className="w-4 h-4" /> VÁLTOZÁSOK MENTÉSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorModal;
