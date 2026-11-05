'use client';

import Link from 'next/link';
import { useState } from 'react';

type SavedSearch = { id: string; name: string; search: string; area: string };
type Filters = { search: string; area: string };
type ApiResult = { item?: SavedSearch; error?: string };

function savedHref(item: SavedSearch) {
  const params = new URLSearchParams();
  if (item.search) params.set('busca', item.search);
  if (item.area) params.set('area', item.area);
  return '/oportunidades' + (params.size ? '?' + params.toString() : '');
}

export function SavedSearches({ initialItems, currentFilters }: {
  initialItems: SavedSearch[]; currentFilters: Filters;
}) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function write(method: 'POST' | 'PATCH' | 'DELETE', data: object): Promise<ApiResult> {
    const response = await fetch('/api/opportunities/searches', {
      method, credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = (await response.json()) as ApiResult;
    if (!response.ok) throw new Error(result.error || 'Não foi possível alterar a busca.');
    return result;
  }
  async function perform(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
    }
  }
  function save() {
    void perform(async () => {
      const { item } = await write('POST', { name, ...currentFilters });
      if (!item) throw new Error('Resposta incompleta.');
      setItems((before) => [...before, item].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setName('');
    }, 'Busca salva para sua conta.');
  }
  function update(item: SavedSearch) {
    void perform(async () => {
      const renamed = drafts[item.id] ?? item.name;
      const result = await write('PATCH', { id: item.id, name: renamed, ...currentFilters });
      if (!result.item) throw new Error('Resposta incompleta.');
      setItems((before) => before.map((old) => old.id === item.id ? result.item! : old));
      setDrafts((before) => ({ ...before, [item.id]: result.item!.name }));
    }, 'Nome e filtros atualizados.');
  }
  function remove(item: SavedSearch) {
    void perform(async () => {
      await write('DELETE', { id: item.id });
      setItems((before) => before.filter((old) => old.id !== item.id));
    }, 'Busca excluída.');
  }

  return <section className="panel saved-search-panel" aria-labelledby="saved-search-title">
    <div className="panel-heading">
      <div>
        <h2 id="saved-search-title">Buscas salvas</h2>
        <p>Guarde filtros por conta e retome sua consulta em outra sessão.</p>
      </div>
    </div>
    <div className="saved-search-create">
      <label htmlFor="saved-search-name">Nome da busca</label>
      <input id="saved-search-name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)}
        placeholder="Ex.: Editais de saúde" />
      <button type="button" className="btn btn-primary" disabled={busy || name.trim().length < 2} onClick={save}>
        Salvar filtros atuais
      </button>
    </div>
    {items.length > 0 ? <ul className="saved-search-list">
      {items.map((item) => <li key={item.id} className="saved-search-row">
        <div className="saved-search-details">
          <label htmlFor={'search-name-' + item.id}>Nome editável</label>
          <input id={'search-name-' + item.id} maxLength={60}
            value={drafts[item.id] ?? item.name}
            onChange={(event) => setDrafts((before) => ({ ...before, [item.id]: event.target.value }))} />
          <small>{[item.search && 'Busca: ' + item.search, item.area && 'Área: ' + item.area].filter(Boolean).join(' · ') || 'Todos os editais'}</small>
        </div>
        <div className="radar-actions">
          <Link href={savedHref(item)} className="btn btn-outline">Abrir</Link>
          <button type="button" className="btn btn-light" disabled={busy || (drafts[item.id] ?? item.name).trim().length < 2}
            onClick={() => update(item)}>Atualizar</button>
          <button type="button" className="btn btn-danger-outline" disabled={busy}
            aria-label={'Excluir busca ' + item.name} onClick={() => remove(item)}>Excluir</button>
        </div>
      </li>)}
    </ul> : <p className="muted">Nenhuma busca salva nesta conta.</p>}
    <p className="help">Ao atualizar uma busca, o nome editado e os filtros atualmente visíveis no radar substituem os dados anteriores.</p>
    {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'error' : 'success'}>{message}</p>}
  </section>;
}
