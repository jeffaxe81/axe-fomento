import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Axes Fomento | Inteligência em Captação', description: 'Plataforma de captação de recursos públicos para municípios.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
