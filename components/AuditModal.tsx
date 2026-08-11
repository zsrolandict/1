
import React from 'react';
import { X, Clock, User, Activity, FileText } from 'lucide-react';
import { ScannedFile } from '../types.ts';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: ScannedFile | null;
}

const AuditModal: React.FC<AuditModalProps> = ({ isOpen, onClose, file }) => {
  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                <Activity className="w-5 h-5" />
             </div>
             <div>
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">Audit Napló</h3>
                <p className="text-[10px] text-slate-500 font-bold truncate max-w-[200px]">{file.originalName}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="relative border-l-2 border-slate-100 ml-3 space-y-8">
                {file.auditLog.map((log, index) => (
                    <div key={log.id} className="relative pl-8">
                        {/* Timeline dot */}
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white bg-blue-500 shadow-sm ring-2 ring-blue-50"></div>
                        
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(log.timestamp).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 hover:border-blue-200 transition-colors">
                                <p className="text-sm font-bold text-slate-800">{log.action}</p>
                                {log.details && <p className="text-xs text-slate-500 mt-1">{log.details}</p>}
                                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
                                    <User className="w-3 h-3" /> {log.user}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {file.auditLog.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase">
                    Nincs elérhető előzmény
                </div>
            )}
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">A napló automatikusan rögzít minden módosítást.</p>
        </div>

      </div>
    </div>
  );
};

export default AuditModal;
