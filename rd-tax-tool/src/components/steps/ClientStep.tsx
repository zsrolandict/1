import { Building2, Landmark } from 'lucide-react';
import { INDUSTRY_LABELS } from '../../domain/constants';
import { isValidTaxNumber } from '../../domain/format';
import type { ClientProfile } from '../../domain/types';
import { Card } from '../ui/Card';
import { CurrencyInput, Field, Segmented, SelectInput, TextInput } from '../ui/fields';

interface ClientStepProps {
  client: ClientProfile;
  onChange: (patch: Partial<ClientProfile>) => void;
}

/** Mandatory-field check shared with the stepper's "incomplete" marker. */
export function clientErrors(client: ClientProfile): Partial<Record<keyof ClientProfile, string>> {
  const errors: Partial<Record<keyof ClientProfile, string>> = {};
  if (!client.companyName.trim()) errors.companyName = 'A cégnév megadása kötelező.';
  if (!isValidTaxNumber(client.taxNumber)) errors.taxNumber = 'Formátum: 12345678-1-12';
  return errors;
}

export function ClientStep({ client, onChange }: ClientStepProps) {
  const errors = clientErrors(client);
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-6">
      <Card title="Ügyfél és projekt" subtitle="Az átvilágított cég és K+F projekt azonosítása" icon={Building2}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput
            label="Cégnév"
            value={client.companyName}
            onChange={(companyName) => onChange({ companyName })}
            placeholder="pl. Minta Gépgyártó Kft."
            error={client.companyName ? undefined : errors.companyName}
          />
          <TextInput
            label="Adószám"
            value={client.taxNumber}
            onChange={(taxNumber) => onChange({ taxNumber })}
            placeholder="12345678-1-12"
            error={client.taxNumber ? errors.taxNumber : undefined}
            hint="Nyolc számjegy – ÁFA-kód – megyekód"
          />
          <SelectInput
            label="Iparági besorolás"
            value={client.industry}
            options={INDUSTRY_LABELS}
            onChange={(industry) => onChange({ industry })}
          />
          <Field label="Vizsgált adóév">
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-600 focus:ring-2 focus:ring-navy-100 focus:outline-none"
              value={client.taxYear}
              onChange={(e) => onChange({ taxYear: Number(e.target.value) })}
            >
              {Array.from({ length: 6 }, (_, i) => currentYear - i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <TextInput
              label="K+F projekt megnevezése"
              value={client.projectName}
              onChange={(projectName) => onChange({ projectName })}
              placeholder="pl. Adaptív hegesztési paraméter-optimalizálás"
            />
          </div>
          <TextInput
            label="Felelős tanácsadó"
            value={client.advisorName}
            onChange={(advisorName) => onChange({ advisorName })}
            placeholder="Név – megjelenik a riporton"
          />
        </div>
      </Card>

      <Card title="Pénzügyi profil" subtitle="Az adókedvezmények érvényesíthetőségét meghatározó adatok" icon={Landmark}>
        <div className="grid gap-5 sm:grid-cols-2">
          <CurrencyInput
            label="Éves nettó árbevétel"
            value={client.annualRevenue}
            onChange={(annualRevenue) => onChange({ annualRevenue })}
            hint="A HIPA- és innovációsjárulék-alap felső korlátja"
          />
          <CurrencyInput
            label="Adózás előtti eredmény"
            value={client.profitBeforeTax}
            onChange={(profitBeforeTax) => onChange({ profitBeforeTax })}
            allowNegative
            hint="Negatív érték (veszteség) is megadható"
          />
          <div className="sm:col-span-2">
            <Segmented
              label="Létszám-kategória"
              value={client.companySize}
              onChange={(companySize) => onChange({ companySize })}
              options={[
                { value: 'SME', label: 'Kkv', description: 'Mikro-, kis- vagy középvállalkozás – nem innovációsjárulék-köteles' },
                { value: 'LIABLE', label: 'Innovációs járulék-köteles', description: 'Nem kkv – 0,3% innovációs járulék fizetésére kötelezett' },
              ]}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
