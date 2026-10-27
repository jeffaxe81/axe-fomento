import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET() {
  try { await query('SELECT 1 AS ok'); return NextResponse.json({ status: 'ok' }); }
  catch { return NextResponse.json({ status: 'unavailable' }, { status: 503 }); }
}
