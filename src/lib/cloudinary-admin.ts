// SERVER ONLY. Uses the Cloudinary Admin API, which needs the account's
// API secret — that secret lives only in this dashboard's server env and
// must never be shipped to the mobile app or any client component.
// (Uploads elsewhere use the unsigned preset in cloudinary.ts, which
// needs no secret; deleting does.)

const BATCH_SIZE = 100; // Admin API limit for public_ids per delete call

interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Returns the credentials only when all three variables are set.
 *  Never log or return the values themselves. */
function getCredentials(): CloudinaryCredentials | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryDeleteConfigured(): boolean {
  return getCredentials() !== null;
}

/**
 * Deletes the given image public IDs, with invalidate=true so CDN copies
 * are purged too. Cloudinary answers 'not_found' for images that are
 * already gone, which counts as success so a retry never errors on
 * them. Throws if credentials are missing or any image could not be
 * deleted.
 */
export async function deleteCloudinaryImages(publicIds: string[]): Promise<void> {
  const creds = getCredentials();
  if (!creds) throw new Error('Cloudinary credentials are not configured.');

  const auth = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(creds.cloudName)}/resources/image/upload`;

  for (let i = 0; i < publicIds.length; i += BATCH_SIZE) {
    const batch = publicIds.slice(i, i + BATCH_SIZE);
    const params = new URLSearchParams();
    batch.forEach((id) => params.append('public_ids[]', id));
    params.append('invalidate', 'true');

    const res = await fetch(`${url}?${params.toString()}`, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      // Status only — the response body is not echoed, and the request
      // (which carries the credentials) is never logged.
      throw new Error(`Cloudinary delete failed with HTTP ${res.status}.`);
    }

    const data = (await res.json()) as { deleted?: Record<string, string> };
    const failed = batch.filter((id) => {
      const result = data.deleted?.[id];
      return result !== 'deleted' && result !== 'not_found';
    });
    if (failed.length > 0) {
      throw new Error(`Cloudinary could not delete ${failed.length} image(s).`);
    }
  }
}
