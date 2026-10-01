import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AccountLink from '@/components/AccountLink';
import AppShell from '@/components/shell/AppShell';
import GuideHost from '@/components/guide/GuideHost';
import ProjectBar from '@/components/project/ProjectBar';
import ProjectScope from '@/components/project/ProjectScope';
import SupabaseIdentity from '@/components/SupabaseIdentity';
import { NextNavProvider } from '@/components/NextNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'ICT Health Check',
  description: 'Vállalati Health Check & Vendor Due Diligence – belső tanácsadói eszköz',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hu">
      <body className="min-h-screen antialiased">
        <NextNavProvider>
          <SupabaseIdentity>
            <AppShell project={<ProjectBar />} account={<AccountLink />}>
              <ProjectScope>{children}</ProjectScope>
              <div className="h-10 print:hidden" aria-hidden />
            </AppShell>
          </SupabaseIdentity>
          <GuideHost />
        </NextNavProvider>
      </body>
    </html>
  );
}
