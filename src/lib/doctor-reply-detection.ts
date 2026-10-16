// Pure rule for "a patient replied to a doctor's Snapshot comment". No
// Firebase imports, so it can be unit-tested with plain Node.

export interface ReplyCommentLike {
  id: string;
  authorRole: string;
  authorName?: string | null;
  parentCommentId?: string | null;
}

/** Deterministic notification id: the same reply always maps to the
 *  same record, so repeated detection can't create a second one. */
export function replyNotificationId(commentId: string): string {
  return `reply-${commentId}`;
}

function sameName(a: string | null | undefined, b: string): boolean {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Returns the patient replies `doctorName` should be notified about: a
 * comment written by the patient (authorRole 'user') whose parent comment
 * was written by this doctor. A patient's own top-level comment, a reply
 * under another doctor's or an admin's comment, and staff replies are
 * ignored. Each reply appears at most once.
 *
 * Callers pass only threads of patients currently assigned to the doctor.
 */
export function findRepliesForDoctor<T extends ReplyCommentLike>(
  replies: T[],
  parentsById: ReadonlyMap<string, ReplyCommentLike>,
  doctorName: string
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const reply of replies) {
    if (reply.authorRole !== 'user' || !reply.parentCommentId) continue;
    if (seen.has(reply.id)) continue;
    const parent = parentsById.get(reply.parentCommentId);
    if (!parent || parent.authorRole !== 'doctor' || !sameName(parent.authorName, doctorName)) continue;
    seen.add(reply.id);
    result.push(reply);
  }
  return result;
}
