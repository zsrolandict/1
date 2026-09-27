import { Download, FlaskConical, RotateCcw, Upload } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '../ui/Button';

import type { AppMode } from '../../App';

interface AppHeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onExport: () => void;
  onImport: (data: unknown) => void;
  onReset: () => void;
  onDemo: () => void;
}

export function AppHeader({ onExport, onImport, onReset, onDemo, mode, onModeChange }: AppHeaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      onImport(JSON.parse(await file.text()));
    } catch {
      window.alert('A fájl nem érvényes K+F diagnosztikai mentés (JSON).');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <header className="no-print bg-navy-900 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 font-serif text-lg font-bold tracking-tight">
            ICT
          </div>
          <div>
            <p className="font-serif text-lg leading-tight font-semibold tracking-wide">ICT Európa</p>
            <p className="text-xs text-navy-100/80">K+F Adódiagnosztika · Belső szakértői eszköz</p>
          </div>
        </div>
        <div role="radiogroup" aria-label="Nézet" className="flex rounded-lg border border-white/15 bg-white/5 p-0.5 text-sm">
          {(
            [
              ['full', 'Teljes átvilágítás'],
              ['royalty', 'Szoftverjogdíj-kalkulátor'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => onModeChange(value)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                mode === value ? 'bg-white text-navy-900' : 'text-navy-100 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <HeaderAction icon={FlaskConical} label="Demó eset" onClick={onDemo} />
          <HeaderAction icon={Upload} label="Megnyitás" onClick={() => fileRef.current?.click()} />
          <HeaderAction icon={Download} label="Mentés (JSON)" onClick={onExport} />
          <HeaderAction
            icon={RotateCcw}
            label="Új vizsgálat"
            onClick={() => {
              if (window.confirm('Biztosan új vizsgálatot kezd? A jelenlegi adatok törlődnek.')) onReset();
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
      </div>
    </header>
  );
}

function HeaderAction({ icon, label, onClick }: { icon: typeof Download; label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      icon={icon}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-navy-100 hover:bg-white/10 hover:text-white"
    >
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}
