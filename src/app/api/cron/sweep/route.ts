import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runScheduledSweep } from '@/lib/scheduled-sweep';

// Called on a schedule (GitHub Actions, .github/workflows/sweep.yml), not
// by people: there is no session, only the shared CRON_SECRET.
export const dynamic = 'force-dynamic';
// Vercel's free plan allows up to 60 seconds per function call.
export const maxDuration = 60;

const MIN_SECRET_LENGTH = 32;

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Runs the scheduled sweep (missed appointments + doctor reply checks).
 * Requires `Authorization: Bearer <CRON_SECRET>`. Add `?dry=1` to see what
 * would change without writing anything. Responds with counts and id
 * prefixes only.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? '';
  if (secret.length < MIN_SECRET_LENGTH) {
    // Off until a long secret is configured, so it can never run open.
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get('dry') === '1';
  try {
    return NextResponse.json(await runScheduledSweep({ dryRun }));
  } catch (err: unknown) {
    console.error('[sweep] failed:', (err as { code?: unknown })?.code ?? 'unknown');
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}
