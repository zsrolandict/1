/**
 * Szakértői paraméterek – a forintosító képletek egységösszegei.
 *
 * Jogszabályi maximumokat (bírságplafonokat) SZÁNDÉKOSAN nem kódolunk be:
 * minden érték helykitöltő, amíg a felelős divízió jóvá nem hagyja
 * (`approved: true`, dátummal). A felület és a riport a nem jóváhagyott
 * paramétert jelöli, a szakértő pedig tételenként felülírhatja.
 */
export interface ExpertParameter {
  label: string;
  valueHuf: number;
  approved: boolean;
  owner: string;          // melyik divízió hagyja jóvá
  approvedAt?: string;    // ISO dátum
  note: string;
}

export const EXPERT_PARAMETERS = {
  TP_EXPOSURE_PER_RECORD: {
    label: 'Transzferár: becsült kitettség hiányzó nyilvántartásonként',
    valueHuf: 2_000_000,
    approved: false,
    owner: 'ICT Adó',
    note: 'Helykitöltő. Az adószakértők állítják be a bírsággyakorlat és a kockázati étvágy alapján.',
  },
} satisfies Record<string, ExpertParameter>;

export type ExpertParameterKey = keyof typeof EXPERT_PARAMETERS;
