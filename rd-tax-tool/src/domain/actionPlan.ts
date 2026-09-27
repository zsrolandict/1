/**
 * ICT Európa 3-step implementation roadmap, tailored to the audit outcome.
 */
import type { AuditAnswers, AuditResult, SavingsResult } from './types';

export interface ActionStep {
  order: 1 | 2 | 3;
  title: string;
  duration: string;
  summary: string;
  tasks: string[];
  /** Highlighted when the step is on the critical path for this client. */
  priority: 'normal' | 'high';
}

export function buildActionPlan(
  audit: AuditResult,
  answers: AuditAnswers,
  savings: SavingsResult,
  selfRevisionYears: number,
): ActionStep[] {
  const sztnhByLevel = {
    GREEN: {
      duration: '2–4 hét',
      summary: 'A projekt dokumentáltsága alapján a minősítési kérelem azonnal előkészíthető.',
      tasks: [
        'Projektleírás és K+F-tartalom összefoglaló véglegesítése',
        'SZTNH minősítési kérelem benyújtása',
        'Hiánypótlási kérdésekre való válaszadás',
      ],
      priority: 'normal' as const,
    },
    YELLOW: {
      duration: '4–8 hét',
      summary: 'Beadás előtt a gyenge Frascati-kritériumok dokumentációs kiegészítése szükséges.',
      tasks: [
        'Hiányzó műszaki dokumentáció pótlása (lásd kockázati javaslatok)',
        'Szakértői interjúk a fejlesztőcsapattal, hipotézisek rögzítése',
        'SZTNH minősítési kérelem benyújtása a kiegészítés után',
      ],
      priority: 'high' as const,
    },
    RED: {
      duration: '8–12 hét',
      summary:
        'A jelenlegi formában magas a NAV-átminősítés kockázata. A projekt határainak újrarajzolása szükséges.',
      tasks: [
        'Projekt-újrahatárolás: K+F fázis elkülönítése a gyártás-előkészítéstől',
        'Nem K+F költségtételek kivezetése a költségalapból',
        'Újraértékelés, majd SZTNH minősítési kérelem benyújtása',
      ],
      priority: 'high' as const,
    },
  }[audit.level];

  const missingTimeTracking = answers.redFlags.NO_TIME_TRACKING || answers.ratings.SYSTEMATIC < 3;

  const revisionTasks = [
    'Tao-bevallás: kétszeres K+F-levonás érvényesítése',
    'HIPA-bevallás: K+F közvetlen költség levonása az adóalapból',
    'Havi szocho-bevallások (08-as) kutatói kedvezménnyel',
  ];
  if (savings.innovationContributionSaving > 0) {
    revisionTasks.push('Innovációs járulék bevallásának korrekciója');
  }
  if (selfRevisionYears > 0) {
    revisionTasks.push(
      `Önellenőrzés az elmúlt ${selfRevisionYears} nyitott adóévre (elévülési időn belül)`,
    );
  }

  return [
    {
      order: 1,
      title: 'SZTNH hatósági minősítés',
      ...sztnhByLevel,
    },
    {
      order: 2,
      title: 'Analitikus nyilvántartás kiépítése',
      duration: '3–6 hét',
      summary:
        'Projektszintű költség- és munkaidő-nyilvántartás, amely a NAV-ellenőrzésen tételesen alátámasztja a kedvezményeket.',
      tasks: [
        'K+F projektkódok és költséghelyek a főkönyvben',
        'Projektkódos munkaidő-nyilvántartás a kutatói állományra',
        'Kutatói munkakörök munkaszerződés-szintű rögzítése (szocho-kedvezmény feltétele)',
      ],
      priority: missingTimeTracking ? 'high' : 'normal',
    },
    {
      order: 3,
      title: 'Adóbevallás korrekció',
      duration: selfRevisionYears > 0 ? '4–6 hét' : '2–3 hét',
      summary: 'A kedvezmények érvényesítése a tárgyévi bevallásokban és szükség esetén önellenőrzéssel.',
      tasks: revisionTasks,
      priority: 'normal',
    },
  ];
}
