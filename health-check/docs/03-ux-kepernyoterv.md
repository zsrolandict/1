# 3. UX/UI és képernyőterv

Az alapelv: **egy képernyő, egy döntés**. A tanácsadónak nem adatot kell bevinnie, hanem az előre kitöltött javaslatokat kell megerősítenie vagy felülírnia. A csekklistából és az AI előszűrésből érkező red flagek előjelölve jelennek meg.

## 3.1 Belső tanácsadói dashboard (`/app`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ICT Health Check      [Keresés cég/projekt…]        ⏱ 01:12 FIN · HC-014  👤 │
├──────────┬──────────────────────────────────────────────────────────────────┤
│ Projektek│  Aktív projektek (8)                    [+ Új átvilágítás]       │
│ Pipeline │ ┌──────────────┬──────────┬──────────┬────────┬────────┬───────┐ │
│ Időkeret │ │ Cég          │ Fázis    │ Adatok   │ Óra    │ RAG    │ Határ │ │
│ Sablonok │ ├──────────────┼──────────┼──────────┼────────┼────────┼───────┤ │
│ Beáll.   │ │ Minta Kft.   │ ANALYSIS │ ████░ 82%│ 14/21 ▲│ ● Piros│ 3 nap │ │
│          │ │ Alfa Zrt.    │ DATA     │ ██░░░ 40%│  4/21  │ ○ —    │ 8 nap │ │
│          │ │ Béta Kft.    │ REVIEW   │ █████100%│ 20/21 ⚠│ ● Sárga│ 1 nap │ │
│          │ └──────────────┴──────────┴──────────┴────────┴────────┴───────┘ │
│          │                                                                  │
│          │ ┌── Teendőim ──────────────┐ ┌── Figyelmeztetések ─────────────┐ │
│          │ │ ☐ LEG munkalap – Minta   │ │ ⚠ Béta: FIN keret 95%-on        │ │
│          │ │ ☐ 3 AI-találat jóváhagyás│ │ ⚠ Alfa: 4 dok. 5 napja hiányzik │ │
│          │ │ ☐ Riport review – Béta   │ │ ● Minta: CoC záradék (AI, 0.92) │ │
│          │ └──────────────────────────┘ └─────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────────────────────┘
```

**Projekt-részlet** (`/app/engagements/[id]`): felül egy **lépéssor**: Onboarding → Adatbekérés → Elemzés → Review → Riport. Alatta fülek:

| Fül | Tartalom | Ki látja |
|---|---|---|
| Áttekintés | 30 pontos csekklista válaszai, hiánypótlási lista (státusz, emlékeztető gomb), óraszám-fogyás pillérenként | minden tanácsadó |
| Pénzügy / Adó | Normalizált EBITDA híd (vízesés), transzferár-szűrő (kapcsolt ügyletek > 50 M Ft) | FIN + manager/partner |
| Jog | CoC / IP / munkajog ellenőrzőlista, a top 5 szerződés AI-kivonatával egymás mellett | LEG |
| Operáció | Beszállítói koncentráció (Pareto + HHI), tech debt pontozókártya | OPS |
| HR | HR 361 kulcsember-mátrix (pszeudonim), interjújegyzetek | HR |
| **Red Flag mátrix** | Az MVP komponens (lásd 3.2) | tanácsadók: saját pillért írhatják |
| Riport | Előnézet, verziók, „Kiadás az ügyfélnek” (csak partner) | manager / partner |

**Globális időmérő** a fejlécben: egy kattintással indul, a projektet és a pillért az aktuális útvonalból veszi, és mellette mutatja a keret fogyását.

## 3.2 Interaktív Red Flag Report képernyő (`/app/engagements/[id]/risk`)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Minta Gyártó Kft. · Expressz audit      Lényegesség [50 000 000] [PDF] [↺] │
├───────────┬───────────┬───────────────┬───────────────┬────────────────────┤
│ ● PIROS   │ Health 50 │ Bruttó 301 M  │ Várható 136 M │ 7 tétel  4● 3● 0●  │
├───────────┴───────────┴───────────────┴───────────────┼────────────────────┤
│ ┌Pénzügy─┐ ┌Jog─────┐ ┌Operáció┐ ┌HR──────┐          │  5×5 hőtérkép      │
│ │ 44  ●  │ │ 39  ●  │ │ 71  ●  │ │ 46  ●  │ ← szűrő  │  V↑  · · · · ·     │
│ │ ███░░░ │ │ ██░░░░ │ │ ████░░ │ │ ███░░░ │          │      · · 1 2 ·     │
│ │ 33 M Ft│ │ 150 M  │ │ 40 M   │ │ 78 M   │          │      · · 2 2 2     │
│ └────────┘ └────────┘ └────────┘ └────────┘          │      H →  (katt.)  │
├───────────────────────────────────────────────────────┴────────────────────┤
│ [Mind|Pénzügy|Jog|Operáció|HR] [🔍]  ☐ csak azonosított    [+ Egyedi]      │
│ ☑ LEG-01 Change of Control…   V[3] H[5]  15·Piros  120 000 000  48 M  20  │
│ ☑ LEG-02 Hiányzó IP-átruházás V[4] H[4]  16·Piros   30 000 000  19 M   5⚡ │
│ ☐ LEG-03 Elavult létesítő…    V[2] H[2]   4·Zöld       500 000   —     3  │
├────────────────────────────────────────────────────────────────────────────┤
│ 90 napos akcióterv                                                         │
│ 0–30 Quick wins │ 31–60 Kritikus │ 61–90 Strukturális │ >90 Monitoring      │
├──────────────────────────────────────────┬─────────────────────────────────┤
│ Remediation pipeline divíziónként        │ Beszámítás: 7,45 M − 1,2 M      │
│ Legal ███ 2,2 M · Adó ██ 1,8 M · …       │ = 6,25 M Ft nettó               │
└──────────────────────────────────────────┴─────────────────────────────────┘
```

### Interakciós szabályok

- **Pipálás = azonosítás.** A nem pipált sor halványan, de pontszámmal együtt látszik, így a tanácsadó látja, mit „kapna”.
- **Közlekedési lámpa:** `V × H ≥ 15` → piros, `8–14` → sárga, `< 8` → zöld. **Lényegességi felülbírálás:** ha a várható veszteség (kitettség × valószínűség) ≥ a küszöb, a tétel pontszámtól függetlenül piros (tooltip jelzi).
- **Forintosítás:** bruttó kitettség (Ft) × valószínűség (5% / 20% / 40% / 65% / 90%) = **várható veszteség**. A dashboard mindkettőt mutatja, mert a vevő a bruttót, a CFO a várhatót kérdezi.
- **Quick win (⚡):** nem zöld tétel, legfeljebb 5 munkanap alatt javítható → a 0–30 napos oszlopba kerül.
- **Hőtérkép-cella kattintás** → a táblázat az adott cellára szűr.
- **Pillérkártya kattintás** → pillérszűrő.
- A kártyák és a táblázat minden változtatásra **azonnal** újraszámolódnak (kliensoldali motor), a mentés debounce-olt Server Actionnel történik.

## 3.3 Az 5 oldalas vezetői riport felépítése

1. **Címlap + vezetői összefoglaló.** Összesített RAG, Health Score, a 3 legnagyobb kockázat egy mondatban, bruttó és várható kitettség.
2. **Pillér-scorecard.** 4 kártya és a 5×5 mátrix.
3. **Red Flag részletező.** Csak a piros és a sárga tételek: leírás, bizonyíték (dokumentum-hivatkozás), forintérték.
4. **90 napos akcióterv.** Idővonal (0–30 / 31–60 / 61–90), felelős, határidő.
5. **Következő lépések és ajánlat.** Remediation-csomag divíziónként, és a 1,2 M Ft kredit beszámítása („Önnek nettó X Ft”).

## 3.4 Ügyfélportál (`/portal`)

- Mobilbarát, 3 lépéses varázsló: **Csekklista (30 kérdés, 4 blokk, ~20 perc)** → **Dokumentumok** (kategóriánként húzd-ide mező, zöld pipa, ha elfogadtuk) → **Státusz** (lépéssor + a hiányzó tételek listája).
- Hiánypótlás: a 2., 5. és 8. napon automatikus e-mail, a 8. naptól a projektmanager kap feladatot.
