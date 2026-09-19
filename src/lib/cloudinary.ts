// Same Cloudinary account and unsigned upload preset already used by
// the mobile app's Snapshot uploads (cloudinary.service.ts) — kept
// identical here so both apps land in the same place and there's only
// one Cloudinary integration to reason about, not two.
const CLOUDINARY_CLOUD_NAME = 'c0okqdac';
const CLOUDINARY_UPLOAD_PRESET = 'momscare_unsigned';

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export interface CloudinaryUploadResult {
  secure_url: string; // hosted HTTPS URL — store this in Firestore
  public_id: string;
}

/**
 * Uploads a File to Cloudinary and returns the resulting hosted URL.
 * Plain HTTPS POST, no SDK, no secret key — unsigned preset only,
 * same as the mobile app's implementation.
 */
export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudinary upload failed: ${errText}`);
    }

    const data = await response.json();
    return { secure_url: data.secure_url, public_id: data.public_id };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Upload timed out. Please check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}