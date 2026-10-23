'use client';
import { useState, type FormEvent } from 'react';
export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
      if (!response.ok) throw new Error('E-mail ou senha inválidos.');
      window.location.assign('/');
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha de autenticação'); setBusy(false); }
  }
  return <form onSubmit={submit} className="login-form"><label>E-mail institucional<input type="email" name="email" autoComplete="username" placeholder="usuario@prefeitura.gov.br" required /></label><label>Senha<input type="password" name="password" autoComplete="current-password" minLength={12} placeholder="••••••••••••" required /></label>{error && <p role="alert" className="error">{error}</p>}<button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Acessar plataforma →'}</button></form>;
}
