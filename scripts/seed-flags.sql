-- Seed default feature flags. Idempotent: existing flags keep their current values.
insert into public.feature_flags (flag_name, description, is_enabled, is_critical, flag_type, flag_value) values
  ('super_admin_approval_required',
   'New users must request and receive super admin approval before accessing the admin portal.',
   true, true, 'boolean', '{}'),
  ('email_notifications_enabled',
   'Email the super admin (via SendGrid) when a new clip is uploaded.',
   true, false, 'boolean', '{}'),
  ('clip_approval_workflow',
   'Clips must be approved by a super admin before they appear in games.',
   true, true, 'boolean', '{}'),
  ('friend_system_enabled',
   'Enable friend requests and game invitations.',
   true, false, 'boolean', '{}'),
  ('new_recording_ui',
   'Gradual rollout of the improved recording interface (live waveform).',
   false, false, 'percentage', '{"rollout_percentage": 0}'),
  ('video_effects_beta',
   'Video effects beta, available only to listed user IDs.',
   true, false, 'user_list', '{"user_ids": []}'),
  ('premium_avatars',
   'Rollout of premium avatar skins to a percentage of users.',
   true, false, 'percentage', '{"rollout_percentage": 0}')
on conflict (flag_name) do nothing;
