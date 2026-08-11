
import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, Loader2, Edit2, Trash2, Calendar, CheckCircle2, Eye, FileSpreadsheet, Scale, ShieldAlert, X, FileArchive, Activity, AlertTriangle, PenTool, FileDown, FileType as FileTypeIcon, Download, History, ShieldCheck, Shield, MessageSquareText } from 'lucide-react';
import { ScannedFile, ProcessingStatus, ReviewStatus, ComplianceLevel } from '../types.ts';
import CalendarModal from './CalendarModal.tsx';
import AuditModal from './AuditModal.tsx';
import { downloadBlob, getFileExtension } from '../utils/helpers.ts';

interface FileItemProps {
  item: ScannedFile;
  isSelected: boolean;
  showSummary: boolean;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onRenameChange: (id: string, newName: string) => void;
  onReviewStatusChange?: (id: string, status: ReviewStatus) => void;
  onDownload: (id: string) => void;
  onEmail: (id: string) => void;
  onPreview: (file: ScannedFile) => void;
  onEdit?: (file: ScannedFile) => void;
  onFinalizeConversion?: (id: string, shouldConvert: boolean) => void;
  onChat?: (file: ScannedFile) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FileItem: React.FC<FileItemProps> = ({ 
  item, 
  isSelected,
  showSummary,
  onToggleSelect,
  onRemove, 
  onRenameChange, 
  onReviewStatusChange,
  onPreview,
  onEdit,
  onChat
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.suggestedName);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  useEffect(() => {
    if (!isEditing) setEditValue(item.suggestedName);
  }, [item.suggestedName, isEditing]);

  const handleReviewToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReviewStatusChange?.(item.id, item.reviewStatus === ReviewStatus.APPROVED ? ReviewStatus.NEW : ReviewStatus.APPROVED);
  };

  const isApproved = item.reviewStatus === ReviewStatus.APPROVED;
  const isError = item.status === ProcessingStatus.ERROR;
  const isProcessing = item.status === ProcessingStatus.PROCESSING;
  
  // Confidence Logic
  const confidence = item.metadata?.confidenceScore || 0;
  const isLowConfidence = confidence < 80;
  
  const getConfidenceColor = (score: number) => {
      if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      if (score >= 80) return 'text-amber-600 bg-amber-50 border-amber-200';
      return 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse';
  };

  const getComplianceIcon = (level: ComplianceLevel) => {
      switch(level) {
          case ComplianceLevel.COMPLIANT: return <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />;
          case ComplianceLevel.WARNING: return <Shield className="w-3.5 h-3.5 text-amber-500" />;
          case ComplianceLevel.NON_COMPLIANT: return <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />;
          default: return null;
      }
  };

  const getComplianceColor = (level: ComplianceLevel) => {
      switch(level) {
          case ComplianceLevel.COMPLIANT: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
          case ComplianceLevel.WARNING: return 'bg-amber-50 text-amber-700 border-amber-200';
          case ComplianceLevel.NON_COMPLIANT: return 'bg-rose-50 text-rose-700 border-rose-200';
          default: return 'bg-slate-50 text-slate-500 border-slate-200';
      }
  };

  const renderTag = (value: string | undefined, icon?: React.ReactNode, colorClass = "bg-slate-100 text-slate-800 border-slate-300") => {
      if (!value || value.toLowerCase() === "null" || value.toLowerCase() === "n/a" || value.trim() === "" || value.toLowerCase() === "nincs megadva") return null;
      return (
        <div className={`px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-black border uppercase flex items-center gap-1.5 whitespace-nowrap ${colorClass}`}>
           {icon}{value}
        </div>
      );
  };

  const handleDownloadOriginal = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (item.originalFileBlob) {
          downloadBlob(item.originalFileBlob, item.originalName);
      }
  };

  const handleDownloadProcessed = (e: React.MouseEvent) => {
      e.stopPropagation();
      const ext = getFileExtension(item.file);
      downloadBlob(item.file, `${item.suggestedName}.${ext}`);
  };

  // Timeline Step Logic
  const steps = [
    { label: 'Feltöltés', done: true },
    { label: 'AI Elemzés', done: item.status === ProcessingStatus.SUCCESS },
    { label: 'Véleményezés', done: item.reviewStatus === ReviewStatus.APPROVED },
    { label: 'Kész', done: item.reviewStatus === ReviewStatus.APPROVED }
  ];

  return (
    <div className={`bg-white rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 shadow-xl border transition-all relative group ${isSelected ? 'border-blue-600 bg-blue-50/30 ring-4 ring-blue-600/10' : (isError ? 'border-rose-400 bg-rose-50/40' : (isLowConfidence && item.status === ProcessingStatus.SUCCESS ? 'border-amber-400' : 'border-slate-300'))} ${isApproved ? 'bg-emerald-50/50 border-emerald-500' : ''}`}>
      
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start gap-4">
           <div className="flex items-center gap-4 shrink-0">
              <button onClick={() => onToggleSelect(item.id)} className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-800 border-blue-800 shadow-lg' : 'border-slate-400 bg-white'}`}>
                {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
              </button>

              <div className={`p-3 rounded-2xl shadow-sm ${isApproved ? 'bg-emerald-300 text-emerald-900' : (item.fileType === 'excel' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-600')}`}>
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin text-blue-700" /> : isError ? <X className="w-6 h-6 text-rose-700" /> : item.fileType === 'excel' ? <FileSpreadsheet className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
              </div>
           </div>

           <div className="flex-grow min-w-0 w-full">
             <div className="flex flex-wrap items-center gap-2 mb-1.5">
               <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest truncate max-w-[150px]">{item.originalName}</span>
               
               {/* Compliance Status Badge */}
               {item.status === ProcessingStatus.SUCCESS && (
                   <div className={`flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded uppercase border ${getComplianceColor(item.compliance?.level)}`} title={item.compliance?.issues.join(', ')}>
                     {getComplianceIcon(item.compliance?.level)} 
                     {item.compliance?.level === ComplianceLevel.COMPLIANT ? 'MEGFELELŐ' : (item.compliance?.level === ComplianceLevel.WARNING ? 'FIGYELMEZTETÉS' : 'KRITIKUS')}
                   </div>
               )}

               {item.sourceArchive && (
                  <div className="flex items-center gap-1 text-[8px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase border border-blue-200">
                    <FileArchive className="w-2.5 h-2.5" /> {item.sourceArchive}
                  </div>
               )}
               {item.wasConverted && (
                   <div className="flex items-center gap-1 text-[8px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded uppercase border border-indigo-200" title="Automatikusan konvertálva PDF-be">
                     <FileTypeIcon className="w-2.5 h-2.5" /> PDF KONVERTÁLT
                   </div>
               )}
               
               {item.status === ProcessingStatus.SUCCESS && (
                   <div className={`flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded uppercase ml-auto border ${getConfidenceColor(confidence)}`}>
                     <Activity className="w-3 h-3" /> {confidence}% PONTOSSÁG
                   </div>
               )}
             </div>
             {isEditing ? (
               <div className="flex items-center gap-2 w-full animate-in slide-in-from-left-2">
                 <input 
                   type="text" 
                   value={editValue} 
                   onChange={(e) => setEditValue(e.target.value)} 
                   className="w-full border-2 border-blue-700 rounded-xl px-4 py-2 text-sm font-bold shadow-lg focus:outline-none text-slate-900" 
                   autoFocus 
                   onKeyDown={(e) => e.key === 'Enter' && (onRenameChange(item.id, editValue), setIsEditing(false))}
                 />
                 <button onClick={() => { onRenameChange(item.id, editValue); setIsEditing(false); }} className="p-2 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 shadow-md transition-all"><CheckCircle className="w-5 h-5" /></button>
               </div>
             ) : (
               <div className="flex items-center gap-2 group/title w-full">
                 <p className={`text-sm sm:text-lg font-black break-words flex-grow ${isError ? 'text-rose-800' : 'text-slate-900'}`}>
                    {isError ? (item.errorMessage || 'Feldolgozási hiba') : (item.suggestedName || 'Elemzés folyamatban...')}
                 </p>
                 {!isApproved && !isError && item.status === ProcessingStatus.SUCCESS && <button onClick={() => setIsEditing(true)} className="p-2 text-slate-500 hover:text-blue-700 bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"><Edit2 className="w-4 h-4" /></button>}
               </div>
             )}
           </div>
        </div>

        {/* Approval Process Timeline */}
        {!isError && (
          <div className="flex items-center gap-1 px-1 py-1">
             {steps.map((step, idx) => (
                <div key={idx} className="flex-1 flex flex-col gap-1">
                   <div className={`h-1.5 rounded-full transition-all ${step.done ? (isApproved ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-slate-200'}`} />
                   {/* Only show labels on larger screens or for active step */}
                   <span className={`text-[8px] font-black uppercase text-center truncate ${step.done ? 'text-slate-600' : 'text-slate-300'}`}>{step.label}</span>
                </div>
             ))}
          </div>
        )}

        {/* Figyelmeztetés alacsony pontosság esetén */}
        {isLowConfidence && item.status === ProcessingStatus.SUCCESS && (
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 flex items-start gap-3 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                    <p className="text-[10px] font-black text-rose-700 uppercase tracking-wide">FOKOZOTT ELLENŐRZÉS SZÜKSÉGES!</p>
                    <p className="text-xs text-rose-900 font-medium">Az AI bizonytalan volt az adatok felismerésében ({confidence}%). Kérjük, ellenőrizze az eredeti fájlt.</p>
                    {item.metadata?.anomaly && <p className="text-[10px] text-rose-800 mt-1 italic">"{item.metadata.anomaly}"</p>}
                </div>
            </div>
        )}

        {showSummary && item.metadata?.summary && !isLowConfidence && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-300 space-y-2 animate-in fade-in slide-in-from-top-2">
             <div className="flex items-center gap-2 text-indigo-700">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-[9px] font-black uppercase tracking-tighter italic">Összefoglaló & Elemzés</span>
             </div>
             <p className="text-[11px] font-bold text-slate-900 leading-relaxed italic">"{item.metadata.summary}"</p>
             {item.metadata?.anomaly && (
                 <div className="mt-2 pt-2 border-t border-slate-200">
                     <span className="text-[9px] font-black text-amber-600 uppercase">Észlelt összefüggés / Anomália:</span>
                     <p className="text-[10px] text-slate-700">{item.metadata.anomaly}</p>
                 </div>
             )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-200">
           <div className="flex flex-wrap gap-2">
              {renderTag(item.metadata?.clientName, null, "bg-slate-900 text-white border-slate-900")}
              {renderTag(item.metadata?.opposingParty, null, "bg-rose-100 text-rose-900 border-rose-300")}
              {renderTag(item.metadata?.documentType, null, "bg-blue-100 text-blue-900 border-blue-300")}
              {renderTag(item.metadata?.projectName, null, "bg-indigo-100 text-indigo-900 border-indigo-300")}
              {item.metadata?.deadline && (
                <button onClick={() => setIsCalendarOpen(true)} className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-lg uppercase hover:bg-rose-100 transition-all shadow-md">
                  <Calendar className="w-3.5 h-3.5" /> Határidő rögzítése
                </button>
              )}
           </div>

           <div className="flex flex-wrap items-center gap-2 justify-end w-full sm:w-auto">
              
              {/* Audit Trail Button */}
              <button 
                onClick={() => setIsAuditOpen(true)} 
                className="p-2.5 text-slate-400 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-all border border-transparent" 
                title="Audit Napló megtekintése"
              >
                  <History className="w-5 h-5" />
              </button>

              {/* Chat Button (New) */}
              {item.status === ProcessingStatus.SUCCESS && onChat && (
                <button 
                  onClick={() => onChat(item)} 
                  className="p-2.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 rounded-xl transition-all border border-indigo-200" 
                  title="Kérdezzen a dokumentumról (Chat)"
                >
                   <MessageSquareText className="w-5 h-5" />
                </button>
              )}

              {item.status === ProcessingStatus.SUCCESS && (item.fileType === 'image' || item.fileType === 'docx') && onEdit && (
                <button onClick={() => onEdit(item)} className="p-2.5 text-slate-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-all border border-transparent" title="Szerkesztés"><PenTool className="w-5 h-5" /></button>
              )}
              
              {/* Preview Button */}
              {item.status === ProcessingStatus.SUCCESS && (
                <button onClick={() => onPreview(item)} className="p-2.5 text-slate-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-all border border-transparent" title="Megnyitás"><Eye className="w-5 h-5" /></button>
              )}
              
              {/* Original Download Button (only if converted) */}
              {item.status === ProcessingStatus.SUCCESS && item.originalFileBlob && (
                 <button 
                   onClick={handleDownloadOriginal} 
                   className="p-2.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-200" 
                   title="Eredeti fájl letöltése"
                 >
                    <FileDown className="w-5 h-5" />
                 </button>
              )}

              {/* Main Download / Status Button */}
              {item.status === ProcessingStatus.SUCCESS && !isError ? (
                <button 
                  onClick={(e) => isApproved ? handleDownloadProcessed(e) : handleReviewToggle(e)} 
                  className={`flex-grow sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 border border-transparent ${isApproved ? 'bg-emerald-700 text-white shadow-emerald-300 hover:bg-emerald-800' : 'bg-slate-900 text-white shadow-slate-600 hover:bg-blue-800'}`}
                >
                  {isApproved ? <Download className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isApproved ? 'LETÖLTÉS' : 'JÓVÁHAGYÁS'}
                </button>
              ) : (
                <button onClick={() => onRemove(item.id)} className="p-2.5 text-slate-500 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-all border border-transparent"><Trash2 className="w-5 h-5" /></button>
              )}
           </div>
        </div>
      </div>
      {isCalendarOpen && <CalendarModal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} file={item} />}
      {isAuditOpen && <AuditModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} file={item} />}
    </div>
  );
};

export default FileItem;
