
import React, { useState, useEffect } from 'react';
import { X, Calendar, Download, Clock, Mail, CheckSquare, Square, Copy, Check, Send, AlertTriangle, FileText, Bell, Hash } from 'lucide-react';
import { generateIcsFile, generateIcsBlob, calculateDeadlineDate, generateEmlFile } from '../utils/helpers.ts';
import { ScannedFile } from '../types.ts';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: ScannedFile;
}

const PRESET_REMINDERS = [
  { label: 'Nincs emlékeztető', value: 0 },
  { label: '1 órával előtte', value: 60 },
  { label: '3 órával előtte', value: 180 },
  { label: '1 nappal előtte', value: 1440 },
  { label: '2 nappal előtte', value: 2880 },
  { label: '1 héttel előtte', value: 10080 },
  { label: 'Egyéni...', value: -1 },
];

const UNIT_FACTORS: Record<string, number> = {
  'perc': 1,
  'óra': 60,
  'nap': 1440,
  'hét': 10080
};

const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, file }) => {
  const meta = file.metadata;
  const initialData = {
    title: `HATÁRIDŐ: ${meta?.clientName || 'Ügyfél'} - ${meta?.documentType || 'Dokumentum'}`,
    description: `Teendő: ${meta?.deadlineAction || 'Felülvizsgálat'}\nÜgyfél: ${meta?.clientName}\nProjekt: ${meta?.projectName}\nÖsszefoglaló: ${meta?.summary}`,
    dateRaw: meta?.deadline || "",
    fileName: file.suggestedName
  };

  const initialDateObj = calculateDeadlineDate(new Date().toISOString().split('T')[0], initialData.dateRaw);
  
  const [title, setTitle] = useState(initialData.title);
  const [date, setDate] = useState(initialDateObj.toISOString().split('T')[0]);
  const [time, setTime] = useState("08:00");
  const [presetValue, setPresetValue] = useState<number>(1440);
  
  // Egyéni emlékeztető állapot
  const [customValue, setCustomValue] = useState(1);
  const [customUnit, setCustomUnit] = useState('nap');

  const [attachFile, setAttachFile] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState("");

  const defaultBody = `Tisztelt Ügyfelünk / Kolléga!

Tájékoztatjuk, hogy az alábbi dokumentummal kapcsolatban határidős feladat merült fel:

DOKUMENTUM ADATOK:
-------------------------------------------
Ügyfél: ${meta?.clientName || 'Nincs megadva'}
Típus: ${meta?.documentType || 'Nincs megadva'}
Projekt: ${meta?.projectName || 'Nincs megadva'}
Iktatószám: ${meta?.referenceNumber || 'Nincs megadva'}

HATÁRIDŐ ÉS TEENDŐ:
-------------------------------------------
Határidő napja: ${date}
Sürgősségi szint: ${meta?.urgency || 'Normál'}
Elvégzendő feladat: ${meta?.deadlineAction || 'Kérjük a dokumentum tartalmának felülvizsgálatát és a szükséges jogi lépések megtételét.'}

ÖSSZEFOGLALÓ:
-------------------------------------------
"${meta?.summary || 'Nincs elérhető összefoglaló.'}"

Kérjük, a fenti határidőt szíveskedjenek naptárukban is rögzíteni.

Üdvözlettel,
ICT Europa Smart Autodoc Pro - Jogi Asszisztens`;

  const [emailBody, setEmailBody] = useState(defaultBody);

  useEffect(() => { setEmailBody(defaultBody); }, [date, meta]);

  if (!isOpen) return null;

  const getFinalDate = () => new Date(`${date}T${time}`);
  const getReminderMinutes = () => presetValue === -1 ? (customValue * UNIT_FACTORS[customUnit]) : presetValue;

  const handleGenerateEml = async () => {
    const finalDate = getFinalDate();
    const finalReminderMinutes = getReminderMinutes();
    
    // JAVÍTÁS: Email generálásnál withBom = false, hogy ne legyen BOM karakter a MIME streamben
    const icsBlob = generateIcsBlob(title, emailBody, finalDate, finalReminderMinutes, false);
    const attachments = [{ file: icsBlob, name: "hatarido_bejegyzés.ics" }];
    
    if (attachFile) {
        const ext = file.file.name.split('.').pop();
        attachments.push({ file: file.file, name: `${file.suggestedName}.${ext}` });
    }
    
    await generateEmlFile(partnerEmail, title, emailBody, attachments);
    onClose();
  };

  const handleGenerateIcsOnly = () => {
    const finalDate = getFinalDate();
    const finalReminderMinutes = getReminderMinutes();
    // Közvetlen letöltésnél a generateIcsFile alapértelmezésben withBom = true-val hívja meg a generálást, ami helyes.
    generateIcsFile(title, emailBody, finalDate, "hatarido_bejegyzés.ics", finalReminderMinutes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
             <Calendar className="w-5 h-5 text-rose-600" />
             <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Határidő & Email Ügyintézés</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {/* Dátum és Idő */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Határidő Dátuma</label>
              <div className="relative">
                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                 <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Emlékeztető Időpont</label>
              <div className="relative">
                 <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                 <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900" />
              </div>
            </div>
          </div>

          {/* Emlékeztető Választó */}
          <div className="space-y-3">
             <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Bell className="w-3.5 h-3.5" /> Emlékeztessen ennyivel előtte:
             </label>
             <div className="flex flex-col gap-3">
                 <select 
                    value={presetValue} 
                    onChange={(e) => setPresetValue(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900"
                 >
                    {PRESET_REMINDERS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                 </select>

                 {presetValue === -1 && (
                     <div className="flex items-center gap-3 animate-in slide-in-from-top-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                         <div className="relative flex-1">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="number" 
                                value={customValue} 
                                onChange={(e) => setCustomValue(Math.max(1, Number(e.target.value)))}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm font-bold"
                            />
                         </div>
                         <select 
                            value={customUnit} 
                            onChange={(e) => setCustomUnit(e.target.value)}
                            className="w-1/3 px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold bg-white"
                         >
                            <option value="perc">perc</option>
                            <option value="óra">óra</option>
                            <option value="nap">nap</option>
                            <option value="hét">hét</option>
                         </select>
                     </div>
                 )}
             </div>
          </div>

          {/* Email törzs szerkesztő */}
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                   <Mail className="w-3.5 h-3.5" /> Email üzenet tervezete / Naptár leírás
                </span>
                <button 
                  onClick={() => { navigator.clipboard.writeText(emailBody); setCopyFeedback(true); setTimeout(()=>setCopyFeedback(false),2000); }} 
                  className="flex items-center gap-1.5 text-[9px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200 shadow-sm"
                >
                  {copyFeedback ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copyFeedback ? 'MÁSOLVA' : 'MÁSOLÁS'}
                </button>
             </div>
             <textarea 
                value={emailBody} 
                onChange={(e) => setEmailBody(e.target.value)} 
                rows={10} 
                className="w-full px-4 py-4 rounded-2xl border border-slate-300 text-[11px] font-bold leading-relaxed bg-slate-50 focus:bg-white transition-colors custom-scrollbar outline-none focus:ring-2 focus:ring-blue-200 text-slate-900" 
             />
             
             <div className="flex flex-wrap gap-4">
                <button onClick={() => setAttachFile(!attachFile)} className="flex items-center gap-2 group text-slate-900 transition-colors">
                   {attachFile ? <CheckSquare className="w-4 h-4 text-rose-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                   <span className="text-[10px] font-black uppercase tracking-widest">Eredeti dokumentum csatolása (Csak Emailhez)</span>
                </button>
             </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
             <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Címzett (Partner/Ügyfél)</label>
             <input type="email" value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} placeholder="pelda@ugyfel.hu" className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-900" />
          </div>
        </div>

        <div className="p-6 bg-slate-50 flex flex-col gap-3 shrink-0 border-t border-slate-200">
           <div className="flex gap-3">
                <button 
                    onClick={handleGenerateIcsOnly} 
                    className="flex-1 px-5 py-4 bg-white text-slate-900 border border-slate-300 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-slate-100 transition-all uppercase tracking-widest"
                >
                    <Download className="w-4 h-4" /> 
                    Csak Naptár (.ics)
                </button>
                <button 
                    onClick={handleGenerateEml} 
                    className="flex-[2] px-5 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-xl hover:bg-blue-700 transition-all uppercase tracking-widest active:scale-95"
                >
                    <Send className="w-4 h-4" /> 
                    Email & Naptár (.eml)
                </button>
           </div>
          <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-slate-500">
             <AlertTriangle className="w-3 h-3 text-amber-600" /> 
             Az .eml fájl megnyitásával az Outlook/Thunderbird azonnal előkészíti a levelet.
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarModal;
