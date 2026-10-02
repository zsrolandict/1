/**
 * Szakkifejezések egymondatos magyarázata a felülethez (ⓘ ikon). A szöveg
 * a motor tényleges szabályait írja le (lib/risk/engine.ts) – ha a szabály
 * változik, ezt is frissíteni kell.
 */
export const GLOSSARY = {
  redFlag: 'Red Flag mátrix: a feltárt kockázatok („piros zászlók”) listája és értékelése – valószínűség × hatás, forintban kifejezett kitettséggel.',
  status:
    'Összesített státusz: a legrosszabb pillér színe. Egy pillér piros, ha van benne piros tétel vagy a pontszáma 40 alatt van; sárga, ha van sárga tétel vagy 70 alatt van.',
  healthScore:
    'Health Score (0–100): a vizsgált pillérek súlyozott állapota. 100 = nincs azonosított kockázat; minél több és súlyosabb a tétel, annál kisebb. A nem vizsgált pillér kimarad (nem kap 100-at); a hiányt a lefedettség jelzi, 80% alatt a felmérés részleges, és nem kaphat Zöld minősítést.',
  grossExposure: 'Bruttó kitettség: ha minden azonosított kockázat bekövetkezne, ennyi lenne a becsült kár összesen.',
  expectedLoss: 'Várható veszteség: kitettség × a bekövetkezés valószínűsége. Ez a reálisabb, „súlyozott” kárösszeg.',
  score: 'Pontszám = valószínűség (1–5) × hatás (1–5). 15-től piros, 8-tól sárga, alatta zöld.',
  materiality: 'Lényegességi küszöb: ha egy tétel várható vesztesége eléri ezt az összeget, a tétel pontszámtól függetlenül piros.',
  grossMargin: 'Fedezeti hányad: az árbevételből ennyi marad a közvetlen költségek után. Az elmaradó árbevételből ez a valódi veszteség.',
  dso: 'DSO (vevőállomány forgási ideje): hány nap alatt fizetnek a vevők átlagosan. A tényleges és az iparági érték különbsége lekötött pénzt jelent.',
  revenue: 'Éves árbevétel: a forintosító képletek alapja (pl. egy vevő elvesztése az árbevétel ennyi százaléka).',
  weight: 'Súly: a pillér súlya a Health Score-ban és az órakeretben; az átvilágítás típusa (célja) határozza meg.',
  kindAdjustment:
    'Típusfüggő korrekció: ugyanaz a hiba más súlyú az átvilágítás céljától függően (pl. eladásnál a Change of Control záradék súlyosabb). A program a valószínűséget vagy a hatást ennyivel módosítja.',
  focus: 'Kiemelt tételek: ezeket az adott típusú átvilágításnál mindig érdemes megvizsgálni és megkérdezni.',
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
