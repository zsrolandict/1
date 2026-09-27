import RedFlagMatrix from '@/components/risk/RedFlagMatrix';

// MVP: demo adatokkal. Élesben: /projects/[id]/risk, a tételek a Supabase
// `red_flags` táblából jönnek (RLS alatt), a módosítás server actionnel mentődik.
export default function Page() {
  return (
    <main>
      <RedFlagMatrix companyName="Minta Gyártó Kft. · Expressz audit" />
    </main>
  );
}
