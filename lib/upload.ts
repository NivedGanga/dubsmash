/**
 * Direct browser -> Cloudinary uploads using a server-issued signature (/api/uploads/sign).
 * Files larger than CHUNK_SIZE are sent in chunks (Cloudinary chunked upload protocol:
 * X-Unique-Upload-Id + Content-Range), so 500MB videos upload reliably and report progress.
 */
import type { UploadSignatureResponse } from '@/types/api';
import { api } from './api';
import { adminApi } from './adminApi';

const CHUNK_SIZE = 20 * 1024 * 1024;
const MAX_CHUNK_RETRIES = 3;

export interface UploadResult {
  public_id: string;
  secure_url: string;
  duration?: number;
  bytes: number;
  format: string;
}

export type UploadKind = { kind: 'clip' } | { kind: 'recording'; session_id: string };

function sendChunk(
  sig: UploadSignatureResponse,
  blob: Blob,
  fileName: string,
  range: { start: number; end: number; total: number } | null,
  uploadId: string,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult | null> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', blob, fileName);
    form.append('api_key', sig.api_key);
    form.append('signature', sig.signature);
    for (const [k, v] of Object.entries(sig.params)) form.append(k, String(v));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.upload_url);
    if (range) {
      xhr.setRequestHeader('X-Unique-Upload-Id', uploadId);
      xhr.setRequestHeader('Content-Range', `bytes ${range.start}-${range.end - 1}/${range.total}`);
    }
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const json = JSON.parse(xhr.responseText) as UploadResult & { done?: boolean };
        // Intermediate chunks return partial info; the final chunk returns the full resource.
        resolve(json.public_id && json.secure_url ? json : null);
      } else {
        let msg = `Upload failed (${xhr.status}).`;
        try {
          msg = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ?? msg;
        } catch {
          /* keep default */
        }
        reject(Object.assign(new Error(msg), { status: xhr.status }));
      }
    };
    xhr.onerror = () => reject(Object.assign(new Error('Network error during upload.'), { status: 0 }));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

export async function uploadToCloudinary(
  file: Blob,
  kind: UploadKind,
  opts: { fileName?: string; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadResult> {
  // Clip uploads are admin-portal work (Admin token); game recordings use the Firebase token.
  const signer = kind.kind === 'clip' ? adminApi : api;
  const sig = await signer<UploadSignatureResponse>('/api/uploads/sign', { method: 'POST', body: kind });
  const name = opts.fileName ?? (file instanceof File ? file.name : 'upload');
  const total = file.size;
  const report = (loaded: number) => opts.onProgress?.(Math.min(1, loaded / Math.max(1, total)));

  if (total <= CHUNK_SIZE) {
    const res = await sendChunk(sig, file, name, null, '', report, opts.signal);
    if (!res) throw new Error('Upload did not complete.');
    return res;
  }

  const uploadId = `${sig.timestamp}-${Math.random().toString(36).slice(2, 12)}`;
  let result: UploadResult | null = null;
  for (let start = 0; start < total; start += CHUNK_SIZE) {
    const end = Math.min(total, start + CHUNK_SIZE);
    for (let attempt = 0; ; attempt++) {
      try {
        result = await sendChunk(sig, file.slice(start, end), name, { start, end, total }, uploadId, (l) => report(start + l), opts.signal);
        break;
      } catch (err) {
        const status = (err as { status?: number }).status ?? 0;
        // Retry transient failures (network / 5xx) with backoff; give up on client errors.
        if ((err as Error).name === 'AbortError' || attempt >= MAX_CHUNK_RETRIES || (status >= 400 && status < 500)) throw err;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  if (!result) throw new Error('Upload did not complete.');
  return result;
}
