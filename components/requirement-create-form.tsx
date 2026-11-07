'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RequirementCreateForm({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [requirement, setRequirement] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceVersion, setSourceVersion] = useState('');
  const [sourceSection, setSourceSection] = useState('');
  const [evidenceExcerpt, setEvidenceExcerpt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const response = await fetch('/api/requirements', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          opportunityId, requirement, mandatory, sourceUrl, sourceVersion,
          sourceSection, evidenceExcerpt,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível cadastrar a regra.');
      setMessage('Requisito cadastrado, sujeito à conferência documental.');
      setRequirement(''); setSourceVersion(''); setSourceSection(''); setEvidenceExcerpt('');
      router.refresh();
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : 'Falha no cadastro.');
    } finally { setBusy(false); }
  }

  return <section className="panel requirement-create">
    <h2>Incluir requisito documental</h2>
    <p className="help">Informe a versão ou retificação, o item e o trecho exato da documentação.
      O cadastro é manual e não certifica a validade do edital.</p>
    <form onSubmit={(event) => void submit(event)}>
      <label>Requisito
        <textarea required rows={2} minLength={10} maxLength={500} value={requirement}
          onChange={(event) => setRequirement(event.target.value)}
          placeholder="Descreva o requisito conforme consta no documento." />
      </label>
      <label>Endereço HTTPS da fonte indicada
        <input required type="url" maxLength={600} value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://..." />
      </label>
      <div className="requirement-form-grid">
        <label>Versão ou retificação
          <input required maxLength={100} value={sourceVersion}
            onChange={(event) => setSourceVersion(event.target.value)} placeholder="Ex.: retificação 01/2026" />
        </label>
        <label>Item ou seção da fonte
          <input required maxLength={120} value={sourceSection}
            onChange={(event) => setSourceSection(event.target.value)} placeholder="Ex.: item 4.2" />
        </label>
      </div>
      <label>Trecho que fundamenta o requisito
        <textarea required rows={3} minLength={10} maxLength={1200} value={evidenceExcerpt}
          onChange={(event) => setEvidenceExcerpt(event.target.value)} />
      </label>
      <label className="requirement-check">
        <input type="checkbox" checked={mandatory} onChange={(event) => setMandatory(event.target.checked)}/>
        Requisito obrigatório conforme a fonte indicada
      </label>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Registrando…' : 'Cadastrar requisito'}
      </button>
      {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'error' : 'success'}>{message}</p>}
    </form>
  </section>;
}
