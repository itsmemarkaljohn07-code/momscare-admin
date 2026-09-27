import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import type { PatientRiskFlag } from '@/lib/get-patient-risk-indicators';

export function PatientRiskPanel({ flags }: { flags: PatientRiskFlag[] }) {
  const visible = flags.slice(0, 6);
  const remaining = flags.length - visible.length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" style={{ color: 'var(--status-pending)' }} />
          Needs Attention
        </CardTitle>
        {flags.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending)' }}
          >
            {flags.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {flags.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--status-approved)' }} />
            No patients currently flagged — everything looks on track.
          </div>
        ) : (
          <div className="space-y-1">
            {visible.map((f) => (
              <Link
                key={f.uid}
                href={`/admin/users/${f.uid}`}
                className="flex items-center justify-between gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {f.fullName}
                    {f.currentWeek !== null && (
                      <span className="ml-1.5 font-normal text-muted-foreground">· Week {f.currentWeek}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{f.reasons.join(' · ')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {remaining > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                +{remaining} more flagged patient{remaining === 1 ? '' : 's'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}