import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';
import { optionalEnv, requireEnv } from './env';
import type { UploadSignatureResponse } from '@/types/api';

let configured = false;

function cfg(): typeof cloudinary {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || requireEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'),
      api_key: requireEnv('CLOUDINARY_API_KEY'),
      api_secret: requireEnv('CLOUDINARY_API_SECRET'),
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export const rootFolder = () => optionalEnv('CLOUDINARY_ROOT_FOLDER') ?? 'dubsmash';

export type UploadKind = 'clip' | 'recording' | 'avatar';

export const UPLOAD_LIMITS: Record<UploadKind, { maxBytes: number; formats: string[]; resourceType: 'video' | 'image' }> = {
  clip: { maxBytes: 500 * 1024 * 1024, formats: ['mp4', 'mov', 'webm', 'mkv', 'm4v'], resourceType: 'video' },
  // Cloudinary stores audio under resource_type "video".
  recording: { maxBytes: 25 * 1024 * 1024, formats: ['webm', 'ogg', 'mp3', 'm4a', 'wav', 'mp4', 'opus'], resourceType: 'video' },
  avatar: { maxBytes: 5 * 1024 * 1024, formats: ['png', 'jpg', 'jpeg', 'webp'], resourceType: 'image' },
};

/** Cloudinary folder for each asset kind; the owner segment lets the server verify ownership later. */
export function folderFor(kind: UploadKind, ownerId: string, scopeId?: string): string {
  const root = rootFolder();
  if (kind === 'clip') return `${root}/clips/${ownerId}`;
  if (kind === 'recording') return `${root}/recordings/${scopeId ?? 'misc'}/${ownerId}`;
  return `${root}/avatars/${ownerId}`;
}

/**
 * Create a signature for a direct browser -> Cloudinary upload. The signed params pin the folder,
 * public id and allowed formats so the client cannot upload elsewhere or upload arbitrary types.
 */
export function signUpload(kind: UploadKind, ownerId: string, scopeId?: string): UploadSignatureResponse {
  const c = cfg();
  const limits = UPLOAD_LIMITS[kind];
  const folder = folderFor(kind, ownerId, scopeId);
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    timestamp,
    folder,
    public_id: `${kind}_${timestamp}_${Math.random().toString(36).slice(2, 10)}`,
    allowed_formats: limits.formats.join(','),
  };
  const apiSecret = c.config().api_secret!;
  const signature = c.utils.api_sign_request(params, apiSecret);
  const cloudName = c.config().cloud_name!;
  return {
    cloud_name: cloudName,
    api_key: c.config().api_key!,
    timestamp,
    signature,
    folder,
    resource_type: limits.resourceType,
    upload_url: `https://api.cloudinary.com/v1_1/${cloudName}/${limits.resourceType}/upload`,
    params,
  };
}

export interface VerifiedAsset {
  public_id: string;
  secure_url: string;
  bytes: number;
  format: string;
  duration: number | null;
  resource_type: string;
}

/**
 * Look up an uploaded asset via the Admin API and check it belongs to the expected folder, has an
 * allowed format and is within size limits. Throws with a user-safe message on failure.
 */
export async function verifyAsset(kind: UploadKind, publicId: string, ownerId: string, scopeId?: string): Promise<VerifiedAsset> {
  const limits = UPLOAD_LIMITS[kind];
  const folder = folderFor(kind, ownerId, scopeId);
  if (!publicId.startsWith(`${folder}/`)) throw new Error('Uploaded file is not in your upload folder.');
  const res = (await cfg().api.resource(publicId, { resource_type: limits.resourceType, media_metadata: true })) as {
    public_id: string;
    secure_url: string;
    bytes: number;
    format: string;
    duration?: number;
    resource_type: string;
  };
  if (res.bytes > limits.maxBytes) throw new Error(`File too large (max ${Math.round(limits.maxBytes / 1024 / 1024)}MB).`);
  if (!limits.formats.includes(res.format.toLowerCase())) throw new Error(`Unsupported file format ${res.format}.`);
  return {
    public_id: res.public_id,
    secure_url: res.secure_url,
    bytes: res.bytes,
    format: res.format,
    duration: typeof res.duration === 'number' ? res.duration : null,
    resource_type: res.resource_type,
  };
}

/** MP4 URL of the clip trimmed to [start, end] using Cloudinary on-the-fly transformations. */
export function trimmedVideoUrl(publicId: string, start: number, end: number | null): string {
  return cfg().url(publicId, {
    resource_type: 'video',
    secure: true,
    format: 'mp4',
    transformation: [{ start_offset: start.toFixed(2), ...(end !== null ? { end_offset: end.toFixed(2) } : {}) }],
  });
}

export function thumbnailUrl(publicId: string, atSeconds = 1): string {
  return cfg().url(publicId, {
    resource_type: 'video',
    secure: true,
    format: 'jpg',
    transformation: [{ start_offset: atSeconds.toFixed(2), width: 640, height: 360, crop: 'fill' }],
  });
}

async function upload(file: string, folder: string, options: UploadApiOptions): Promise<UploadApiResponse> {
  const c = cfg();
  // upload_large streams in 20MB chunks, required for big videos.
  if (options.resource_type === 'video') {
    return new Promise((resolve, reject) => {
      c.uploader.upload_large(file, { folder, chunk_size: 20_000_000, ...options }, (err, res) =>
        err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res),
      );
    });
  }
  return c.uploader.upload(file, { folder, ...options });
}

/** Server-side uploads (file path, URL or data URI). Return the public URL. */
export const uploadVideo = (file: string, folder: string, options: UploadApiOptions = {}) =>
  upload(file, folder, { resource_type: 'video', ...options });
export const uploadAudio = (file: string, folder: string, options: UploadApiOptions = {}) =>
  upload(file, folder, { resource_type: 'video', ...options });
export const uploadImage = (file: string, folder: string, options: UploadApiOptions = {}) =>
  upload(file, folder, { resource_type: 'image', ...options });

export async function deleteAsset(publicId: string, resourceType: 'video' | 'image' = 'video'): Promise<void> {
  await cfg().uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
}
