'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, orderBy, onSnapshot, addDoc, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAvatarStyle, getInitials } from '@/lib/avatar-color';
import { showFriendlyError } from '@/lib/error-messages';

interface SnapshotComment {
  id: string;
  authorRole: 'admin' | 'user';
  authorName: string;
  message: string;
  parentCommentId: string | null;
  createdAt?: Timestamp;
}

export function PhotoCommentThread({
  patientUid,
  photoId,
}: {
  patientUid: string;
  photoId: string;
}) {
  const [comments, setComments] = useState<SnapshotComment[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<{ uid: string; email: string } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentAdmin({ uid: user.uid, email: user.email ?? 'Admin' });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const colRef = collection(db, `users/${patientUid}/snapshots/${photoId}/comments`);
    const q = query(colRef, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SnapshotComment)));
      },
      (error) => showFriendlyError(error, 'live comments sync')
    );
    return () => unsub();
  }, [patientUid, photoId]);

  async function handleSend() {
    if (!draft.trim() || !currentAdmin) return;
    setIsSending(true);
    try {
      const colRef = collection(db, `users/${patientUid}/snapshots/${photoId}/comments`);
      await addDoc(colRef, {
        userId: patientUid,
        snapshotId: photoId,
        authorRole: 'admin',
        authorName: currentAdmin.email,
        authorUid: currentAdmin.uid,
        message: draft.trim(),
        parentCommentId: null,
        createdAt: Timestamp.now(),
      });
      setDraft('');
    } catch (err) {
      showFriendlyError(err, 'post admin comment');
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