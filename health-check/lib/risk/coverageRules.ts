/**
 * A lefedettség két küszöbe (audit K2) – KEZDŐ FELTEVÉSEK, a Feltevések
 * listán jóváhagyásra várnak. Külön fájlban, hogy a motor körkörös import
 * nélkül használhassa (a lefedettség számítása a kérdőívet is betölti).
 */
/** Pillér ez alatt „Nem vizsgált” (ha nincs azonosított tétele): kiesik a pontszám nevezőjéből. */
export const COVERAGE_PILLAR_MIN = 0.5;
/** Összesített lefedettség ez alatt: „Részleges / nem minősített felmérés”, nem lehet Zöld. */
export const COVERAGE_GATE = 0.8;
