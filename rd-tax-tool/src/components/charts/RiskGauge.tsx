/**
 * Semicircular 0–100 gauge for the SZTNH readiness score. The three bands
 * (RED < 50 ≤ YELLOW < 80 ≤ GREEN) are drawn as status arcs; the status is
 * also given as text so colour is never the only signal.
 */
import { RISK_LABELS, RISK_THRESHOLDS } from '../../domain/constants';
import type { RiskLevel } from '../../domain/types';

const LEVEL_COLOR: Record<RiskLevel, string> = {
  GREEN: 'var(--color-risk-green)',
  YELLOW: 'var(--color-risk-yellow)',
  RED: 'var(--color-risk-red)',
};

const CX = 100;
const CY = 100;
const R = 80;
const STROKE = 14;

/** Point on the arc for a score 0–100 (0 = left, 100 = right). */
function polar(score: number, radius = R) {
  const angle = Math.PI * (1 - score / 100);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arc(from: number, to: number) {
  const a = polar(from);
  const b = polar(to);
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
}

interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
  size?: 'sm' | 'lg';
}

export function RiskGauge({ score, level, size = 'lg' }: RiskGaugeProps) {
  const marker = polar(Math.max(0, Math.min(100, score)));
  const bands: { from: number; to: number; level: RiskLevel }[] = [
    { from: 0, to: RISK_THRESHOLDS.YELLOW - 0.8, level: 'RED' },
    { from: RISK_THRESHOLDS.YELLOW + 0.8, to: RISK_THRESHOLDS.GREEN - 0.8, level: 'YELLOW' },
    { from: RISK_THRESHOLDS.GREEN + 0.8, to: 100, level: 'GREEN' },
  ];

  return (
    <figure className="flex flex-col items-center" aria-label={`SZTNH készültség: ${score} pont, ${RISK_LABELS[level].title}`}>
      <svg viewBox="0 0 200 112" className={size === 'lg' ? 'w-full max-w-[260px]' : 'w-full max-w-[180px]'}>
        {/* Band arcs: the active band is full strength, the others recede. */}
        {bands.map((band) => (
          <path
            key={band.level}
            d={arc(band.from, band.to)}
            fill="none"
            stroke={LEVEL_COLOR[band.level]}
            strokeOpacity={band.level === level ? 1 : 0.22}
            strokeWidth={STROKE}
          >
            <title>{`${RISK_LABELS[band.level].title}: ${band.level === 'RED' ? '0–49' : band.level === 'YELLOW' ? '50–79' : '80–100'} pont`}</title>
          </path>
        ))}
        {/* Threshold ticks */}
        {[RISK_THRESHOLDS.YELLOW, RISK_THRESHOLDS.GREEN].map((t) => {
          const p = polar(t, R + 12);
          return (
            <text key={t} x={p.x} y={p.y} textAnchor="middle" className="fill-slate-400 text-[8px] tabular">
              {t}
            </text>
          );
        })}
        {/* Score marker on the arc (a needle would cross the number). */}
        <circle cx={marker.x} cy={marker.y} r={9} fill="var(--color-navy-900)" stroke="#fff" strokeWidth={3} />
        <text x={CX} y={CY - 14} textAnchor="middle" className="fill-navy-900 font-serif text-[28px] font-bold tabular">
          {score}
        </text>
        <text x={CX} y={CY + 2} textAnchor="middle" className="fill-slate-500 text-[8px]">
          / 100 pont
        </text>
      </svg>
      <figcaption className="mt-1 text-center">
        <RiskPill level={level} />
      </figcaption>
    </figure>
  );
}

const PILL_CLASS: Record<RiskLevel, string> = {
  GREEN: 'bg-risk-green-soft text-risk-green',
  YELLOW: 'bg-risk-yellow-soft text-risk-yellow',
  RED: 'bg-risk-red-soft text-risk-red',
};

export function RiskPill({ level, withSubtitle = true }: { level: RiskLevel; withSubtitle?: boolean }) {
  return (
    <span className={`inline-flex flex-col items-center rounded-lg px-3 py-1 ${PILL_CLASS[level]}`}>
      <span className="text-sm font-semibold">
        <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-current align-middle" />
        {RISK_LABELS[level].title}
      </span>
      {withSubtitle && <span className="text-[11px] opacity-90">{RISK_LABELS[level].subtitle}</span>}
    </span>
  );
}
