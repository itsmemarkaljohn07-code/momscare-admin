'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Lock } from 'lucide-react';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { showApiError, showFriendlyError } from '@/lib/error-messages';

interface ClinicalNote {
  id: string;
  authorUid: string;
  authorName: string;
  message: string;
  createdAt?: Timestamp;
}

export function ClinicalNotesPanel({
  patientUid,
  /** 'doctor' gets create + delete-own. 'admin' is read-only — Admin
   *  never authors clinical notes, only reviews them. */
  viewerRole,
  /** Required when viewerRole is 'doctor' — used to show the delete
   *  button only on this doctor's own notes. Pass session.uid from
   *  getDoctorSession() on the server page, not a client-derived
   *  value — client-side auth-claim checks are exactly what broke
   *  the comment feature earlier; this avoids that class of bug
   *  entirely by not needing "who am I" derived in the browser. */
  currentDoctorUid,
}: {
  patientUid: string;
  viewerRole: 'doctor' | 'admin';
  currentDoctorUid?: string;
}) {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const colRef = collection(db, `users/${patientUid}/clinicalNotes`);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClinicalNote)));
      },
      (error) => showFriendlyError(error, 'live clinical notes sync')
    );
    return () => unsub();
  }, [patientUid]);

  async function handleSend() {
    if (!draft.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/doctors/clinical-notes/${patientUid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: draft.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showApiError(res, data, undefined, 'add clinical note');
        return;
      }
      setDraft('');
    } catch (err) {
      showApiError(null, null, err, 'add clinical note');
    } finally {
      setIsSending(false);
    }
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    try {
      const res = await fetch(`/api/doctors/clinical-notes/${patientUid}/${noteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showApiError(res, data, undefined, 'delete clinical note');
      }
    } catch (err) {
      showApiError(null, null, err, 'delete clinical note');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-sm font-semibold">Clinical Notes</p>
        <span className="text-xs text-muted-foreground">— never visible to the patient</span>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">No clinical notes yet.</p>
        )}
        {notes.map((n) => (
          <Card key={n.id}>
            <CardContent className="flex items-start gap-2.5 p-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${getAvatarStyle(n.authorName).bg} ${getAvatarStyle(n.authorName).text}`}
              >
                {getInitials(n.authorName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{n.authorName}</span>
                  {n.createdAt?.toDate && (
                    <span className="text-[10px] text-muted-foreground">
                      {n.createdAt.toDate().toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <p className="overflow-hidden whitespace-pre-wrap break-all text-sm">{n.message}</p>
              </div>
              {viewerRole === 'doctor' && n.authorUid === currentDoctorUid && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(n.id)}
                  disabled={deletingId === n.id}
                  aria-label="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {viewerRole === 'doctor' && (
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a private clinical note..."
            rows={2}
            className="min-w-0 flex-1 resize-none break-all rounded-xl"
          />
          <Button
            onClick={handleSend}
            disabled={isSending || !draft.trim()}
            className="shrink-0 self-end rounded-full"
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}