import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-admin-session';
import { getAuditLogPage, type AuditLogFilters } from '@/lib/get-audit-logs';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const ACTION_PATTERN = /^[a-z_]+\.[a-z_]+$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Admin-only, read-only: one page of the audit log. There is no route
 *  that edits or deletes audit entries. */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const cursor = p.get('cursor');
  const action = p.get('action') ?? '';
  const role = p.get('role') ?? '';
  const from = p.get('from') ?? '';
  const to = p.get('to') ?? '';
  const q = (p.get('q') ?? '').slice(0, 100);

  if (
    (cursor && !ID_PATTERN.test(cursor)) ||
    (action && !ACTION_PATTERN.test(action)) ||
    (role && role !== 'admin' && role !== 'doctor') ||
    (from && !DAY_PATTERN.test(from)) ||
    (to && !DAY_PATTERN.test(to))
  ) {
    return NextResponse.json({ error: 'Invalid filter.' }, { status: 400 });
  }

  const filters: AuditLogFilters = {
    q: q || undefined,
    action: action || undefined,
    role: (role || undefined) as AuditLogFilters['role'],
    from: from || undefined,
    to: to || undefined,
  };

  try {
    return NextResponse.json(await getAuditLogPage(filters, cursor));
  } catch (err: unknown) {
    console.error('Failed to load audit log:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Could not load the audit log.' }, { status: 500 });
  }
}
