import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AppNav from '@/components/AppNav';
import GuideHost from '@/components/guide/GuideHost';
import ProjectScope from '@/components/project/ProjectScope';
import SupabaseIdentity from '@/components/SupabaseIdentity';
import { NextNavProvider } from '@/components/NextNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'ICT Health Check',
  description: 'Vállalati Health Check & Vendor Due Diligence – belső tanácsadói eszköz',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hu">
      <body className="min-h-screen antialiased">
        <NextNavProvider>
          <AppNav />
          <SupabaseIdentity>
            <ProjectScope>{children}</ProjectScope>
          </SupabaseIdentity>
          <GuideHost />
        </NextNavProvider>
      </body>
    </html>
  );
}
