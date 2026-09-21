'use client';

import { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { showApiError } from '@/lib/error-messages';

interface SnapshotComment {
  id: string;
  authorRole: 'admin' | 'user' | 'doctor';
  authorName: string;
  message: string;
  parentCommentId: string | null;
  createdAt?: Timestamp;
}

export function DoctorCommentThread({
  patientUid,
  photoId,
}: {
  patientUid: string;
  photoId: string;
}) {
  const [comments, setComments] = useState<SnapshotComment[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const colRef = collection(db, `users/${patientUid}/snapshots/${photoId}/comments`);
    const q = query(colRef, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SnapshotComment)));
    });
    return () => unsub();
  }, [patientUid, photoId]);

  async function handleSend() {
    if (!draft.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/doctors/comment/${patientUid}/${photoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: draft.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showApiError(res, data, undefined, 'post doctor comment');
        return;
      }
      setDraft('');
    } catch (err) {
      showApiError(null, null, err, 'post doctor comment');
    } finally {
      setIsSending(false);
    }
  }

  const threaded = comments
    .filter((c) => !c.parentCommentId)
    .map((c) => ({ comment: c, replies: comments.filter((r) => r.parentCommentId === c.id) }));

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Comments</p>

      <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
        {threaded.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {threaded.map(({ comment, replies }) => (
          <div key={comment.id} className="space-y-2">
            <div className="flex gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${getAvatarStyle(comment.authorName).bg} ${getAvatarStyle(comment.authorName).text}`}
              >
                {getInitials(comment.authorName)}
              </span>
              <div className="min-w-0 flex-1 rounded-md bg-muted/50 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{comment.authorName}</span>
                  {comment.createdAt?.toDate && (
                    <span className="text-[10px] text-muted-foreground">
                      {comment.createdAt.toDate().toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <p className="text-sm">{comment.message}</p>
              </div>
            </div>

            {replies.map((reply) => (
              <div key={reply.id} className="ml-8 flex gap-2">
                <div className="min-w-0 flex-1 rounded-md bg-primary/10 px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{reply.authorName}</span>
                    {reply.createdAt?.toDate && (
                      <span className="text-[10px] text-muted-foreground">
                        {reply.createdAt.toDate().toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{reply.message}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button onClick={handleSend} disabled={isSending || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}