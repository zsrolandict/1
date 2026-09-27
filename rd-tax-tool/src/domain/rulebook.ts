/**
 * Rulebook: every rule the engine applies, with its value taken straight
 * from the constants (so the list cannot drift from the calculation), the
 * legal reference, and its verification status. The tax team signs off on
 * this list; its version is printed on every report.
 */
import { ENGINE_VERSION, FRASCATI_CRITERIA, IP_RULES, KNOCKOUT_CAP, RED_FLAGS, RISK_THRESHOLDS, TAX_RATES } from './constants';

export type RuleStatus = 'CONFIRMED' | 'SOURCE' | 'VERIFY' | 'METHOD';

export const RULE_STATUS_LABELS: Record<RuleStatus, string> = {
  CONFIRMED: 'Adócsapat megerősítette',
  SOURCE: 'Nyilvános forrás alapján',
  VERIFY: 'Ellenőrizendő',
  METHOD: 'ICT módszertan',
};

export interface Rule {
  id: string;
  topic: string;
  rule: string;
  value: string;
  reference: string;
  status: RuleStatus;
  note?: string;
}

export interface RuleGroup {
  title: string;
  rules: Rule[];
}

const pct = (rate: number, digits = 1) => `${(rate * 100).toLocaleString('hu-HU', { maximumFractionDigits: digits })}%`;
const huf = (n: number) => `${n.toLocaleString('hu-HU')} Ft`;

export const RULEBOOK_VERSION = ENGINE_VERSION;
/** When the tax team last confirmed the CONFIRMED items. */
export const RULEBOOK_CONFIRMED_ON = '2026-09';

export const RULEBOOK: readonly RuleGroup[] = [
  {
    title: 'Szociális hozzájárulási adó',
    rules: [
      { id: 'szocho-rate', topic: 'Szocho', rule: 'Általános kulcs', value: pct(TAX_RATES.SZOCHO, 0), reference: 'Szocho tv.', status: 'SOURCE' },
      {
        id: 'szocho-phd',
        topic: 'Szocho',
        rule: 'PhD / tudományos fokozat: mentesség, havi bérplafonig fejenként',
        value: `${pct(TAX_RATES.SZOCHO_RELIEF_PHD, 0)} · ${huf(TAX_RATES.SZOCHO_PHD_MONTHLY_CAP)}/hó`,
        reference: 'Szocho tv. 15. §',
        status: 'CONFIRMED',
      },
      {
        id: 'szocho-doctoral',
        topic: 'Szocho',
        rule: 'Doktorandusz / doktorjelölt: mentesség, havi bérplafonig fejenként',
        value: `${pct(TAX_RATES.SZOCHO_RELIEF_DOCTORAL, 0)} · ${huf(TAX_RATES.SZOCHO_DOCTORAL_MONTHLY_CAP)}/hó`,
        reference: 'Szocho tv. 15. §',
        status: 'CONFIRMED',
      },
      {
        id: 'szocho-16',
        topic: 'Szocho',
        rule: 'Fokozat nélküli K+F-munkatárs: kedvezmény, ugyanaz a bér nem vonható le a Tao-ban',
        value: pct(TAX_RATES.SZOCHO_RELIEF_16, 0),
        reference: 'Szocho tv. 16. §',
        status: 'VERIFY',
        note: 'Havi / éves felső korlát és a jogosult munkakörök (FEOR) ellenőrizendők.',
      },
    ],
  },
  {
    title: 'Társasági adó',
    rules: [
      { id: 'cit-rate', topic: 'Tao', rule: 'Adókulcs', value: pct(TAX_RATES.CIT, 0), reference: 'Tao. tv. 19. §', status: 'SOURCE' },
      {
        id: 'cit-rd',
        topic: 'Tao',
        rule: 'K+F közvetlen költség még egyszer levonható',
        value: '+100% levonás',
        reference: 'Tao. tv. 7. § (1) t)',
        status: 'CONFIRMED',
      },
      {
        id: 'cit-timing',
        topic: 'Tao',
        rule: 'Aktivált fejlesztés: levonás a felmerüléskor vagy az értékcsökkenéssel – kettős levonás tilos',
        value: 'választható',
        reference: 'Tao. tv. 7. § (1) t)',
        status: 'CONFIRMED',
      },
      {
        id: 'cit-university',
        topic: 'Tao',
        rule: 'Felsőoktatási / kutatóintézeti együttműködés: a költség többszöröse, felső határig (de minimis)',
        value: `${TAX_RATES.UNIVERSITY_MULTIPLIER}× · max. ${huf(TAX_RATES.UNIVERSITY_CAP)}`,
        reference: 'Tao. tv. 7. §',
        status: 'SOURCE',
        note: 'A de minimis keret ügyfelenként ellenőrizendő.',
      },
      {
        id: 'cit-grant',
        topic: 'Tao',
        rule: 'Vissza nem térítendő támogatásból fedezett költség kizárva (Tao és HIPA)',
        value: 'kizárva',
        reference: '–',
        status: 'VERIFY',
        note: 'Konzervatív feltételezés; a pontos jogszabályhely ellenőrizendő.',
      },
      {
        id: 'cit-loss',
        topic: 'Tao',
        rule: 'Elhatárolt veszteség felhasználása a későbbi adóalapból',
        value: `max. ${pct(TAX_RATES.LOSS_OFFSET_LIMIT, 0)}`,
        reference: 'Tao. tv. 17. §',
        status: 'SOURCE',
      },
    ],
  },
  {
    title: 'Helyi iparűzési adó és innovációs járulék',
    rules: [
      { id: 'hipa-rate', topic: 'HIPA', rule: 'Legmagasabb helyi kulcs', value: pct(TAX_RATES.HIPA_MAX, 0), reference: 'Htv. 40. §', status: 'SOURCE' },
      {
        id: 'hipa-rd',
        topic: 'HIPA',
        rule: 'K+F közvetlen költség levonható – de egy költség csak egyszer (az anyagköltség az általános soron)',
        value: 'egyszeres levonás',
        reference: 'Htv. 39. § (1)',
        status: 'SOURCE',
        note: 'NAV-tájékoztató: gyakori ellenőrzési hiba a kettős levonás.',
      },
      {
        id: 'hipa-royalty',
        topic: 'HIPA',
        rule: 'Jogdíjbevétel levonható a nettó árbevételből, nexus nélkül',
        value: '100%',
        reference: 'Htv. 39. § (1)',
        status: 'CONFIRMED',
      },
      {
        id: 'inno-rate',
        topic: 'Innovációs járulék',
        rule: 'Járulék a HIPA-alap után; mikro- és kisvállalkozás mentes',
        value: pct(TAX_RATES.INNOVATION_CONTRIBUTION),
        reference: 'Inno. tv. 17. §',
        status: 'SOURCE',
      },
    ],
  },
  {
    title: 'Szoftver (IP-box)',
    rules: [
      {
        id: 'ip-royalty',
        topic: 'Jogdíj',
        rule: 'A jogdíjnyereség része levonható, az adózás előtti eredmény arányáig',
        value: `${pct(IP_RULES.ROYALTY_DEDUCTION_SHARE, 0)} · max. ${pct(IP_RULES.ROYALTY_PROFIT_CAP_SHARE, 0)} AEE`,
        reference: 'Tao. tv. 7. § (1) s)',
        status: 'CONFIRMED',
      },
      {
        id: 'ip-nexus',
        topic: 'Nexus',
        rule: 'Kumulatív nexus-arány szorzóval, legfeljebb 1 (csak Tao)',
        value: `× ${IP_RULES.NEXUS_UPLIFT.toLocaleString('hu-HU')}`,
        reference: 'Tao. tv. 7. § (22)–(25)',
        status: 'CONFIRMED',
      },
      {
        id: 'ip-notify',
        topic: 'Bejelentés',
        rule: 'Eredeti fejlesztés és minden aktivált továbbfejlesztés külön bejelentése – jogvesztő',
        value: `${IP_RULES.NOTIFICATION_DAYS} nap`,
        reference: 'Tao. tv. 4. § 5.',
        status: 'CONFIRMED',
        note: 'Egy korábbi nyilvános forrás 60 napot említett; a hatályos szöveget egyszer érdemes összevetni.',
      },
      {
        id: 'ip-holding',
        topic: 'Eladás',
        rule: 'Minimális tartási idő az eredeti szerzéstől (továbbfejlesztés nem indítja újra)',
        value: `${IP_RULES.MIN_HOLDING_YEARS} év`,
        reference: 'Tao. tv. 7. § (1)',
        status: 'CONFIRMED',
      },
      {
        id: 'ip-sale-nexus',
        topic: 'Eladás',
        rule: 'Nexus-arány alkalmazása az eladási nyereségre',
        value: 'kapcsolható (alap: igen)',
        reference: '–',
        status: 'VERIFY',
      },
      {
        id: 'ip-saas',
        topic: 'SaaS',
        rule: 'SaaS-előfizetés szolgáltatás; jogdíj csak elkülönített szerzői jogi licencdíjra',
        value: 'feltételes',
        reference: 'Szjt.; OECD BEPS 1. és 5.',
        status: 'CONFIRMED',
      },
    ],
  },
  {
    title: 'SZTNH / Frascati kockázati módszertan',
    rules: [
      ...FRASCATI_CRITERIA.map((c) => ({
        id: `frascati-${c.id}`,
        topic: 'Frascati',
        rule: `${c.label} – súly`,
        value: `${c.weight} pont`,
        reference: 'Frascati-kézikönyv',
        status: 'METHOD' as const,
      })),
      {
        id: 'risk-bands',
        topic: 'Sávok',
        rule: 'Zöld / sárga / piros határ',
        value: `≥ ${RISK_THRESHOLDS.GREEN} / ≥ ${RISK_THRESHOLDS.YELLOW} / < ${RISK_THRESHOLDS.YELLOW}`,
        reference: '–',
        status: 'METHOD',
      },
      {
        id: 'knockout',
        topic: 'Kizárás',
        rule: 'Bármely kritérium 0 vagy gyártás-előkészítés: pontszám korlátja',
        value: `max. ${KNOCKOUT_CAP} pont`,
        reference: 'Frascati-kézikönyv',
        status: 'METHOD',
      },
      {
        id: 'red-flags',
        topic: 'Kockázati jelzők',
        rule: 'Általános NAV-kockázati jelzők levonása',
        value: RED_FLAGS.map((f) => `−${f.penalty}`).join(' / '),
        reference: '–',
        status: 'METHOD',
      },
    ],
  },
];

export function rulebookSummary() {
  const all = RULEBOOK.flatMap((g) => g.rules);
  const count = (s: RuleStatus) => all.filter((r) => r.status === s).length;
  return { total: all.length, confirmed: count('CONFIRMED'), source: count('SOURCE'), verify: count('VERIFY'), method: count('METHOD') };
}
