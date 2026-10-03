import { z } from 'zod';
import { HEX_COLOR_RE, USERNAME_RE } from '@/lib/utils';

export const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_RE, 'Usernames are 3-20 characters: letters, numbers and underscores.');

export const displayNameSchema = z.string().trim().min(1).max(40);
export const hexColorSchema = z.string().regex(HEX_COLOR_RE, 'Use a hex colour like #ff2e6e.');
export const uuidSchema = z.string().uuid();

export const avatarModelSchema = z.enum(['casual_m', 'formal_m', 'casual_f', 'formal_f', 'robot', 'blob']);
export const avatarOutfitSchema = z.enum(['tee', 'hoodie', 'suit', 'dress', 'jersey']);
/** Avatar models gated behind the premium_avatars flag. */
export const PREMIUM_AVATARS = new Set(['robot', 'blob']);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
});

export function pageRange(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

/** Escape user input for use inside a PostgREST ilike pattern. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
