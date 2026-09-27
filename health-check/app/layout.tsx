import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ICT Health Check',
  description: 'Vállalati Health Check & Vendor Due Diligence – belső tanácsadói eszköz',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hu">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
