'use client';

import { useState } from 'react';

export function FavoriteButton({ opportunityId, initialSaved }: { opportunityId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/opportunities/favorites', {
        method: saved ? 'DELETE' : 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ opportunityId }),
      });
      if (!response.ok) throw new Error('Não foi possível atualizar os favoritos.');
      setSaved(!saved);
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return <span className="favorite-control">
    <button type="button" className={'btn ' + (saved ? 'btn-favorite-active' : 'btn-light')}
      aria-pressed={saved} aria-label={saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      onClick={toggle} disabled={busy}>
      <span aria-hidden="true">{saved ? '★' : '☆'}</span> {saved ? 'Nos favoritos' : 'Favoritar'}
    </button>
    {error && <span role="alert" className="error">{error}</span>}
  </span>;
}
