import { toast } from 'sonner';

export interface FriendlyError {
  title: string;
  description: string;
}

function extractCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return undefined;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '';
}

function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return (err as { status: number }).status;
  }
  return undefined;
}

/**
 * Classifies ANY raw error — a Firebase Auth error, a Firestore error,
 * a failed fetch, or an HTTP status from one of our own API routes —
 * into a consistent, user-friendly {title, description} pair.
 *
 * The raw error is always logged to the console (never silently
 * swallowed) so it's still available for debugging; it is never shown
 * directly to the person using the dashboard.
 *
 * `context` is a short label for the console log only (e.g. "doctor
 * create", "suspend user") — helps trace which action failed without
 * needing to inspect a stack trace.
 */
export function getFriendlyError(err: unknown, context?: string): FriendlyError {
  console.error(context ? `[${context}]` : '[Error]', err);

  // Cheapest, most certain signal — check this first.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      title: 'No Internet Connection',
      description: 'Please connect to the internet and try again.',
    };
  }

  const code = extractCode(err);
  const message = extractMessage(err);
  const status = extractStatus(err);

  // Firebase Auth error codes
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
      return {
        title: 'Incorrect Login Information',
        description: 'Please check your username and password and try again.',
      };
    case 'auth/user-not-found':
      return {
        title: 'Account Not Found',
        description: "We couldn't find an account with those login details.",
      };
    case 'auth/user-disabled':
      return {
        title: 'Account Unavailable',
        description: 'Your account is currently unavailable. Please contact the administrator.',
      };
    case 'auth/too-many-requests':
      return {
        title: 'Too Many Attempts',
        description: 'Please wait a moment before trying again.',
      };
    case 'auth/network-request-failed':
      return {
        title: 'Weak Internet Connection',
        description: 'Please check your internet connection and try again.',
      };
    case 'auth/requires-recent-login':
      return {
        title: 'Session Expired',
        description: 'Please sign in again to continue.',
      };
  }

  // Firestore / gRPC-style error codes (client SDK and Admin SDK both
  // surface these as `err.code`, e.g. 'permission-denied', 'unavailable')
  switch (code) {
    case 'permission-denied':
      return {
        title: "You Don't Have Permission",
        description: "You don't have permission to do that. Please contact the administrator.",
      };
    case 'unavailable':
    case 'deadline-exceeded':
      // The request reached Google but the service itself didn't
      // respond in time — different from the local-network signals
      // below, so it gets its own message rather than being lumped
      // in with "check your connection."
      return {
        title: 'Service Temporarily Unavailable',
        description: "We're having trouble connecting to the service. Please try again in a moment.",
      };
    case 'ETIMEDOUT':
    case 'ENOTFOUND':
    case 'app/network-timeout':
    case 'app/network-error':
      return {
        title: 'Unstable Connection',
        description: 'Your internet connection appears to be unstable. Please check your connection and try again.',
      };
    case 'not-found':
      return {
        title: 'Not Found',
        description: "We couldn't find what you were looking for. It may have been removed.",
      };
    case 'already-exists':
      return {
        title: 'Already Exists',
        description: 'That already exists. Please use a different value.',
      };
    case 'invalid-argument':
      return {
        title: 'Invalid Information',
        description: 'Please check the information you entered and try again.',
      };
    case 'resource-exhausted':
      return {
        title: 'Too Many Requests',
        description: 'Please wait a moment and try again.',
      };
  }

  // Generic network signals not caught by a specific code above —
  // covers plain `fetch()` failures (offline, DNS, CORS-as-opaque, etc.)
  if (/failed to fetch|network ?error|fetch failed|load failed|getaddrinfo/i.test(message)) {
    return {
      title: 'Unstable Connection',
      description: 'Your internet connection appears to be unstable. Please check your connection and try again.',
    };
  }

  // HTTP status codes from our own /api/* routes
  if (status === 401) {
    return {
      title: 'Session Expired',
      description: 'Please sign in again to continue.',
    };
  }
  if (status === 403) {
    return {
      title: "You Don't Have Permission",
      description: "You don't have permission to do that.",
    };
  }
  if (status === 404) {
    return {
      title: 'Not Found',
      description: "We couldn't find what you were looking for.",
    };
  }
  if (status !== undefined && status >= 500) {
    return {
      title: 'Service Temporarily Unavailable',
      description: "We're having trouble connecting to the service. Please try again in a moment.",
    };
  }

  // Fallback — never expose the raw message to the person using the app.
  return {
    title: 'Something Went Wrong',
    description: "We couldn't complete your request. Please try again.",
  };
}

/**
 * For our own /api/* routes: pass the Response and its parsed JSON
 * body. A 400-range status with a `data.error` string is treated as a
 * deliberate validation message we already wrote to be clear (e.g.
 * "Username is already taken.") and is shown as-is, not re-classified.
 * Anything else (5xx, missing body, or the fetch itself throwing) goes
 * through the full classifier above.
 */
export function getApiErrorMessage(
  res: Response | null,
  data: { error?: string } | null,
  thrownErr?: unknown,
  context?: string
): FriendlyError {
  if (thrownErr !== undefined) {
    return getFriendlyError(thrownErr, context);
  }
  if (res && !res.ok) {
    if (res.status >= 400 && res.status < 500 && data?.error) {
      console.error(context ? `[${context}]` : '[API Error]', { status: res.status, error: data.error });
      return { title: 'Unable to Complete Request', description: data.error };
    }
    return getFriendlyError({ status: res.status }, context);
  }
  return getFriendlyError(new Error('Unknown API error'), context);
}

/** Convenience wrapper for the common case: classify and show a toast
 *  in one call. Use getFriendlyError/getApiErrorMessage directly when
 *  a page needs the {title, description} for its own inline UI
 *  (e.g. the login form's own error banner) instead of a toast. */
export function showFriendlyError(err: unknown, context?: string): void {
  const { title, description } = getFriendlyError(err, context);
  toast.error(title, { description });
}

export function showApiError(
  res: Response | null,
  data: { error?: string } | null,
  thrownErr?: unknown,
  context?: string
): void {
  const { title, description } = getApiErrorMessage(res, data, thrownErr, context);
  toast.error(title, { description });
}