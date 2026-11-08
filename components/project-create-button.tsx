'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
export function ProjectCreateButton({ opportunityId, opportunityTitle }: { opportunityId: string; opportunityTitle: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function create() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opportunityId, title: `Projeto: ${opportunityTitle}` }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Falha ao criar projeto');
      router.push('/projetos'); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro desconhecido'); setBusy(false); }
  }
  return <div><button className="btn btn-primary" disabled={busy} onClick={create}>{busy ? 'Criando…' : '+ Iniciar projeto'}</button>{error && <small role="alert" className="error">{error}</small>}</div>;
}
