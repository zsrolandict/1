import React, { useState, useEffect } from 'react';
import { X, ExternalLink, FileText, Image as ImageIcon, FileWarning, FileSpreadsheet, Download, Loader2, Info } from 'lucide-react';
import { ScannedFile } from '../types.ts';
import { renderPdfFirstPage } from '../utils/helpers.ts';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: ScannedFile | null;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ isOpen, onClose, file }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [pdfThumb, setPdfThumb] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (file && isOpen) {
      setLoading(true);
      const isPdf = file.file.type === 'application/pdf' || file.file.name.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        renderPdfFirstPage(file.file).then(thumb => {
          setPdfThumb(thumb);
          setLoading(false);
        }).catch(() => {
          setLoading(false);
        });
      } else {
        const objectUrl = URL.createObjectURL(file.file);
        setUrl(objectUrl);
        setLoading(false);
      }
      
      return () => {
        if (url) URL.revokeObjectURL(url);
        setUrl(null);
        setPdfThumb(null);
      };
    }
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  const isPdf = file.file.type === 'application/pdf' || file.file.name.toLowerCase().endsWith('.pdf');
  const isExcel = file.fileType === 'excel';
  const isImage = file.fileType === 'image' || file.file.type.startsWith('image/');

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
             <div className="p-2 bg-blue-600 rounded-xl text-white shadow-sm shrink-0">
                {isPdf ? <FileText className="w-5 h-5" /> : isExcel ? <FileSpreadsheet className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
             </div>
             <div className="flex flex-col min-w-0">
                <h3 className="font-black text-slate-800 text-sm truncate">{file.suggestedName}</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{file.originalName}</span>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const downloadUrl = pdfThumb ? URL.createObjectURL(file.file) : url;
                if(downloadUrl) window.open(downloadUrl, '_blank');
              }}
              className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600 flex items-center gap-1 font-bold text-[10px]"
            >
               <ExternalLink className="w-4 h-4" /> MEGNYITÁS
            </button>
            <button onClick={onClose} className="p-2 hover:bg-rose-100 hover:text-rose-600 rounded-xl transition-colors text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-grow bg-slate-200 relative overflow-y-auto flex items-center justify-center p-4 sm:p-10">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
               <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
               <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Renderelés...</p>
            </div>
          ) : isPdf && pdfThumb ? (
            <div className="flex flex-col items-center gap-6 w-full h-full max-w-full">
               <div className="bg-white p-2 sm:p-4 rounded-xl shadow-2xl max-w-full overflow-hidden flex-shrink min-h-0">
                  <img src={pdfThumb} alt="PDF Preview" className="max-w-full max-h-[60vh] object-contain" />
               </div>
               <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-200 flex items-center gap-4 max-w-sm shrink-0">
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-[10px] sm:text-[11px] font-bold text-blue-700 leading-tight">Ez egy gyorsnézet az első oldalról. A teljes dokumentumot a Megnyitás vagy Letöltés gombbal érheti el.</p>
               </div>
            </div>
          ) : isImage && url ? (
             <img src={url} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl bg-white rounded-lg" />
          ) : (
            <div className="bg-white p-8 sm:p-12 rounded-3xl text-center space-y-6 shadow-xl border border-slate-100 max-w-sm m-4">
               <div className="p-6 bg-slate-100 text-slate-400 rounded-2xl w-fit mx-auto">
                  {isExcel ? <FileSpreadsheet className="w-16 h-16" /> : <FileWarning className="w-16 h-16" />}
               </div>
               <div>
                 <h4 className="text-lg font-black text-slate-900">{isExcel ? 'Excel Dokumentum' : 'Nincs előnézet'}</h4>
                 <p className="text-xs text-slate-500 font-medium mt-2">A közvetlen betekintés ennél a típusnál nem elérhető.</p>
               </div>
               <button 
                 onClick={() => {
                   const downloadUrl = url || URL.createObjectURL(file.file);
                   const a = document.createElement('a');
                   a.href = downloadUrl;
                   a.download = file.file.name;
                   document.body.appendChild(a);
                   a.click();
                   document.body.removeChild(a);
                 }}
                 className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2"
               >
                 <Download className="w-4 h-4" /> LETÖLTÉS
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;