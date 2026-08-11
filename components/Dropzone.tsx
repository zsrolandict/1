
import React, { useRef, useState } from 'react';
import { Upload, FileUp, Keyboard, FileArchive, FileCode, FileSpreadsheet } from 'lucide-react';

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const validateAndAddFiles = (fileList: FileList | null) => {
      if (fileList && fileList.length > 0) {
        const validFiles = Array.from(fileList).filter(
          (file) => {
              const mime = file.type.toLowerCase();
              const lowerName = file.name.toLowerCase();
              
              // MIME típus ellenőrzés vagy kiterjesztés fallback
              return (
                mime.includes('pdf') || lowerName.endsWith('.pdf') ||
                mime.startsWith('image/') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png') || lowerName.endsWith('.webp') ||
                mime.includes('spreadsheetml') || mime.includes('excel') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') ||
                mime.includes('wordprocessingml') || lowerName.endsWith('.docx') ||
                mime.includes('zip') || lowerName.endsWith('.zip') ||
                lowerName.endsWith('.es3')
              );
          }
        );
        
        if (validFiles.length > 0) {
          onFilesAdded(validFiles);
        } else {
          alert("A rendszer számára nem támogatott fájltípus vagy üres fájl.");
        }
      }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    validateAndAddFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndAddFiles(e.target.files);
    if (e.target) e.target.value = '';
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-500
        flex flex-col items-center justify-center gap-6 group relative overflow-hidden
        ${isDragOver 
          ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' 
          : 'border-slate-200 hover:border-blue-400 hover:bg-white bg-white/50 shadow-sm'
        }
      `}
    >
      {isDragOver && <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />}
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept="application/pdf,image/jpeg,image/png,image/webp,.docx,.xlsx,.xls,.zip,application/zip,.es3"
        multiple
        className="hidden"
      />
      
      <div className={`p-6 rounded-3xl transition-all duration-500 ${isDragOver ? 'bg-blue-600 text-white rotate-12 scale-110 shadow-2xl' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 group-hover:-rotate-3'}`}>
        {isDragOver ? (
          <FileArchive className="w-12 h-12" />
        ) : (
          <div className="flex gap-1">
            <FileCode className="w-12 h-12" />
            <FileSpreadsheet className="w-6 h-6 text-emerald-500 mt-auto" />
          </div>
        )}
      </div>

      <div className="relative z-10">
        <p className="text-2xl font-black text-slate-900 tracking-tight">
          Húzd ide a dokumentumokat
        </p>
        <div className="flex items-center justify-center gap-2 mt-2 text-slate-500 font-medium">
           <p className="text-sm">Vagy másolás után</p>
           <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-[10px] font-black">
              <Keyboard className="w-3 h-3" />
              CTRL+V
           </div>
           <p className="text-sm">beillesztés</p>
        </div>
      </div>
      
      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-2">
        PDF • EXCEL • WORD • IMAGE • ZIP • ES3
      </p>
    </div>
  );
};

export default Dropzone;
