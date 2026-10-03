import type { FlagType, FlagValue } from './database';

export const FLAG_NAMES = [
  'super_admin_approval_required',
  'email_notifications_enabled',
  'clip_approval_workflow',
  'friend_system_enabled',
  'new_recording_ui',
  'video_effects_beta',
  'premium_avatars',
] as const;

export type FlagName = (typeof FLAG_NAMES)[number];

/** Flags whose change requires an explicit confirmation in the admin UI. */
export const CRITICAL_FLAGS: readonly FlagName[] = ['super_admin_approval_required', 'clip_approval_workflow'];

export interface FlagDefinition {
  flag_name: FlagName;
  flag_type: FlagType;
  is_enabled: boolean;
  flag_value: FlagValue;
  description: string;
}

/**
 * Safe defaults used when the database is unreachable or a flag row is missing.
 * Security-relevant flags default to the most restrictive option.
 */
export const FLAG_DEFAULTS: Record<FlagName, FlagDefinition> = {
  super_admin_approval_required: {
    flag_name: 'super_admin_approval_required',
    flag_type: 'boolean',
    is_enabled: true,
    flag_value: {},
    description: 'New users must request and receive super admin approval before accessing the admin portal.',
  },
  email_notifications_enabled: {
    flag_name: 'email_notifications_enabled',
    flag_type: 'boolean',
    is_enabled: true,
    flag_value: {},
    description: 'Email the super admin (via SendGrid) when a new clip is uploaded.',
  },
  clip_approval_workflow: {
    flag_name: 'clip_approval_workflow',
    flag_type: 'boolean',
    is_enabled: true,
    flag_value: {},
    description: 'Clips must be approved by a super admin before they appear in games.',
  },
  friend_system_enabled: {
    flag_name: 'friend_system_enabled',
    flag_type: 'boolean',
    is_enabled: true,
    flag_value: {},
    description: 'Enable friend requests and game invitations.',
  },
  new_recording_ui: {
    flag_name: 'new_recording_ui',
    flag_type: 'percentage',
    is_enabled: false,
    flag_value: { rollout_percentage: 0 },
    description: 'Gradual rollout of the improved recording interface (live waveform).',
  },
  video_effects_beta: {
    flag_name: 'video_effects_beta',
    flag_type: 'user_list',
    is_enabled: true,
    flag_value: { user_ids: [] },
    description: 'Video effects beta, available only to listed user IDs.',
  },
  premium_avatars: {
    flag_name: 'premium_avatars',
    flag_type: 'percentage',
    is_enabled: true,
    flag_value: { rollout_percentage: 0 },
    description: 'Rollout of premium avatar skins to a percentage of users.',
  },
};

export function isFlagName(name: string): name is FlagName {
  return (FLAG_NAMES as readonly string[]).includes(name);
}

/** Evaluated flags for the current user, sent to the client. */
export type EvaluatedFlags = Record<FlagName, boolean>;
