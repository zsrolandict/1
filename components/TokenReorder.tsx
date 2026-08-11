
import React, { useState, useEffect, useRef } from 'react';
import { GripVertical, Trash2, Plus, X } from 'lucide-react';

interface TokenReorderProps {
  format: string;
  onChange: (newFormat: string) => void;
  className?: string;
}

const KNOWN_TOKENS = [
  { id: '{Department}', label: 'Üzletág', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: '{Client}', label: 'Ügyfél', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: '{OpposingParty}', label: 'Ellenérdekű fél', color: 'bg-red-100 text-red-700 border-red-200' },
  { id: '{Type}', label: 'Típus', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: '{DateHU}', label: 'Dátum (HU)', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: '{DateEN}', label: 'Dátum (EN)', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { id: '{Date}', label: 'Dátum', color: 'bg-green-50 text-green-600 border-green-100' },
  { id: '{Year}', label: 'Év', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: '{Month}', label: 'Hónap', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: '{Reference}', label: 'Ref', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: '{Project}', label: 'Projekt', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: '{Amount}', label: 'Összeg', color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

const TokenReorder: React.FC<TokenReorderProps> = ({ format, onChange, className = '' }) => {
  const [activeTokens, setActiveTokens] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragNodeRef = useRef<number | null>(null);

  // Formátum string parse-olása tokenekre
  useEffect(() => {
    const tokens: string[] = [];
    // Megkeressük az összes {Valami} formátumú részt a megadott sorrendben
    const matches = Array.from(format.matchAll(/\{[a-zA-Z]+\}/g));
    matches.forEach(match => {
      const tokenId = match[0];
      if (KNOWN_TOKENS.some(t => t.id === tokenId)) {
        tokens.push(tokenId);
      }
    });
    setActiveTokens(tokens);
  }, [format]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    dragNodeRef.current = index;
  };

  const handleDragEnter = (index: number) => {
    if (dragNodeRef.current === null || dragNodeRef.current === index) return;
    
    const newTokens = [...activeTokens];
    const draggedItem = newTokens[dragNodeRef.current];
    newTokens.splice(dragNodeRef.current, 1);
    newTokens.splice(index, 0, draggedItem);
    
    dragNodeRef.current = index;
    setDraggedIndex(index);
    setActiveTokens(newTokens);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    dragNodeRef.current = null;
    // Frissítjük a formátumot az új sorrenddel
    onChange(activeTokens.join(' - '));
  };

  const handleRemove = (tokenToRemove: string) => {
    const newTokens = activeTokens.filter(t => t !== tokenToRemove);
    onChange(newTokens.join(' - '));
  };

  const handleAddToken = (tokenId: string) => {
    if (activeTokens.includes(tokenId)) return;
    
    let newTokens = [...activeTokens];
    // Dátum konfliktusok kezelése
    const conflicts: Record<string, string[]> = {
      '{DateHU}': ['{DateEN}', '{Date}'],
      '{DateEN}': ['{DateHU}', '{Date}'],
      '{Date}': ['{DateHU}', '{DateEN}']
    };
    
    if (conflicts[tokenId]) {
      newTokens = newTokens.filter(t => !conflicts[tokenId].includes(t));
    }
    
    newTokens.push(tokenId);
    onChange(newTokens.join(' - '));
    setIsMenuOpen(false);
  };

  const getTokenInfo = (id: string) => KNOWN_TOKENS.find(t => t.id === id);
  const availableTokens = KNOWN_TOKENS.filter(t => !activeTokens.includes(t.id));

  return (
    <div className={`flex flex-wrap gap-3 items-center min-h-[56px] p-2 bg-slate-50 rounded-2xl border border-slate-100 ${className}`}>
      {activeTokens.map((tokenId, index) => {
        const info = getTokenInfo(tokenId);
        if (!info) return null;

        return (
          <div
            key={tokenId}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`
              flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-[11px] font-black cursor-grab active:cursor-grabbing select-none transition-all shadow-sm
              ${info.color} hover:shadow-md hover:scale-[1.03] group
              ${draggedIndex === index ? 'opacity-30 scale-95 border-blue-400 border-dashed bg-blue-50' : 'opacity-100'}
            `}
          >
            <GripVertical className="w-3.5 h-3.5 opacity-30 group-hover:opacity-60" />
            <span className="uppercase tracking-wider">{info.label}</span>
            <button 
              onMouseDown={(e) => { e.stopPropagation(); handleRemove(tokenId); }}
              className="ml-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 rounded-lg transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      <div className="relative" ref={menuRef}>
        <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-[11px] font-black uppercase tracking-widest"
        >
            <Plus className="w-4 h-4" />
            Változó hozzáadása
        </button>

        {isMenuOpen && (
            <div className="absolute top-full left-0 mt-3 w-64 bg-white rounded-[1.5rem] shadow-2xl border border-slate-100 z-[60] p-3 animate-in zoom-in-95 duration-200">
                <div className="max-h-72 overflow-y-auto custom-scrollbar pr-1">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">Válassz mezőt</div>
                    {availableTokens.map(token => (
                        <button
                            key={token.id}
                            onClick={() => handleAddToken(token.id)}
                            className="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-colors flex items-center gap-3"
                        >
                            <div className={`w-2.5 h-2.5 rounded-full ${token.color.split(' ')[0]}`} />
                            {token.label}
                        </button>
                    ))}
                    {availableTokens.length === 0 && (
                      <div className="p-4 text-center text-[10px] text-slate-400 font-bold uppercase">Minden változó használatban</div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default TokenReorder;
