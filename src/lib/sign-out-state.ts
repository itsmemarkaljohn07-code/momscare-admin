// Remembers that the user just chose to log out, so the live Firestore
// listeners still mounted on the old page (refused by the rules once
// signed out) don't show "You Don't Have Permission" toasts.

const QUIET_WINDOW_MS = 15_000;
let signedOutAt = 0;

export function markSigningOut(): void {
  signedOutAt = Date.now();
}

export function justSignedOut(): boolean {
  return signedOutAt > 0 && Date.now() - signedOutAt < QUIET_WINDOW_MS;
}
