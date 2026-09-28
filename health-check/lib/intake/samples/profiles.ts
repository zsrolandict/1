import type { CaseProfile } from '../requests';

/** KITALÁLT előzetes tényállások a mintaesetekhez (valós céget nem ábrázolnak). */
export const SAMPLE_PROFILES: Record<string, CaseProfile> = {
  gyarto: {
    sectors: ['MANUFACTURING'],
    headcount: 140,
    flags: ['RELATED_PARTIES', 'KEY_CLIENTS', 'OWN_IP', 'BANK_FINANCING'],
    narrative:
      'Fémfeldolgozó és gépgyártó cég, 140 munkavállalóval, egy telephelyen. Az egyedüli tulajdonos két éven belül eladná a céget, ' +
      'ezért eladói átvilágítást kér. Az árbevétel harmada egy autóipari beszállítóhoz kötődik. A csarnokot a tulajdonos ' +
      'ingatlancégétől bérlik, a holding menedzsmentdíjat számláz. A gyártásirányítási szoftvert egy külső fejlesztő írta. ' +
      'Beruházási hitelük van egy kereskedelmi banknál.',
  },
  epitoipar: {
    sectors: ['CONSTRUCTION'],
    headcount: 85,
    flags: ['PUBLIC_PROCUREMENT', 'CONTRACTORS', 'BANK_FINANCING', 'LITIGATION'],
    narrative:
      'Magas- és mélyépítő cég 85 fővel, a munkák jelentős része önkormányzati közbeszerzés. A bankgarancia-keret bővítése előtt ' +
      'állnak. A kivitelezést részben alvállalkozói brigádok végzik, akik gyakorlatilag csak nekik dolgoznak. Egy késésben lévő ' +
      'sportcsarnok-projekt miatt a megrendelő kötbért helyezett kilátásba.',
  },
  konyvelo: {
    sectors: ['ACCOUNTING'],
    headcount: 30,
    flags: ['FAMILY', 'MULTIPLE_OWNERS', 'KEY_CLIENTS', 'PERSONAL_DATA'],
    narrative:
      'Könyvelő és adótanácsadó iroda 30 munkavállalóval, generációváltás előtt. Az alapító három éven belül visszavonulna; ' +
      'a lánya és a szakmai helyettese venné át, de az üzletrészek felosztásáról még nincs döntés. A régi, nagy ügyfelek személyesen ' +
      'az alapítóhoz kötődnek. Több száz ügyfél bér- és személyes adatát kezelik. Az iroda egy családi tulajdonú ingatlanban működik.',
  },
  'it-fejleszto': {
    sectors: ['IT'],
    headcount: 45,
    flags: ['OWN_IP', 'CONTRACTORS', 'KEY_CLIENTS', 'MULTIPLE_OWNERS'],
    narrative:
      'Egyedi szoftverfejlesztő cég 45 fővel, ebből 12 fejlesztő számlás konstrukcióban dolgozik. A három tulajdonos 18 hónapon ' +
      'belül befektetőt vonna be. A bevétel több mint fele egy bankügyféltől származik. A saját fejlesztésű platformot több ügyfélnek ' +
      'is licencelik. A tulajdonosi holding licencdíjat és menedzsmentdíjat számláz a cégnek.',
  },
};
