
import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, Hash, Calendar, FileType, User, Briefcase, Banknote, FileImage, Minimize2, Palette, Scale, HelpCircle, FileCheck, Ban } from 'lucide-react';
import { formatSuggestedName } from '../utils/helpers.ts';
import { ExtractedMetadata, PdfExportSettings } from '../types.ts';
import TokenReorder from './TokenReorder.tsx';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFormat: string;
  currentPdfSettings: PdfExportSettings;
  onSave: (newFormat: string, newSettings: PdfExportSettings) => void;
}

type Tab = 'general' | 'export';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentFormat, currentPdfSettings, onSave }) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [format, setFormat] = useState(currentFormat);
  
  const [pdfSettings, setPdfSettings] = useState<PdfExportSettings>(currentPdfSettings);

  useEffect(() => {
    if (isOpen) {
      setFormat(currentFormat);
      setPdfSettings(currentPdfSettings);
      setActiveTab('general');
    }
  }, [isOpen, currentFormat, currentPdfSettings]);

  if (!isOpen) return null;

  const handleTokenClick = (token: string) => {
    if (format.includes(token)) {
      let newFormat = format.replace(token, '');
      newFormat = newFormat.replace(/\s*,\s*,/g, ',');
      newFormat = newFormat.replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '');
      setFormat(newFormat);
    } else {
      let newFormat = format;
      const conflicts: Record<string, string[]> = {
          '{DateHU}': ['{DateEN}', '{Date}'],
          '{DateEN}': ['{DateHU}', '{Date}'],
          '{Date}': ['{DateHU}', '{DateEN}']
      };
      if (conflicts[token]) {
          conflicts[token].forEach(conflict => {
              newFormat = newFormat.replace(conflict, '');
          });
          newFormat = newFormat.replace(/\s*,\s*,/g, ',');
          newFormat = newFormat.replace(/^\s*,\s*/, '').replace(/\s*,\s*$/, '');
      }
      const needsSeparator = newFormat.length > 0 && !newFormat.endsWith(' ') && !newFormat.endsWith(',') && !newFormat.endsWith('-') && !newFormat.endsWith('_') && !newFormat.endsWith('/');
      setFormat(newFormat + (needsSeparator ? ', ' : '') + token);
    }
  };

  const handleSave = () => {
    onSave(format, pdfSettings);
    onClose();
  };

  const mockMetadata: ExtractedMetadata = {
    clientName: "Kovács Kft",
    documentType: "Számla",
    date: "2025 12 12",
    referenceNumber: "2025/0014",
    projectName: "Weboldal fejlesztés",
    amount: "150.000 Ft",
    opposingParty: "Minta Ellenoldal Zrt",
    department: "FIN"
  };

  const previewName = formatSuggestedName(mockMetadata, format);
  const isTokenUsed = (token: string) => format.includes(token);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">Beállítások</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-5">
           <button
             onClick={() => setActiveTab('general')}
             className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
           >
             Fájl elnevezés
           </button>
           <button
             onClick={() => setActiveTab('export')}
             className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'export' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
           >
             PDF Exportálás
           </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-grow">
          
          {activeTab === 'general' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fájlnév formátum
                  </label>
                  
                  <div className="mb-3">
                     <TokenReorder format={format} onChange={setFormat} />
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="Pl. {Year} {Client} - {Project}"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Alapadatok
                  </label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button onClick={() => handleTokenClick('{Department}')} className={`token-btn ${isTokenUsed('{Department}') ? 'bg-orange-100 text-orange-800 border-orange-300 ring-1 ring-orange-300' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-600'}`}>
                      <Briefcase className="w-3.5 h-3.5" /> Üzletág
                    </button>
                    <button onClick={() => handleTokenClick('{Client}')} className={`token-btn ${isTokenUsed('{Client}') ? 'bg-blue-100 text-blue-800 border-blue-300 ring-1 ring-blue-300' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}>
                      <User className="w-3.5 h-3.5" /> Ügyfél
                    </button>
                    <button onClick={() => handleTokenClick('{OpposingParty}')} className={`token-btn ${isTokenUsed('{OpposingParty}') ? 'bg-red-100 text-red-800 border-red-300 ring-1 ring-red-300' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'}`}>
                      <Scale className="w-3.5 h-3.5" /> Ellenérdekű fél
                    </button>
                    <button onClick={() => handleTokenClick('{Type}')} className={`token-btn ${isTokenUsed('{Type}') ? 'bg-purple-100 text-purple-800 border-purple-300 ring-1 ring-purple-300' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-600'}`}>
                      <FileType className="w-3.5 h-3.5" /> Típus
                    </button>
                    <button onClick={() => handleTokenClick('{Reference}')} className={`token-btn ${isTokenUsed('{Reference}') ? 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-300' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-600'}`}>
                      <Hash className="w-3.5 h-3.5" /> Ref.
                    </button>
                    <button onClick={() => handleTokenClick('{Project}')} className={`token-btn ${isTokenUsed('{Project}') ? 'bg-indigo-100 text-indigo-800 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}>
                      <Briefcase className="w-3.5 h-3.5" /> Projekt
                    </button>
                    <button onClick={() => handleTokenClick('{Amount}')} className={`token-btn ${isTokenUsed('{Amount}') ? 'bg-rose-100 text-rose-800 border-rose-300 ring-1 ring-rose-300' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-rose-600'}`}>
                      <Banknote className="w-3.5 h-3.5" /> Összeg
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <RefreshCw className="w-3 h-3 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Előnézet</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 break-all">
                    {previewName}.pdf
                  </p>
                </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                   <label className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                     <FileType className="w-4 h-4 text-blue-500" />
                     Automatikus konverzió alapbeállítása
                   </label>
                   <div className="grid grid-cols-1 gap-2">
                      <button 
                        onClick={() => setPdfSettings({...pdfSettings, autoConvertBehavior: 'ask'})}
                        className={`p-4 rounded-2xl border flex items-center gap-4 transition-all text-left ${pdfSettings.autoConvertBehavior === 'ask' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                      >
                         <HelpCircle className="w-5 h-5 opacity-50" />
                         <div>
                            <p className="text-sm font-black uppercase">Kérdezzen rá (Visszaszámlálás)</p>
                            <p className="text-[10px] opacity-70">A feltöltéskor 5 másodpercet vár a döntésre.</p>
                         </div>
                      </button>
                      <button 
                        onClick={() => setPdfSettings({...pdfSettings, autoConvertBehavior: 'pdf'})}
                        className={`p-4 rounded-2xl border flex items-center gap-4 transition-all text-left ${pdfSettings.autoConvertBehavior === 'pdf' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                      >
                         <FileCheck className="w-5 h-5 text-blue-500" />
                         <div>
                            <p className="text-sm font-black uppercase">Mindig konvertálja PDF-be</p>
                            <p className="text-[10px] opacity-70">Office és képfájlok azonnal PDF-be kerülnek.</p>
                         </div>
                      </button>
                      <button 
                        onClick={() => setPdfSettings({...pdfSettings, autoConvertBehavior: 'original'})}
                        className={`p-4 rounded-2xl border flex items-center gap-4 transition-all text-left ${pdfSettings.autoConvertBehavior === 'original' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                      >
                         <Ban className="w-5 h-5 text-rose-500" />
                         <div>
                            <p className="text-sm font-black uppercase">Maradjon az eredeti formátum</p>
                            <p className="text-[10px] opacity-70">Soha nem konvertál automatikusan.</p>
                         </div>
                      </button>
                   </div>
                </div>

                <div className="border-t border-slate-100 pt-6 space-y-6">
                   <div>
                      <label className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                        <Palette className="w-4 h-4 text-slate-500" />
                        Színmód
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                         <button 
                           onClick={() => setPdfSettings({...pdfSettings, colorMode: 'color'})}
                           className={`p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${pdfSettings.colorMode === 'color' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                         >
                            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-400 to-rose-400"></div>
                            <span className="font-medium text-sm">Színes</span>
                         </button>
                         <button 
                            onClick={() => setPdfSettings({...pdfSettings, colorMode: 'grayscale'})}
                            className={`p-3 rounded-lg border flex items-center justify-center gap-2 transition-all ${pdfSettings.colorMode === 'grayscale' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                         >
                            <div className="w-4 h-4 rounded-full bg-gray-500"></div>
                            <span className="font-medium text-sm">Szürke</span>
                         </button>
                      </div>
                   </div>

                   <div className="flex items-start justify-between bg-slate-50 p-4 rounded-2xl">
                      <div>
                         <label className="text-sm font-black uppercase flex items-center gap-2">
                             <Minimize2 className="w-4 h-4 text-slate-500" />
                             Tömörítés (Auto)
                         </label>
                         <p className="text-[10px] text-slate-500 font-bold">PDF méretének csökkentése mentéskor.</p>
                      </div>
                      <button onClick={() => setPdfSettings({...pdfSettings, autoCompress: !pdfSettings.autoCompress})} className={`relative inline-flex h-6 w-11 rounded-full border-2 transition-colors ${pdfSettings.autoCompress ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${pdfSettings.autoCompress ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                   </div>
                </div>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 mt-auto">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 text-sm hover:bg-slate-200 rounded-lg">Mégse</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-2"><Save className="w-4 h-4" />Mentés</button>
        </div>
      </div>
      <style>{`.token-btn { display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; border-width: 1px; transition: all 150ms; }`}</style>
    </div>
  );
};

export default SettingsModal;
