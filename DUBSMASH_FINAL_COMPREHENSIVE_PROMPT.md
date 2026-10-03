# DUBSMASH - Final Comprehensive Project Prompt

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Game Overview](#game-overview)
3. [Core Mechanics](#core-mechanics)
4. [Portal 1: Admin Panel](#portal-1-admin-panel)
5. [Portal 2: Game Application](#portal-2-game-application)
6. [Feature Flags System](#feature-flags-system)
7. [Technical Stack](#technical-stack)
8. [Database Schema](#database-schema)
9. [API Architecture](#api-architecture)
10. [Deployment & Infrastructure](#deployment--infrastructure)
11. [Development Roadmap](#development-roadmap)
12. [Success Criteria](#success-criteria)

---

# EXECUTIVE SUMMARY

Dubsmash is a multiplayer web-based game where players collaborate to dub movie scenes. Teams of 2-4 players record their own dialogue for assigned character roles, then watch a reconstructed video where their recordings replace the original audio while their 3D avatars perform on screen.

**Key Features:**
- Real-time multiplayer gaming with Socket.io
- Voice recording with Web Audio API
- 3D avatar rendering (Three.js)
- Admin portal for clip management with advanced timeline editor
- Feature flags system for runtime configuration management
- In-app notifications (email only for admin alerts)
- Completely free deployment with zero monthly costs

**Why This Matters:** Creates a social, creative, shareable entertainment experience. Players can download and share their dubbed videos. Potential for viral content marketing. Feature flags enable safe experimentation and gradual feature rollouts without deployments.

---

# GAME OVERVIEW

## What Players Do

Players join a game lobby, get assigned character roles from a movie clip, record their dialogue in sequence, then watch a final video where their voices and 3D avatars replace the original actors. The game emphasizes fun, social interaction, and creative expression.

## Game Flow

The user journey: Sign up → Create/Join lobby → Select clip → Record dialogue sequences → Watch playback → Share video

When multiple players participate simultaneously, they see each other's avatars in the lobby, take turns recording (or record in parallel if clips allow), and experience real-time multiplayer synchronization via Socket.io.

## Target Audience

Casual gamers aged 13+, friend groups seeking party games, content creators, entertainment enthusiasts. The game appeals to people who enjoy improvisation, voice acting, and collaborative creativity.

---

# CORE MECHANICS

## Lobby System

Before a game starts, players gather in a virtual lobby. The main player (creator) selects a video clip and confirms character assignments. Other players see their assigned roles and confirm readiness. The lobby uses 3D avatars to create a party-like atmosphere similar to Fall Guys. Real-time updates via Socket.io keep everyone synchronized. Ready status for each player is tracked and displayed. The main player can only start the game once all other players confirm readiness.

## Video Selection

The main player browses available video clips from the admin portal. Clips are filtered by length, number of characters, and difficulty level. Once selected, the system displays character assignments and ensures all required players have joined. Only clips with 2+ characters can be played in multiplayer mode. The preview shows basic metadata about the clip.

## Recording Sequence

Each player records their assigned dialogue in turn. When it's their turn, they see the original video clip showing only their dialogue line. They click play to hear the original audio, get a 3-second countdown with visual and audio cues, then record their voice for the exact duration of the original dialogue. They can re-record unlimited times if unsatisfied. Once complete, the system moves to the next player's sequence automatically or indicates when all recording is done.

## Playback Experience

After all players finish recording, the game transitions to a playback stage. A full-screen 3D scene displays all player avatars performing actions that match the original video. The audio now consists of all player recordings mixed together and synchronized to the video timeline. Character lip-sync is optional for initial launch but recommended for polish in future updates.

## Example Scenario

A 20-second movie clip with three character dialogues: Character A speaks from 0-7 seconds, Character B from 7-13 seconds, and Character C from 13-20 seconds. Three players join the game. Player 1 (assigned Character A) records the first line. Player 2 (Character B) records the second line. Player 3 (Character C) records the third line. The final video plays all three recordings mixed together with all three avatars visible on screen simultaneously.

---

# PORTAL 1: ADMIN PANEL

## Purpose and Scope

The admin portal is where video clips are uploaded, configured, and approved for use in the game. It serves as the content management system for Dubsmash. Only users with admin role can access this portal, subject to the super_admin_approval_required feature flag.

## Access Control Architecture

**First User Setup:** When the system launches, the very first user to register automatically becomes the super admin. This person has absolute control over the platform.

**User Tiers:**
- Super admin: Can approve other users, view all clips, manage all folders, promote users to super admin, manage feature flags, access all admin features
- Regular admin: Can upload clips, manage own folders, see only own clips (unless super_admin_approval_required flag is disabled)

**Access Control Flow:** New users who sign up are regular users by default. If the super_admin_approval_required feature flag is enabled, they must request access to the admin portal. Super admin receives notification and can approve or reject the request. Only super admin can promote other admins to super admin status. If the flag is disabled, new users can access the portal immediately without approval.

**Admin Folder View:** Super admin sees a special view where each username is a folder. They can click into any user's folder to see that user's files exactly as the user organized them. This allows admins to review, approve, or troubleshoot user-created content. Regular users only see their own folders and cannot view other users' files.

## Upload & Configure Workflow

**Step 1: Upload**
Users select a video file and optionally choose a destination folder. The clip enters pending status immediately. If email_notifications_enabled flag is on, super admin receives an email notification. Super admin always receives an in-app notification that a new clip awaits configuration and approval.

**Step 2: Configuration**
The user clicks Configure on a pending clip. The interface shows a video player with timeline scrubber and trim handles. Users can trim the start and end of the video to remove unwanted portions. The timeline is interactive and shows real-time preview as they adjust trim points.

**Step 3: Character Setup**
Users create character entries (default: A, B, C). Each character can be renamed and assigned a color for visual distinction. Colors are purely visual and help distinguish sections during timeline mapping. Common colors include Red for A, Blue for B, Green for C, but users can customize based on preference.

**Step 4: Timeline Mapping**
This is the most critical and complex step. The user clicks Start Mapping and two pointer handles appear at 0 seconds and the video end. The entire timeline displays in grey (unmapped state). The user drags pointers to mark where each character's dialogue begins and ends. This creates sections that can be assigned to characters.

**Pointer Spawn and Merge Behavior:**
When the user moves an inner pointer, the system automatically spawns a new pointer at the edge to maintain clear section boundaries. For example, if the user drags the right pointer from 20 seconds to 7 seconds, a new pointer spawns at 20 seconds creating two distinct sections. If sections become adjacent with the same character assignment, they merge visually into one continuous section. This dynamic behavior prevents ambiguity about section boundaries and provides intuitive visual feedback.

**Color Feedback During Mapping:**
As the user assigns sections to characters, those sections change color (red for A, blue for B, green for C). Sections that haven't been assigned to any character remain grey. The submit button is disabled until every section is assigned to a character—no grey sections allowed in the final configuration.

**Timeline Mapping Example:**
A 20-second video initially shows one grey section (0-20 seconds). User drags right pointer to 7 seconds creating two sections: 0-7 (grey) and 7-20 (grey). User assigns 0-7 to Character A (turns red). User moves the next pointer to 13 seconds, creating three sections: 0-7 (red/A), 7-13 (grey), and 13-20 (grey). User assigns 7-13 to Character B (turns blue) and 13-20 to Character C (turns green). All sections are now assigned, submit button enables.

## Folder Management

Users create folders to organize clips hierarchically. Folders can be nested with parent-child relationships. Users can move clips between folders and delete empty folders. Super admin can perform these actions on any user's files. This allows large clip libraries to remain organized and discoverable.

## Search & Discovery

Users search clips by title using full-text search. They can filter by character count (2-4), duration, date uploaded, or approval status. Search results show thumbnail, title, character list, and current approval status. Sorting options include: newest first, oldest first, most used, alphabetical. This makes clip discovery efficient even with large libraries.

## Approval Workflow

If the clip_approval_workflow feature flag is enabled, super admin reviews pending clips before they can be used in games. They can click Approve to mark the clip as active (ready for gameplay) or Reject to send it back for revision. Comments can be added to explain rejection reasons. Users receive in-app notifications when their clips are approved or rejected.

If the flag is disabled, clips become active immediately after configuration without requiring super admin approval.

---

# PORTAL 2: GAME APPLICATION

## Landing Page (After Login)

Post-login, players see the game landing page with two main action buttons: Play and Invite Friends. Navigation options available in top bar: Profile, Notifications, Settings. The page displays a welcoming interface with current online friend count and suggested clips to play.

## Registration & Username Setup

New users sign up with email/password or SSO (Google, GitHub, Discord via Firebase). After signing up, they must create a unique username. The input field validates uniqueness in real-time via API call to prevent duplicate usernames. If a user somehow skips this screen, the system assigns a random username like Player_1234 that they can change later in their profile settings.

## Play Screen

Clicking Play shows a grid or list of available video clips. Each clip displays a thumbnail, title, character roles needed, duration, and difficulty level. Players can only see the clips where they can play at least one character. They cannot play full audio or see the complete video—only a preview and their assigned dialogue text. Clicking a clip shows a Start button that creates a game session and adds the player to the lobby.

## Friend System

**Sending Requests:** Players click Invite Friends to search for other players by username. They can send a friend request to any player. The system validates that the request doesn't already exist and prevents duplicate requests.

**Accepting Requests:** When a friend request arrives, the recipient sees a notification. If the recipient is online, they get a popup notification. They can accept (adding the person to their friends list) or reject. Rejected requests don't create ongoing notifications or appear in history.

**Inviting to Games:** Once someone is in your friends list, you can invite them to a specific clip. They receive a popup saying "Player X is inviting you to play Clip Title". They can accept (joining your lobby) or decline. Multiplayer gaming becomes frictionless when friends are pre-connected.

**Friends List Management:** Players can view their friends list at any time, see who's online, and quickly invite multiple friends to the same game session.

## Game Lobby

When players join a game, they land in a lobby that displays all participants as 3D avatars (customized with their chosen look). Each avatar shows the player's assigned character role. A Ready button lets players confirm they're prepared to start recording. The main player (whoever created the session) sees a Start Game button that only activates once all players are ready. This creates anticipation and ensures everyone is paying attention before recording begins.

## Recording Interface

When recording begins, players see a clean, intuitive interface with a large play button, the original video clip showing only their dialogue, a prominent 3-second countdown (visual and audio), a recording indicator showing live status with elapsed time, and a re-record button. After recording completes, they can play back their audio to verify quality before confirming. They can re-record unlimited times without penalty. Once satisfied, they proceed to the next sequence or submit if they're the last player to record.

## Playback Stage

After all recordings complete, the screen transitions to a full-screen 3D scene with all player avatars visible and positioned naturally. The original video plays but with dubbed audio from all players. Each player's recording is mixed into the final audio at the correct timeline position with volume normalization. The scene includes simple animations showing characters performing the dialogue. After playback completes, credits roll with player names and their character roles.

## Results Screen

After playback, a results screen appears showing: game completion time, performance summary for each player, option to download final video as MP4, option to share video via social media links, option to replay the same clip, option to play a different clip. Download sends an MP4 file to the player's device. Share generates a link that users can copy to clipboard or send via social media.

## Profile Management

Players edit their display name, username (with unique validation), and choose a 3D avatar from available options. They can select avatar color, outfit style, and other cosmetic options. Changes apply immediately across all game sessions. Profile also shows game statistics: total games played, clips created, average recording quality, friends count.

## Settings

Game controls: master volume, dialogue volume, effects volume, microphone device selection (dropdown of available audio input devices), audio input level test tool with visual feedback, subtitle/caption toggle, language preference (if multi-language support is enabled). Settings are persistent and apply across all sessions.

## Notifications

In-app notifications show: friend requests (pending requests appear at top of dropdown), game invitations (time-limited, expires after 1 hour), lobby updates (when in-game, alerts about other players), video processing status (when video is ready), and admin alerts. Notifications are badges on the bell icon in the top navigation. Clicking the bell opens a dropdown showing all unread notifications. Users can dismiss notifications or act on them (accept/decline friend requests, join invited games).

---

# FEATURE FLAGS SYSTEM

## Purpose

Feature flags (feature toggles) control feature availability at runtime without requiring code deployment. They enable safe experimentation, gradual rollouts, beta testing, and A/B testing. Non-technical team members can manage features through the admin panel.

## Feature Flags Table

A feature_flags table in Supabase stores all configuration settings. Each flag has a unique name, human-readable description, enabled status, type (boolean/percentage/user_list), and configuration value stored as JSON. Timestamps track creation and last update.

## Flag Types

**Boolean Flags:** Simple on/off features. Examples: super_admin_approval_required, email_notifications_enabled, clip_approval_workflow, friend_system_enabled.

**Percentage Flags:** Gradual rollout to percentage of users. Used for A/B testing and canary deployments. Example: new_recording_ui rolled out to 25% of users initially, then increased to 50%, finally 100%.

**User List Flags:** Features available only to specific users. Used for beta testing with selected users. Example: video_effects_beta available only to specified user IDs.

## Core Feature Flag: super_admin_approval_required

This flag controls the most critical workflow—user access to the admin portal.

**When Enabled (true):** New users can sign up but cannot access the admin portal. They must request access through the access request system. Super admin receives notification and can approve or reject the request. Only after approval can the user access the admin portal and upload clips.

**When Disabled (false):** New users can sign up and immediately access the admin portal without any approval process. No access requests are created. This is useful for development environments or when you want to open the platform to all users.

**User Experience When Enabled:** Signup works normally. User creates username normally. When they try to click the Admin Portal button, they see a message: "You need approval to access the admin portal. Request access here." They click "Request Access" button. Super admin gets in-app notification that a new access request is pending. Super admin can approve (user gets notification and portal access) or reject (user gets notification explaining denial).

**Use Cases for Toggling:**
- Launch: Keep enabled to control who accesses the portal
- Testing phase: Disable to let developers access without approval
- Open beta: Keep enabled to moderate who can upload content
- Public launch: Disable if you want community-generated content

## Additional Feature Flags

**email_notifications_enabled (boolean):** When enabled, super admin receives email notification when new clip is uploaded. When disabled, only in-app notification is sent. Useful for reducing email volume.

**clip_approval_workflow (boolean):** When enabled, clips must be approved by super admin before appearing in games. When disabled, clips go live immediately after configuration.

**friend_system_enabled (boolean):** When enabled, friend requests and invitations work normally. When disabled, players cannot send friend requests or invitations—good for testing solo gameplay.

**new_recording_ui (percentage):** Gradually rollout improved recording interface. Start at 10% to test with small user group, increase to 50%, then 100%.

**video_effects_beta (user_list):** New video effects feature available only to specific beta tester user IDs.

**premium_avatars (percentage):** Rollout premium avatar skins to percentage of users gradually.

## Admin Interface for Flags

Super admin has access to /admin/feature-flags page showing all flags. The interface displays flag name, description, current status (enabled/disabled), flag type, current value. For boolean flags, a toggle switch enables/disables the flag with immediate effect. For percentage flags, a slider shows current rollout percentage. For user list flags, a text area shows current user IDs with ability to add/remove users. Change history shows timestamp, admin who made change, and what changed.

## API Endpoints for Flags

GET /api/admin/feature-flags: List all flags with current status (super admin only)

GET /api/admin/feature-flags/:flagName: Get details of specific flag (super admin only)

PATCH /api/admin/feature-flags/:flagName/toggle: Enable/disable flag (super admin only)

PATCH /api/admin/feature-flags/:flagName/value: Update flag value/configuration (super admin only)

## Flag Service Layer

A feature flags service provides utility functions: getFlag(flagName) fetches flag configuration with 5-minute caching to reduce database queries. isFeatureEnabled(flagName, userId) checks if a feature is enabled for a specific user, handling different flag types correctly. toggleFlag(flagName, enabled) enables/disables a flag and clears cache. updateFlagValue(flagName, newValue) updates the JSON configuration.

## Caching Strategy

Feature flags are cached in-memory with 5-minute TTL to avoid database hits on every check. Cache key is "flag:{flagName}". On cache miss, fetch from database and cache result. When super admin updates a flag, clear that flag's cache entry immediately so change takes effect without waiting for TTL expiration.

## Audit Logging

All flag changes are logged to flag_change_log table capturing: flag name, old value, new value, user ID of super admin who made change, and timestamp. This creates audit trail for compliance and troubleshooting.

## Practical Examples

**Scenario 1: Disable Approval Temporarily**
Super admin navigates to /admin/feature-flags. Finds super_admin_approval_required flag. Toggles it from ON to OFF. Immediately, all new users can access the admin portal without approval. No code deployment needed.

**Scenario 2: Gradual Rollout**
New recording UI is ready. Start with 10% rollout via new_recording_ui percentage flag. Monitor for bugs. After one week, increase to 50%. Monitor further. After another week, set to 100% for all users. Each step is one click on the slider.

**Scenario 3: Beta Testing**
New video effects feature. Add specific beta tester user IDs to video_effects_beta user list flag. Only those users see the feature. Others have no idea it exists. When ready for public release, increase rollout percentage to 100%.

---

# TECHNICAL STACK

## Frontend Architecture

The frontend is built with React 18 and TypeScript for type safety. Next.js 14 provides the full-stack framework including file-based API routes. Tailwind CSS handles all styling with utility-first approach. Three.js or Babylon.js renders 3D avatars and playback scenes. Zustand manages global state (player data, game state, UI state, feature flags). Web Audio API captures microphone input and handles audio playback.

## Backend Architecture

Backend runs entirely on Vercel as serverless Node.js functions in the /pages/api directory. No separate backend server to manage or maintain. Express-like routing is handled by Next.js's file-based API routing system. TypeScript ensures type safety across frontend and backend code. Request handlers are simple, focused functions.

## Real-Time Communication

Socket.io handles WebSocket connections for real-time multiplayer synchronization. It runs within the Vercel serverless environment using Node.js runtime. Players in the same lobby emit and receive events for: player joining lobby, ready status changes, recording start/stop, sequence completion, playback synchronization.

## Database

PostgreSQL via Supabase is the primary data store. Supabase handles hosting, backups, replication, and scaling automatically. All data is relational: users, clips, game sessions, recordings, notifications, friends, folders, feature flags, access requests, and video processing queue.

## Storage

Cloudinary stores all video files—original clips, user recordings, generated videos, user avatars. Cloudinary's global CDN ensures fast delivery. No need to manage S3 buckets or storage infrastructure. Files are organized in folders within Cloudinary for easy management.

## Authentication

Firebase Auth handles user registration and authentication via MCP connection. Supports email/password signup and SSO (Google, GitHub, Discord). Firebase manages password security, token generation, and session management. No custom auth logic needed.

## Video Processing

Videos are processed using FFmpeg running on GitHub Actions scheduled every 5 minutes. FFmpeg combines the original video with all player audio recordings using filter complex for mixing. Final dubbed videos are uploaded to Cloudinary. This entire workflow is completely free—GitHub Actions provides 2000 minutes/month of free compute time, sufficient for hundreds of videos.

## Email

SendGrid sends transactional email only when enabled via email_notifications_enabled flag. Currently configured to send emails to super admin when clips are uploaded. No bulk emails, marketing emails, or other communications. Free tier: 100 emails/day.

---

# DATABASE SCHEMA

## Core Tables

**Users Table:** Stores player and admin data with fields: UUID (primary key), email (unique), username (unique), display name, role (user/admin/super_admin), avatar model reference, avatar color, avatar outfit, status (active/inactive/banned), game statistics (games played, total recordings, etc.), timestamps.

**Access Requests Table:** Tracks admin portal access requests when super_admin_approval_required flag is enabled. Fields: UUID, user_id (foreign key), status (pending/approved/rejected), requested timestamp, responded timestamp, responded_by (super_admin_id), response message.

**Folders Table:** Organizes clips hierarchically with parent-child relationships. Fields: UUID, owner_id, name, parent_folder_id (self-referencing), timestamps.

**Clips Table:** Video clip metadata and configuration. Fields: UUID, uploaded_by, folder_id, title, description, status (pending/approved/active/archived), original_video_url (Cloudinary), trimmed_video_url, thumbnail_url, duration_seconds, approved_by, approved_timestamp, characters (JSON array with id, name, color), timeline (JSON array with start/end times and character assignments), timestamps.

**Game Sessions Table:** Active and completed game instances. Fields: UUID, clip_id, players (JSON array with user_id, character, status), state (lobby/recording/playback/completed), created_by, started_timestamp, completed_timestamp, final_video_url, status, timestamps.

**Recordings Table:** Individual audio files from players. Fields: UUID, session_id, user_id, sequence_id, audio_url (Cloudinary), duration_seconds, timestamp.

**Video Processing Queue Table:** Job queue for video rendering. Fields: UUID, session_id, recordings (JSON with clip and audio details), status (pending/processing/completed/failed), created/started/completed timestamps, retry_count, error_message, result (JSON with final_video_url), unique constraint on session_id.

**Notifications Table:** In-app notifications. Fields: UUID, user_id, type (friend_request/game_invitation/video_ready/clip_approved), message, metadata (JSON with sender_id, clip_id, etc.), is_read flag, created_timestamp, read_timestamp.

**User Friends Table:** Friendship relationships with pending and accepted states. Fields: UUID, user_id, friend_id, status (pending/accepted/blocked), created_timestamp, responded_timestamp, unique constraint on user_id+friend_id pair, check constraint preventing self-friendships.

**Feature Flags Table:** Feature toggle configuration. Fields: UUID, flag_name (unique), description, is_enabled, flag_type (boolean/percentage/user_list), flag_value (JSON for configuration), created_timestamp, updated_timestamp.

**Flag Change Log Table:** Audit trail for feature flag changes. Fields: UUID, flag_name, old_value (JSON), new_value (JSON), changed_by (user_id), changed_timestamp.

---

# API ARCHITECTURE

## Authentication Endpoints

POST /api/auth/signup: Email/password or SSO signup with username validation

POST /api/auth/login: Email/password login returning JWT token

POST /api/auth/logout: Logout and invalidate session

POST /api/auth/refresh-token: Refresh expired JWT token

GET /api/auth/me: Get current authenticated user profile

## User Endpoints

GET /api/users/{userId}: Get user profile and statistics

PUT /api/users/{userId}: Update user profile (username, display name, avatar)

GET /api/users/check-username/:username: Validate username uniqueness in real-time

POST /api/admin/access-requests: Request admin portal access (when flag enabled)

GET /api/admin/access-requests: List pending access requests (super admin only)

PATCH /api/admin/access-requests/{requestId}/approve: Approve access request (super admin only)

PATCH /api/admin/access-requests/{requestId}/reject: Reject access request with optional message (super admin only)

## Clip Management Endpoints

POST /api/clips/upload: Upload new video clip to Cloudinary

GET /api/clips: List clips with filtering by status, character count, duration, date

GET /api/clips/{clipId}: Get single clip details including timeline and characters

PUT /api/clips/{clipId}/configure: Update timeline mapping and character assignments

PATCH /api/clips/{clipId}/approve: Approve clip for use in games (super admin only)

DELETE /api/clips/{clipId}: Delete clip (owner or super admin only)

GET /api/clips/{clipId}/sequences: Get dialogue sequence details for recording interface

## Game Session Endpoints

POST /api/sessions/create: Create new game session with players and clip selection

GET /api/sessions/{sessionId}: Get session details including player status and state

POST /api/sessions/{sessionId}/start: Start recording phase and initialize recording interface

POST /api/sessions/{sessionId}/complete: Mark session complete and queue video processing

GET /api/sessions/{sessionId}/status: Check processing status and estimated completion time

## Recording Endpoints

POST /api/recordings/upload: Upload player's audio recording to Cloudinary

GET /api/recordings/{recordingId}: Get recording metadata

POST /api/recordings/{recordingId}/replace: Allow player to re-record their dialogue

## Friend Endpoints

POST /api/friends/request: Send friend request to another player

GET /api/friends/requests: Get pending friend requests for current user

PATCH /api/friends/requests/{requestId}/accept: Accept friend request

PATCH /api/friends/requests/{requestId}/reject: Reject friend request

GET /api/friends/list: Get user's accepted friends with online status

DELETE /api/friends/{friendId}: Remove friend

## Notification Endpoints

GET /api/notifications: Get user's notifications with pagination

PATCH /api/notifications/{notificationId}/read: Mark notification as read

DELETE /api/notifications/{notificationId}: Delete notification

## Feature Flags Endpoints

GET /api/admin/feature-flags: List all feature flags (super admin only)

GET /api/admin/feature-flags/:flagName: Get specific flag details (super admin only)

PATCH /api/admin/feature-flags/:flagName/toggle: Enable/disable feature (super admin only)

PATCH /api/admin/feature-flags/:flagName/value: Update flag configuration (super admin only)

---

# DEPLOYMENT & INFRASTRUCTURE

## Complete Service Architecture

**Vercel:** Hosts frontend React app and backend serverless functions. Handles both UI delivery via CDN and API via serverless functions. Free tier: unlimited deployments, 100GB bandwidth per month, 60-second function timeout, auto-scaling.

**Supabase:** Managed PostgreSQL database with automatic backups and replication. Handles all data persistence. Free tier: 500MB storage, unlimited connections, real-time WebSockets enabled.

**Cloudinary:** Global CDN for media storage and delivery. Handles video clips, audio files, generated videos, and avatars. Free tier: 25GB storage, 25GB bandwidth per month.

**Firebase:** Authentication service providing signup, login, and SSO flows. Handles password security and token management. Free tier: unlimited users, all auth providers included.

**GitHub Actions:** Background job scheduler running FFmpeg video processing every 5 minutes. Free tier: 2000 minutes per month of compute time.

**SendGrid:** Transactional email service configured to notify super admin. Free tier: 100 emails per day.

**Socket.io:** Real-time communication library for multiplayer synchronization. Runs within Vercel serverless functions with Node.js runtime.

## Zero-Cost Economics

Vercel: $0 (all features within free tier limits)
Supabase: $0 (500MB database covers thousands of users and millions of operations)
Cloudinary: $0 (25GB storage and bandwidth cover extensive content library and video delivery)
Firebase: $0 (unlimited auth users and all authentication providers)
GitHub Actions: $0 (2000 minutes per month free compute time)
SendGrid: $0 (100 emails per day free tier)
Socket.io: $0 (no additional cost, runs on Vercel)

**Total monthly cost: $0** until you reach significant scale.

Scaling scenarios: At 10,000 monthly active users with average 5 games per user per week, costs remain under $50 per month. At 100,000 users, costs rise to $200-400 per month. Profitable gaming models begin generating revenue well before infrastructure costs become significant.

## Video Processing Pipeline

When a player completes recording, the backend inserts a job into the video_processing_queue table with status pending and current timestamp. Every 5 minutes, a GitHub Actions workflow triggers. The workflow checks for pending jobs in the database. It downloads the original clip from Cloudinary and all player audio recordings. FFmpeg combines them using audio mixing filters to create proper multi-track output. The resulting MP4 video is uploaded back to Cloudinary. The database record is updated with the final video URL and status changed to completed. Frontend real-time subscriptions on the video_processing_queue table notify the player that their video is ready via WebSocket. Player sees link to download or share the final video.

## Environment Variables

Frontend (.env.local for development, set in Vercel dashboard for production): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

Backend (Vercel environment variables): SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, FIREBASE_CONFIG (JSON object)

GitHub Actions Secrets (in repository settings): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

## Deployment Process

Push code to GitHub with git commit. GitHub Actions automatically triggers build and deployment to Vercel via webhook. Vercel runs build process (npm run build), executes tests, and deploys to edge network. Environment variables automatically injected at build time. Frontend is served globally via CDN. API functions are deployed to nearest compute edge location. Database connections use Supabase connection pooling for efficiency.

---

# DEVELOPMENT ROADMAP

## Phase 1: Project Setup & Foundation (Week 1)

Initialize Next.js 14 project with TypeScript and Tailwind CSS. Set up Supabase project and create database schema with all tables. Enable real-time on critical tables (video_processing_queue, notifications, user_friends). Configure Firebase authentication and enable desired providers. Create GitHub repository and push initial structure. Verify all environment variables are correctly set. Deploy blank Next.js app to Vercel to confirm deployment pipeline works end-to-end.

## Phase 2: Feature Flags & Authentication (Weeks 2-3)

Create feature_flags and flag_change_log tables in Supabase. Build feature flags service layer with caching. Implement Firebase Auth integration for signup/login/SSO. Create first-user-as-super-admin logic. Implement access request flow triggered by super_admin_approval_required flag. Build admin dashboard layout. Set up role-based access control middleware for all admin endpoints.

## Phase 3: Admin Portal Core (Weeks 4-6)

Implement video upload endpoint with Cloudinary integration. Build video configuration interface with interactive timeline editor. Implement pointer spawn/merge mechanics for timeline mapping. Create character assignment and color selection UI. Build folder management (create/rename/delete/move). Implement search and filter functionality with full-text search. Add approval workflow when clip_approval_workflow flag is enabled. Build feature flags management page for super admin. Test timeline editor extensively with various video lengths and edge cases.

## Phase 4: Game Lobby & Multiplayer (Weeks 7-8)

Implement game session creation endpoint. Build lobby UI with 3D avatar display using Three.js or Babylon.js. Set up Socket.io for real-time player synchronization within lobbies. Implement friend system (add/accept/reject/block). Build game invitation flow with popup notifications. Test lobby state management with multiple concurrent players. Verify avatar rendering performance and doesn't cause frame rate issues.

## Phase 5: Recording System (Weeks 9-10)

Implement Web Audio API for microphone capture with permission handling. Build recording UI with countdown, timer, re-record options, and visual feedback. Create recording upload endpoint to Cloudinary with chunked uploads. Implement sequence progression logic for turn-based recording. Add audio playback for review before submission. Handle edge cases: browser permissions, audio device errors, network failures, re-recording. Test audio quality at various bitrates and sample rates.

## Phase 6: Video Processing & FFmpeg (Weeks 11-12)

Set up GitHub Actions workflow file for video processing. Create video_processing_queue table and queue service. Implement FFmpeg worker script to mix audio tracks and combine with video. Set up webhook endpoint to handle Shotstack or self-hosted callbacks. Implement real-time progress updates for players via Supabase subscriptions. Test with various video lengths from 1 minute to 15 minutes and audio configurations. Test retry logic and error handling.

## Phase 7: 3D Playback & Avatar System (Weeks 13-14)

Implement Three.js or Babylon.js scene for playback stage. Load and render 3D avatar models in GLB format. Add avatar customization (color, outfit options, pose variations). Implement character animation triggers during playback. Sync avatar actions with video timeline and dialogue. Optimize rendering for mid-range devices targeting 60 FPS. Test on multiple browsers and devices.

## Phase 8: In-App Notifications & Finishing Touches (Weeks 15-16)

Implement notification system with real-time Supabase triggers. Build notification UI (bell icon, dropdown list, badge count). Implement friend request notifications with accept/reject buttons. Implement game invitation notifications with join/decline buttons. Implement video-ready notifications with download link. Add SendGrid integration for admin email alerts when email_notifications_enabled flag is on. Build user profile page (edit name, username, avatar, statistics). Implement settings page (volume, microphone, captions, language).

## Phase 9: Testing & Performance (Weeks 17-18)

Write unit tests for critical functions (auth, recording, feature flags). Write integration tests for game flow (creation, recording, playback). End-to-end tests with Cypress covering complete user journeys. Performance testing with Lighthouse and real device testing. Security audit covering SQL injection prevention, CORS configuration, auth token handling. Load testing simulating 100+ concurrent players and game sessions. Cross-browser testing on Chrome, Firefox, Safari, and mobile browsers.

## Phase 10: Launch Preparation (Weeks 19-20)

Write comprehensive documentation: developer documentation, user guide for players, admin guide for super admins. Polish error handling with user-friendly error messages and recovery suggestions. Set up monitoring with error tracking (Sentry), analytics (Posthog or Mixpanel), and performance monitoring. Establish database backup strategy and automated backup testing. Create disaster recovery playbook. Final bug fixes and QA pass. Create production deployment checklist and runbook.

---

# SUCCESS CRITERIA

## Functionality Requirements

Players must be able to sign up with email/password or SSO, create unique usernames, and log in successfully. Friend system must work—sending requests, accepting, declining, viewing friends list, and inviting to games. Admins must upload clips, configure timelines with pointer mechanics, and approve clips (when flag enabled). Game lobbies must show all players' avatars and synchronize ready status in real-time. Recording must capture audio reliably with preview and re-record option. Multiple players must record their sequences without data loss or audio corruption. Final video must show all characters on screen with properly mixed audio from all players. Video playback must occur without stuttering or audio/video sync issues. Results screen must show video download, sharing options, and replay option.

## Technical Requirements

Frontend must load in under 3 seconds on 4G connection. API responses must average under 500 milliseconds. 3D rendering must maintain 60 frames per second on mid-range devices (mobile phones from 2-3 years ago). Database queries must complete in under 100 milliseconds. Video upload must complete in under 2 minutes for files up to 500MB. Video processing must complete in under 15 minutes for clips up to 10 minutes long. Real-time updates via Socket.io must feel responsive with latency under 500 milliseconds.

## Scale & Reliability

Application must handle at least 1,000 concurrent players without degradation in performance. Database must remain responsive under load with no timeouts. Zero data loss on server crashes or failures. Automatic retry logic on transient failures. Uptime target: 99% (approximately 7.2 hours downtime per month maximum). WebSocket connections must persist reliably or reconnect automatically on network drops.

## Security Standards

All passwords must be hashed and salted using industry-standard algorithms. JWTs must be used for API authentication with proper expiration. API endpoints must require authentication for protected resources. File uploads must be validated for file type, size, and malware. SQL injection must be prevented via parameterized queries throughout. CORS must be strictly configured to allow only expected origins. All data in transit must use HTTPS with TLS 1.2 or higher. Sensitive data (API keys, secrets) must be stored in environment variables never hardcoded.

---

# CRITICAL IMPLEMENTATION DETAILS

## Timeline Editor Pointer Mechanics

The timeline editor is the most complex feature requiring careful implementation. When a user clicks Start Mapping, two pointer handles appear at positions 0 and the video end. The entire timeline displays in grey color indicating unmapped state. As the user drags pointers to create sections, the system maintains invariants: when an inner pointer moves, a new pointer automatically spawns at the old position to maintain boundary clarity; adjacent sections with identical character assignments can merge visually; pointers cannot cross each other or go out of bounds; minimum section duration is 0.5 seconds; sections must maintain natural order without overlaps. Example: dragging from 20 seconds to 7 seconds creates two distinct sections (0-7 and 7-20). Every section must be assigned a character color before submission is allowed.

## Video Processing Workflow

The workflow is asynchronous and completely non-blocking. When a player completes recording, a job is queued immediately with status pending and the player receives feedback immediately ("Video is being processed, estimated time 5-10 minutes"). GitHub Actions picks up the job every 5 minutes and runs FFmpeg. While FFmpeg works, the player can see real-time status updates via Supabase real-time subscriptions. Once complete, the final video URL is stored and the player is notified in-app. No blocking waits, no timeout issues, no synchronous processing delays the user experience.

## Socket.io Multiplayer Synchronization

Socket.io manages room-based communication with each game session having a unique room. When a player joins, they emit join:session event. Others in the room receive player:joined event with avatar details. When recording starts, recording:start is broadcast. When complete, recording:complete is broadcast with audio URL and sequence details. The playback stage uses playback:start to synchronize all players viewing the final video simultaneously. Connections automatically reconnect if dropped with exponential backoff retry logic.

## Audio Recording Quality

Web Audio API captures microphone input at the device's native sample rate (typically 44.1kHz or 48kHz). Audio is encoded to MP3 format using dynamic bitrate selection based on network conditions. During playback, FFmpeg handles mixing multiple audio tracks at the correct timeline positions using audio filter complex. Audio levels are normalized per track and globally to prevent clipping and ensure balanced mix. Users can test microphone input in settings before playing to verify audio quality.

## 3D Avatar System

Avatars are pre-built GLB models approximately 500KB each. Several avatar styles are provided covering different aesthetics. Users customize by selecting a base model, choosing a color tint, and selecting outfit variant. During lobby, avatars are loaded and displayed using Three.js instancing to handle multiple avatars efficiently. During playback, avatars are positioned according to character roles and perform simple animations showing speaking and listening actions. Performance is optimized to maintain 60 FPS even with 4 avatars plus environment rendering on screen simultaneously.

## Real-Time Notification System

Notifications are stored in the notifications table. New notifications trigger real-time subscriptions that push updates to connected clients via WebSockets. Notification types include: friend_request (from one user to another), game_invitation (player inviting to specific clip), video_ready (video processing complete), clip_approved (admin approved user's clip). Each notification includes relevant metadata (sender_id, clip_id, session_id) for context. Users can dismiss or act on notifications directly from the notification dropdown without navigating away.

## Feature Flag Integration Points

Feature flags are checked at critical points: In auth flow for super_admin_approval_required when user requests portal access. In admin middleware to verify approval status when flag is enabled. In API endpoints to conditionally return features. In UI components to show/hide features. In notification system to enable/disable email notifications. In clip management to enable/disable approval workflow. All checks use the isFeatureEnabled service function which handles caching and flag type logic.

---

# GETTING STARTED

## Agent-Driven Development Workflow

Since you have GitHub, Supabase, Vercel, and Firebase MCPs connected, tell Claude:

"Build Dubsmash game end-to-end:
1. Create GitHub repository with full Next.js 14 project structure
2. Generate all page components (landing, game, admin, profile, settings)
3. Generate all API endpoints (/api/auth, /api/clips, /api/sessions, /api/friends, /api/admin)
4. Create feature flags service and database queries
5. Create database migration SQL for all tables
6. Create Socket.io multiplayer synchronization service
7. Create feature flags UI for /admin/feature-flags page
8. Create environment variable template
9. Setup GitHub Actions workflow for FFmpeg video processing
10. Create FFmpeg worker script
11. Push everything to GitHub"

Claude will generate the entire production codebase automatically using your connected MCPs.

## Manual Setup Steps (15 minutes)

After Claude creates the GitHub repo:
1. Create Vercel project linked to GitHub repo
2. Create Supabase project and copy connection credentials
3. Create Firebase project and enable auth providers
4. Create Cloudinary account and copy API credentials
5. Create SendGrid account and get API key
6. Add all credentials to Vercel environment variables dashboard
7. Add GitHub Actions secrets (Supabase and Cloudinary credentials)
8. Trigger initial GitHub Actions workflow to test video processing

## Local Development

Clone the repo. Run npm install to install dependencies. Run npm run dev to start development server. Frontend runs on localhost:3000. Database operations connect to Supabase project. To test video processing, create test data and manually trigger the processing worker script.

---

# PROJECT METADATA

**Repository:** dubsmash (created via GitHub MCP)
**Hosting Platform:** Vercel with global CDN
**Database:** Supabase (PostgreSQL)
**Storage:** Cloudinary
**Real-Time:** Socket.io WebSockets
**Authentication:** Firebase Auth
**Video Processing:** FFmpeg via GitHub Actions
**Deployment Status:** Production-ready
**Maintenance Effort:** Minimal (all managed services)
**Total Cost:** $0/month on free tiers
**Estimated Development Time:** 20 weeks for complete production release
**Recommended Team Size:** 1 developer (with Claude agent support) can complete this project

---

# CONCLUSION

This is a complete, production-ready game specification built on completely free infrastructure with no mandatory payments. Every technical decision prioritizes zero-cost deployment while maintaining professional quality.

The game has genuine entertainment value and viral potential. Dubbed videos are inherently shareable entertainment content. Social features (friends, invitations, sharing) create network effects. The combination of voice recording, creativity, and social play appeals broadly to casual gamers and content creators.

Feature flags provide professional-grade feature management, enabling safe experimentation and gradual rollouts without code deployments. Non-technical team members can manage features independently.

Development is straightforward with clear phases, specific deliverables, and testable milestones. Using Claude as an agent to generate code reduces development time by 60-70%. One developer with agent support can build this in 20 weeks. A team of 2-3 developers could complete it in 8-10 weeks.

The platform scales smoothly from hobby project to professional service without architectural changes. As you grow to thousands of users, scaling to paid tiers of services happens gradually with costs rising proportionally to revenue.


