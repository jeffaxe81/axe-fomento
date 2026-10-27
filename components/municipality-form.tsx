'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Municipality } from '@/lib/db';
export function MunicipalityForm({ city, canEdit }: { city: Municipality; canEdit: boolean }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage(''); setError('');
    const f = new FormData(e.currentTarget);
    const population = String(f.get('population') || '').trim();
    const payload = { ibgeCode: String(f.get('ibgeCode') || '').trim() || null, population: population ? Number(population) : null, priorityAreas: String(f.get('priorityAreas') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean) };
    try {
      const r = await fetch('/api/municipality', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json()).error || 'Falha ao salvar');
      setMessage('Dados municipais atualizados com sucesso.'); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar'); } finally { setBusy(false); }
  }
  return <form className="profile-form" onSubmit={submit}><div className="field"><label>Município<input value={city.name} disabled readOnly/></label><label>Unidade federativa<input value={city.uf} disabled readOnly/></label></div><div className="field"><label>Código IBGE<input name="ibgeCode" defaultValue={city.ibge_code ?? ''} maxLength={7} pattern="[0-9]{7}" disabled={!canEdit} placeholder="7 dígitos" /></label><label>População<input name="population" type="number" min="0" step="1" defaultValue={city.population ?? ''} disabled={!canEdit} placeholder="Habitantes" /></label></div><div className="field full"><label>Áreas prioritárias (separadas por vírgula)<input name="priorityAreas" defaultValue={city.priority_areas.join(', ')} disabled={!canEdit} placeholder="saúde, educação, infraestrutura"/></label></div><p className="help">Informe as áreas prioritárias de planejamento municipal. O resultado é apenas uma triagem; o enquadramento real depende das regras de cada edital.</p>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}{canEdit ? <div><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar perfil municipal'}</button></div> : <p className="help">A edição é restrita aos administradores municipais.</p>}</form>;
}
