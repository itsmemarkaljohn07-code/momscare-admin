// Run: node --import tsx --test src/lib/doctor-reply-detection.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRepliesForDoctor, replyNotificationId, type ReplyCommentLike } from './doctor-reply-detection';

const DOCTOR = 'Dr. Test One';
const OTHER_DOCTOR = 'Dr. Test Two';

const doctorComment: ReplyCommentLike = { id: 'c1', authorRole: 'doctor', authorName: DOCTOR, parentCommentId: null };
const otherDoctorComment: ReplyCommentLike = { id: 'c2', authorRole: 'doctor', authorName: OTHER_DOCTOR, parentCommentId: null };
const adminComment: ReplyCommentLike = { id: 'c3', authorRole: 'admin', authorName: 'MomCare Clinic', parentCommentId: null };
const parents = new Map([doctorComment, otherDoctorComment, adminComment].map((c) => [c.id, c]));

test('doctor comment then patient reply: notifies that doctor', () => {
  const reply = { id: 'r1', authorRole: 'user', parentCommentId: 'c1' };
  assert.deepEqual(findRepliesForDoctor([reply], parents, DOCTOR), [reply]);
});

test("patient's own first (top-level) comment: no", () => {
  const own = { id: 'r2', authorRole: 'user', parentCommentId: null };
  assert.deepEqual(findRepliesForDoctor([own], parents, DOCTOR), []);
});

test("reply under another doctor's thread: no", () => {
  const reply = { id: 'r3', authorRole: 'user', parentCommentId: 'c2' };
  assert.deepEqual(findRepliesForDoctor([reply], parents, DOCTOR), []);
  assert.equal(findRepliesForDoctor([reply], parents, OTHER_DOCTOR).length, 1);
});

test('reply under an admin comment, or a staff reply: no', () => {
  const underAdmin = { id: 'r4', authorRole: 'user', parentCommentId: 'c3' };
  const doctorReply = { id: 'r5', authorRole: 'doctor', authorName: DOCTOR, parentCommentId: 'c1' };
  assert.deepEqual(findRepliesForDoctor([underAdmin, doctorReply], parents, DOCTOR), []);
});

test('reply whose parent is unknown: no', () => {
  assert.deepEqual(findRepliesForDoctor([{ id: 'r6', authorRole: 'user', parentCommentId: 'gone' }], parents, DOCTOR), []);
});

test('doctor name match ignores case and surrounding spaces', () => {
  const reply = { id: 'r7', authorRole: 'user', parentCommentId: 'c1' };
  assert.equal(findRepliesForDoctor([reply], parents, '  dr. test one ').length, 1);
});

test('reload twice: same reply gives one result and the same id', () => {
  const reply = { id: 'r8', authorRole: 'user', parentCommentId: 'c1' };
  const firstRun = findRepliesForDoctor([reply, reply], parents, DOCTOR);
  const secondRun = findRepliesForDoctor([reply], parents, DOCTOR);
  assert.equal(firstRun.length, 1);
  assert.equal(replyNotificationId(firstRun[0].id), replyNotificationId(secondRun[0].id));
  assert.equal(replyNotificationId('r8'), 'reply-r8');
});
