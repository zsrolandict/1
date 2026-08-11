
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Download, Trash2, Settings, Loader2, LayoutGrid, Search, X, Tag, FileSpreadsheet, Briefcase, FolderOutput, Sparkles, CheckSquare, Square, CheckCircle2, Camera, AlertCircle, FileArchive, ChevronRight, FileText, Ban, Zap, Scale, Filter, Type, Folder, CornerDownRight, FileDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import Dropzone from './components/Dropzone.tsx';
import FileItem from './components/FileItem.tsx';
import SettingsModal from './components/SettingsModal.tsx';
import FilePreviewModal from './components/FilePreviewModal.tsx';
import EditorModal from './components/EditorModal.tsx';
import ScanModal from './components/ScanModal.tsx';
import TokenReorder from './components/TokenReorder.tsx';
import DocumentChatModal from './components/DocumentChatModal.tsx';
import { ScannedFile, ProcessingStatus, ReviewStatus, PdfExportSettings, ViewMode, ExtractedMetadata, ComplianceLevel } from './types.ts';
import { extractMetadata } from './services/geminiService.ts';
import { fileToBase64, formatSuggestedName, convertImageToPdf, convertWordToPdf, extractFilesFromEs3, extractFilesFromZip, validateMetadata, getDocumentStats, downloadBlob, exportMetadataToCsv, isSupportedFile, getGeminiMimeType, rotateImage, getFileExtension, createAuditLog, evaluateCompliance } from './utils/helpers.ts';

const DEFAULT_FORMAT = "{Client}, {Type}, {DateHU}";
const STORAGE_KEY = "autodoc_naming_format";
const PDF_SETTINGS_KEY = "autodoc_pdf_settings";

const DEPARTMENTS = [
  { id: 'AUTO', label: 'AUTO (AI)' },
  { id: 'Finance', label: 'Pénzügy' },
  { id: 'Audit', label: 'Audit' },
  { id: 'Legal', label: 'Jogi' },
  { id: 'Payroll', label: 'Bérszámfejtés' },
  { id: 'HR', label: 'HR' },
  { id: 'Advisory', label: 'Tanácsadás' },
];

const App: React.FC = () => {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [unprocessedFiles, setUnprocessedFiles] = useState<{name: string, source: string}[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentDepartment, setCurrentDepartment] = useState<string>("AUTO");
  const [namingFormat, setNamingFormat] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_FORMAT);
  const [pdfSettings, setPdfSettings] = useState<PdfExportSettings>(() => {
    const saved = localStorage.getItem(PDF_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : { colorMode: 'color', dpi: 'original', autoCompress: false, autoConvertBehavior: 'ask' };
  });
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<ScannedFile | null>(null);
  const [editingFile, setEditingFile] = useState<ScannedFile | null>(null);
  const [chatFile, setChatFile] = useState<ScannedFile | null>(null);
  const [filterReviewStatus, setFilterReviewStatus] = useState<ReviewStatus | 'ALL'>('ALL');
  const [showAiSummary, setShowAiSummary] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const originalFilesMap = useRef<Map<string, File>>(new Map());

  // PWA Install Prompt Listener
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  // Archívumok és tartalmuk csoportosítása hierarchikus megjelenítéshez
  const archiveGroups = useMemo(() => {
    const groups: Record<string, ScannedFile[]> = { 'direct': [] };
    files.forEach(f => {
      const key = f.sourceArchive || 'direct';
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  }, [files]);

  const archives = useMemo(() => {
    // Most már a 'direct' kulcsot is visszaadjuk, hogy megjelenjen a listában
    return Object.keys(archiveGroups).sort((a, b) => {
        if (a === 'direct') return -1; // Egyedi fájlok legfelül
        if (b === 'direct') return 1;
        return a.localeCompare(b);
    });
  }, [archiveGroups]);

  useEffect(() => { 
    localStorage.setItem(STORAGE_KEY, namingFormat);
    localStorage.setItem(PDF_SETTINGS_KEY, JSON.stringify(pdfSettings));
  }, [namingFormat, pdfSettings]);

  useEffect(() => {
    setFiles(prev => prev.map(f => {
      if (f.status === ProcessingStatus.SUCCESS && f.metadata) {
        return { ...f, suggestedName: formatSuggestedName(f.metadata, namingFormat, currentDepartment) };
      }
      return f;
    }));
  }, [currentDepartment, namingFormat]);

  const docStats = getDocumentStats(files);

  const filteredFiles = files.filter(f => {
    const matchesSearch = f.originalName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (f.suggestedName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (f.metadata?.clientName || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterReviewStatus === 'ALL' || f.reviewStatus === filterReviewStatus;
    return matchesSearch && matchesFilter;
  });

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    const visibleIds = filteredFiles.map(f => f.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  }, [filteredFiles, selectedIds]);

  const addFileToSystem = async (file: File, originalName: string, sourceArchive?: string) => {
    const id = uuidv4();
    originalFilesMap.current.set(id, file);
    const lowerName = originalName.toLowerCase();
    let fileType: 'pdf' | 'docx' | 'image' | 'excel' = 'pdf';
    if (lowerName.endsWith('.docx')) fileType = 'docx';
    else if (lowerName.match(/\.(jpg|jpeg|png|webp)$/)) fileType = 'image';
    else if (lowerName.match(/\.(xlsx|xls)$/)) fileType = 'excel';
    
    // Kezdeti állapot létrehozása (Init Audit Log)
    setFiles(prev => [...prev, { 
        id, 
        file, 
        fileType, 
        status: ProcessingStatus.PROCESSING, 
        reviewStatus: ReviewStatus.NEW, 
        originalName, 
        suggestedName: originalName, 
        wasConverted: false, 
        sourceArchive,
        sourceImageUrl: fileType === 'image' ? URL.createObjectURL(file) : undefined,
        originalFileBlob: undefined,
        auditLog: [createAuditLog("Feltöltés", `Eredeti fájl: ${originalName}`)],
        compliance: { level: ComplianceLevel.COMPLIANT, issues: [], gdprFlag: false }
    }]);
    
    const processFile = async (retries = 2) => {
        try {
          let processingFile = file;
          let wasConverted = false;
          let originalBlob = undefined;

          // 1. Automatikus konverzió ellenőrzése és végrehajtása
          if (pdfSettings.autoConvertBehavior === 'pdf') {
              if (fileType === 'image') {
                  originalBlob = file;
                  const result = await convertImageToPdf(file);
                  processingFile = result.file;
                  wasConverted = true;
              } else if (fileType === 'docx') {
                  originalBlob = file;
                  const result = await convertWordToPdf(file);
                  processingFile = result.file;
                  wasConverted = true;
              }
              // Frissítjük a fájlt a state-ben konverzió után
              if (wasConverted) {
                 setFiles(prev => prev.map(f => f.id === id ? { 
                     ...f, 
                     file: processingFile, 
                     wasConverted: true, 
                     fileType: 'pdf',
                     originalFileBlob: originalBlob,
                     auditLog: [...f.auditLog, createAuditLog("Konverzió", "Automatikus PDF konverzió")]
                 } : f));
              }
          }

          // 2. Metadata kinyerés
          const base64 = await fileToBase64(processingFile);
          const meta = await extractMetadata(base64, getGeminiMimeType(processingFile));
          const sName = formatSuggestedName(meta, namingFormat, currentDepartment);
          
          // 3. Compliance és Audit frissítés
          const complianceStatus = evaluateCompliance(meta);

          setFiles(prev => prev.map(f => {
            if (f.id !== id) return f;
            
            const newLog = [...f.auditLog, createAuditLog("AI Elemzés", `Sikeres adatkinyerés. Pontosság: ${meta.confidenceScore}%`)];
            
            if (complianceStatus.level !== ComplianceLevel.COMPLIANT) {
               newLog.push(createAuditLog("Compliance Figyelmeztetés", `Státusz: ${complianceStatus.level}`));
            }

            return { 
              ...f, 
              status: ProcessingStatus.SUCCESS, 
              metadata: meta, 
              suggestedName: sName, 
              warnings: validateMetadata(meta),
              file: processingFile,
              wasConverted: wasConverted || f.wasConverted,
              originalFileBlob: originalBlob || f.originalFileBlob,
              auditLog: newLog,
              compliance: complianceStatus
            };
          }));

        } catch (e: any) {
          if (retries > 0) {
              await new Promise(r => setTimeout(r, 1000));
              return processFile(retries - 1);
          }
          setFiles(prev => prev.map(f => f.id === id ? { 
              ...f, 
              status: ProcessingStatus.ERROR, 
              errorMessage: e.message,
              auditLog: [...f.auditLog, createAuditLog("Hiba", `Elemzési hiba: ${e.message}`)]
          } : f));
        }
    };
    await processFile();
  };

  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    const processRecursive = async (file: File, archiveName?: string) => {
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.zip')) {
            const { extracted, skipped } = await extractFilesFromZip(file);
            skipped.forEach(s => setUnprocessedFiles(prev => [...prev, {name: s, source: file.name}]));
            for (const item of extracted) await processRecursive(item.file, file.name);
        } else if (lowerName.endsWith('.es3')) {
            const { extracted, skipped } = await extractFilesFromEs3(file);
            skipped.forEach(s => setUnprocessedFiles(prev => [...prev, {name: s, source: file.name}]));
            for (const item of extracted) await processRecursive(item.file, file.name);
        } else if (isSupportedFile(file.name)) {
            await addFileToSystem(file, file.name, archiveName);
        } else {
            setUnprocessedFiles(prev => [...prev, {name: file.name, source: archiveName || 'Közvetlen feltöltés'}]);
        }
    };
    for (const f of newFiles) await processRecursive(f);
  }, [namingFormat, currentDepartment, pdfSettings.autoConvertBehavior]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (confirm(`Biztosan törölni szeretnél ${selectedIds.size} kijelölt dokumentumot?`)) {
      setFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
      selectedIds.forEach(id => originalFilesMap.current.delete(id));
      setSelectedIds(new Set());
    }
  }, [selectedIds]);

  const handleRemoveSingle = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    originalFilesMap.current.delete(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleDownloadSelectedZip = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const jszip = new JSZip();
    const selectedFiles = files.filter(f => selectedIds.has(f.id) && f.status === ProcessingStatus.SUCCESS);
    
    for (const f of selectedFiles) {
      // Itt a getFileExtension segédfüggvényt használjuk a helyes kiterjesztéshez
      const ext = getFileExtension(f.file);
      jszip.file(`${f.suggestedName}.${ext}`, f.file);
    }
    
    const blob = await jszip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `ICT_Europa_Export_${new Date().getTime()}.zip`);
  }, [files, selectedIds]);

  const handleDownloadSelectedIndividual = useCallback(async () => {
      if (selectedIds.size === 0) return;
      const selectedFiles = files.filter(f => selectedIds.has(f.id) && f.status === ProcessingStatus.SUCCESS);
      
      let delay = 0;
      for (const f of selectedFiles) {
          setTimeout(() => {
              // Helyes kiterjesztés hozzáadása a letöltéskor
              const ext = getFileExtension(f.file);
              downloadBlob(f.file, `${f.suggestedName}.${ext}`);
          }, delay);
          delay += 500; // Kis késleltetés a böngésző védelmek miatt
      }
  }, [files, selectedIds]);

  const handleReviewStatusChange = useCallback((id: string, status: ReviewStatus) => {
    setFiles(prev => prev.map(f => {
        if (f.id === id) {
            const action = status === ReviewStatus.APPROVED ? "Jóváhagyás" : "Visszanyitás";
            return { 
                ...f, 
                reviewStatus: status,
                auditLog: [...f.auditLog, createAuditLog(action, `Státusz változás: ${status}`)]
            };
        }
        return f;
    }));
  }, []);

  const handleRenameChange = useCallback((id: string, newName: string) => {
    setFiles(prev => prev.map(f => {
        if (f.id === id) {
            return {
                ...f,
                suggestedName: newName,
                auditLog: [...f.auditLog, createAuditLog("Átnevezés", `Új név: ${newName}`)]
            };
        }
        return f;
    }));
  }, []);

  const handleEditSave = async (id: string, updates: {html?: string, rotation?: number}) => {
    const fileIndex = files.findIndex(f => f.id === id);
    if (fileIndex === -1) return;
    
    let updatedFile = files[fileIndex];
    let logDetail = "";

    if (updatedFile.fileType === 'image' && updates.rotation) {
        try {
            const rotatedFile = await rotateImage(updatedFile.file, updates.rotation);
            const newUrl = URL.createObjectURL(rotatedFile);
            updatedFile = { ...updatedFile, file: rotatedFile, sourceImageUrl: newUrl };
            logDetail += "Képforgatás ";
        } catch (e) {
            console.error("Rotation failed", e);
        }
    }
    
    if (updatedFile.fileType === 'docx' && updates.html) {
        updatedFile = { ...updatedFile, sourceHtml: updates.html };
        logDetail += "Tartalmi szerkesztés";
    }

    updatedFile = {
        ...updatedFile,
        auditLog: [...updatedFile.auditLog, createAuditLog("Szerkesztés", logDetail || "Kézi módosítás")]
    };

    setFiles(prev => prev.map(f => f.id === id ? updatedFile : f));
  };

  const scrollToFile = (fileId: string) => {
    const element = document.getElementById(`file-${fileId}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-50');
        setTimeout(() => element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-50'), 2000);
    }
  };

  const showDeptSelector = namingFormat.includes('{Department}');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-x-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
              <Scale className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">ICT EUROPA SMART AUTODOC</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-widest">Intelligens Dokumentumkezelő</span>
                <span className="text-[10px] font-bold text-slate-500">• v2.6 Enterprise + Chat</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
             {installPrompt && (
                <button 
                  onClick={handleInstallClick} 
                  className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg animate-in fade-in"
                >
                   <Download className="w-4 h-4" /> Telepítés
                </button>
             )}
             <div className="relative flex-grow md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Keresés ügyfélre, fájlra..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 text-slate-900" 
                />
             </div>
             <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-all"><Settings className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full p-6 space-y-8 pb-32">
        
        {/* Naming Section */}
        <section className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Type className="w-5 h-5 text-blue-600" />
                 <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Fájlnév formátum szerkesztése</h2>
              </div>
              <span className="text-[10px] font-bold text-slate-500 italic">Húzd a változókat a sorrend módosításához</span>
           </div>
           <TokenReorder format={namingFormat} onChange={setNamingFormat} />
           <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-500">Példa:</span>
              <p className="text-sm font-bold text-blue-800 font-mono italic">{formatSuggestedName({clientName: "Kovács Kft", documentType: "Végzés", date: "2024.07.09", projectName: "Peres ügy", amount: "1.2M", opposingParty: "Minta Ellenoldal", department: "Jogi", referenceNumber: "2024/07"}, namingFormat, currentDepartment)}.pdf</p>
           </div>
        </section>

        {/* Mappastruktúra Navigáció L-elágazásokkal */}
        {archives.length > 0 && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-left-4">
                <div className="flex items-center gap-2 px-2">
                    <Folder className="w-4 h-4 text-blue-600" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">DOKUMENTUM STRUKTÚRA ÉS ARCHÍVUMOK</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm">
                    {archives.map(archive => (
                        <div key={archive} className="space-y-1">
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase border ${archive === 'direct' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {archive === 'direct' ? <Zap className="w-3.5 h-3.5 text-indigo-600" /> : <FileArchive className="w-3.5 h-3.5 text-blue-600" />}
                                <span className="truncate">{archive === 'direct' ? 'EGYEDI FELTÖLTÉSEK' : archive}</span>
                            </div>
                            <div className="pl-4 space-y-1 border-l-2 border-slate-100 mt-1">
                                {archiveGroups[archive].map((file) => (
                                    <button 
                                        key={file.id} 
                                        onClick={() => scrollToFile(file.id)}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-blue-50 rounded-lg text-left transition-colors group"
                                    >
                                        <CornerDownRight className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                                            <span className="text-[9px] font-bold text-slate-600 truncate group-hover:text-blue-700">{file.suggestedName || file.originalName}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Stats & Actions Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           <div className="lg:col-span-3 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0 w-full">
                    {showDeptSelector && DEPARTMENTS.map(dept => (
                      <button 
                        key={dept.id} 
                        onClick={() => setCurrentDepartment(dept.id)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm ${currentDepartment === dept.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-100'}`}
                      >
                        {dept.label}
                      </button>
                    ))}
                 </div>
                 
                 <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setIsScanOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg"><Camera className="w-4 h-4" /> Szkennelés</button>
                    <button onClick={() => exportMetadataToCsv(files)} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm"><FileSpreadsheet className="w-5 h-5" /></button>
                 </div>
              </div>

              {files.length === 0 ? (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                  <Dropzone onFilesAdded={handleFilesAdded} />
                </div>
              ) : (
                <div className="space-y-8">
                   <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-4">
                         <button onClick={handleToggleAll} className="flex items-center gap-2 text-[10px] font-black text-slate-700 hover:text-slate-900 uppercase tracking-widest">
                            {selectedIds.size > 0 && selectedIds.size === filteredFiles.length ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                            Összes kijelölése ({selectedIds.size})
                         </button>
                         {selectedIds.size > 0 && (
                            <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                               <button onClick={handleDownloadSelectedZip} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100 transition-all"><Download className="w-3.5 h-3.5" /> Mentés ZIP-be</button>
                               <button onClick={handleDownloadSelectedIndividual} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-100 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-all"><FileDown className="w-3.5 h-3.5" /> Egyesével letöltés</button>
                               <button onClick={handleDeleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-100 rounded-lg text-[10px] font-black uppercase hover:bg-rose-100 transition-all"><Trash2 className="w-3.5 h-3.5" /> Törlés</button>
                            </div>
                         )}
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <button onClick={() => setShowAiSummary(!showAiSummary)} className={`p-1.5 rounded-lg transition-all ${showAiSummary ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`} title="AI Összefoglaló"><Sparkles className="w-4 h-4" /></button>
                         </div>
                         <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <button onClick={() => setViewMode('cards')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
                            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}><Filter className="w-4 h-4" /></button>
                         </div>
                      </div>
                   </div>

                   <div className={viewMode === 'cards' ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "flex flex-col gap-3"}>
                      {filteredFiles.map((file) => (
                        <div key={file.id} id={`file-${file.id}`} className="scroll-mt-32">
                            <FileItem 
                              item={file} 
                              isSelected={selectedIds.has(file.id)}
                              showSummary={showAiSummary}
                              onToggleSelect={handleToggleSelect}
                              onRemove={handleRemoveSingle}
                              onRenameChange={handleRenameChange}
                              onReviewStatusChange={handleReviewStatusChange}
                              onDownload={(id) => downloadBlob(file.file, file.suggestedName)}
                              onEmail={() => {}}
                              onPreview={(f) => setPreviewFile(f)}
                              onEdit={(f) => setEditingFile(f)}
                              onChat={(f) => setChatFile(f)}
                            />
                        </div>
                      ))}
                   </div>

                   <div className="mt-8">
                      <Dropzone onFilesAdded={handleFilesAdded} />
                   </div>
                </div>
              )}
           </div>

           {/* Sidebar Info */}
           <div className="space-y-6">
              <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                 <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                 <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-6 flex items-center gap-2">
                    <Zap className="w-4 h-4 fill-current" /> Rendszerstatisztika
                 </h4>
                 <div className="space-y-6 relative z-10">
                    <div>
                       <p className="text-4xl font-black">{docStats.total}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Összes dokumentum</p>
                    </div>
                    <div>
                       <p className="text-2xl font-black text-blue-400">{docStats.new}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Várakozik jóváhagyásra</p>
                    </div>
                    <div className="pt-6 border-t border-white/10">
                       <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">"Az AI csak egy segédeszköz. A végleges dokumentum ellenőrzése az Ön felelőssége."</p>
                    </div>
                 </div>
              </div>

              {unprocessedFiles.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] animate-in slide-in-from-right-4">
                   <div className="flex items-center gap-2 text-rose-800 mb-4">
                      <AlertCircle className="w-5 h-5" />
                      <h5 className="text-[10px] font-black uppercase tracking-widest">Kihagyott fájlok ({unprocessedFiles.length})</h5>
                   </div>
                   <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar pr-2">
                      {unprocessedFiles.map((f, i) => (
                        <div key={i} className="flex flex-col bg-white p-2 rounded-lg border border-rose-100 text-[10px] font-bold">
                           <span className="text-rose-900 truncate" title={f.name}>{f.name}</span>
                           <span className="text-slate-500 text-[8px] uppercase">{f.source}</span>
                        </div>
                      ))}
                   </div>
                   <button onClick={() => setUnprocessedFiles([])} className="mt-4 w-full text-[9px] font-black text-rose-600 hover:text-rose-800 uppercase tracking-widest transition-colors">Lista törlése</button>
                </div>
              )}
           </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 flex justify-center items-center z-30">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">© 2025 ICT EUROPA LAW GROUP • INTERNAL SMART SYSTEMS</p>
      </footer>

      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        currentFormat={namingFormat} 
        currentPdfSettings={pdfSettings}
        onSave={(f, s) => { setNamingFormat(f); setPdfSettings(s); }} 
      />
      <ScanModal isOpen={isScanOpen} onClose={() => setIsScanOpen(false)} onCapture={(f) => handleFilesAdded([f])} />
      <FilePreviewModal isOpen={!!previewFile} onClose={() => setPreviewFile(null)} file={previewFile} />
      {editingFile && (
        <EditorModal 
           isOpen={!!editingFile} 
           onClose={() => setEditingFile(null)} 
           file={editingFile} 
           onSave={handleEditSave} 
        />
      )}
      {chatFile && (
        <DocumentChatModal 
           isOpen={!!chatFile} 
           onClose={() => setChatFile(null)} 
           file={chatFile}
        />
      )}
    </div>
  );
};

export default App;
