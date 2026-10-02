/**
 * Domináns szabály (audit K6): ha egy tételre több forrás vagy szabály ad
 * (valószínűség, hatás) párt, nem vesszük külön-külön a maximumokat – az
 * olyan kombinációt adhatna (pl. 5×2 és 2×5 → 5×5), amit egyik forrás sem
 * állított. Az a pár érvényes egészében, amelyiknek a szorzata (L × I) a
 * legnagyobb; holtversenynél a nagyobb hatású; ha az is egyezik, a pár
 * azonos, és az elsőként megadott marad (determinisztikus).
 */
export interface ScorePair {
  likelihood: number;
  impact: number;
}

export function dominates(a: ScorePair, b: ScorePair): boolean {
  const pa = a.likelihood * a.impact;
  const pb = b.likelihood * b.impact;
  return pa > pb || (pa === pb && a.impact > b.impact);
}

/** A domináns elem; üres listára undefined. Holtversenyben az előbbi marad. */
export function dominant<T extends ScorePair>(candidates: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const c of candidates) if (!best || dominates(c, best)) best = c;
  return best;
}

/**
 * Javaslat beolvasztása egy tételbe: azonosított tételnél a meglévő és a
 * javasolt pár közül a domináns; nem azonosítottnál csak a javaslat – a
 * katalógus kiinduló értéke nem megállapítás.
 */
export function mergeFinding(existing: ScorePair & { identified: boolean }, suggested: ScorePair): ScorePair {
  if (!existing.identified) return { likelihood: suggested.likelihood, impact: suggested.impact };
  const best = dominant([existing, suggested])!;
  return { likelihood: best.likelihood, impact: best.impact };
}

const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(Number.isFinite(n) ? n : 5)));

/** 1–5 skálára igazított pár (hiányzó / érvénytelen érték: 5, mint a motorban). */
export function clampPair(p: ScorePair): { likelihood: 1 | 2 | 3 | 4 | 5; impact: 1 | 2 | 3 | 4 | 5 } {
  return { likelihood: clamp(p.likelihood) as 1 | 2 | 3 | 4 | 5, impact: clamp(p.impact) as 1 | 2 | 3 | 4 | 5 };
}
