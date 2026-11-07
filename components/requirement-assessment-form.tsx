'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Status = 'atendido' | 'nao_atendido' | 'pendente';
export function RequirementAssessmentForm({projectId, requirementId, initialStatus, initialEvidence}:{
  projectId: string; requirementId: string; initialStatus: Status; initialEvidence: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [evidenceNote, setEvidenceNote] = useState(initialEvidence);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const response = await fetch('/api/projects/requirements', {
        method:'PUT', credentials:'same-origin',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({projectId, requirementId, status, evidenceNote}),
      });
      const result = await response.json() as {changed?: boolean; error?: string};
      if(!response.ok) throw new Error(result.error || 'Não foi possível registrar o diagnóstico.');
      setMessage(result.changed ? 'Diagnóstico e auditoria atualizados.' : 'Nenhuma alteração a registrar.');
      router.refresh();
    } catch(error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Falha ao registrar diagnóstico.');
    } finally { setBusy(false); }
  }
  return <form className="requirement-assessment" onSubmit={(event) => void submit(event)}>
    <label>Situação informada pela equipe
      <select value={status} onChange={(event)=>setStatus(event.target.value as Status)}>
        <option value="pendente">Pendente de comprovação</option>
        <option value="atendido">Atendido — evidência necessária</option>
        <option value="nao_atendido">Não atendido — justificativa necessária</option>
      </select>
    </label>
    <label>Comprovação ou justificativa
      <textarea rows={2} maxLength={1000} value={evidenceNote}
        onChange={(event)=>setEvidenceNote(event.target.value)}
        placeholder="Descreva a evidência consultada ou a lacuna a resolver." />
    </label>
    <button className="btn btn-outline" type="submit" disabled={busy ||
      (status !== 'pendente' && evidenceNote.trim().length < 10)}>
      {busy ? 'Gravando…' : 'Registrar diagnóstico'}
    </button>
    {message && <span role={failed ? 'alert' : 'status'} className={failed ? 'error' : 'success'}>{message}</span>}
  </form>;
}
