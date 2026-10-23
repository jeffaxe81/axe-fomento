import { NextResponse } from 'next/server';

/** Defende ações que alteram dados contra requisições vindas de outros sites.
 * A origem pública precisa ser fixada pelo operador em APP_ORIGIN.
 */
export function rejectUntrustedWrite(request: Request): NextResponse | null {
  const appOrigin = process.env.APP_ORIGIN;
  if (process.env.NODE_ENV === 'production' && !appOrigin) {
    return NextResponse.json({ error: 'Configuração de segurança incompleta' }, { status: 503 });
  }
  let trustedOrigin: string;
  try {
    const parsed = new URL(appOrigin || request.url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Protocolo inválido');
    trustedOrigin = parsed.origin;
  } catch {
    return NextResponse.json({ error: 'Origem configurada inválida' }, { status: 503 });
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Origem não autorizada' }, { status: 403 });
  }
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== trustedOrigin) {
        return NextResponse.json({ error: 'Origem não autorizada' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Origem não autorizada' }, { status: 403 });
    }
  }
  return null;
}
