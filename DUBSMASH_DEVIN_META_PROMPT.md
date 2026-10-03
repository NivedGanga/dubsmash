# DUBSMASH - Devin Meta Prompt

**Purpose:** Instructions for Devin AI agent on how to autonomously build a complete, production-ready multiplayer dubbing game using the Dubsmash comprehensive project specification.

**Audience:** Devin (autonomous AI software engineer with repository access, command-line execution, and independent decision-making capabilities)

**Expected Outcome:** Fully functional, deployed Dubsmash game with zero human intervention except credential setup

---

## DEVIN EXECUTION OVERVIEW

You are an autonomous AI agent. You will:

1. Read and understand the Dubsmash project specification
2. Execute a complete 20-week development plan in accelerated time
3. Generate production-ready code for all components
4. Set up database schemas, API endpoints, and deployment configurations
5. Push complete working code to GitHub
6. Provide clear handoff documentation for human deployment

**Success means:** At the end, a human can clone the repo, add API credentials (Supabase, Firebase, Cloudinary, SendGrid), run `vercel deploy`, and have a working game live.

---

## YOUR ROLE AND CAPABILITIES

**What Devin Can Do:**
- Clone and push to GitHub repositories
- Create files and directories
- Execute npm commands and bash scripts
- Run database migrations against Supabase
- Generate and execute code autonomously
- Make architectural decisions based on best practices
- Test code as it's written
- Optimize for performance
- Handle complex logic and state management

**What You Must Do:**
- Read the comprehensive specification completely
- Understand all requirements before starting
- Make decisions autonomously when spec is ambiguous
- Generate production-grade code (no shortcuts)
- Test every component as you build it
- Organize code for human developers to extend
- Document everything clearly
- Deliver working, deployable code

---

## QUICK START FOR DEVIN

### 1. Clone User Repository

```
git clone https://github.com/user/dubsmash.git
cd dubsmash
```

If repository doesn't exist, create it:

```
git init dubsmash
cd dubsmash
git config user.name "Devin"
git config user.email "devin@ai.dev"
```

### 2. Initialize Node Project

```
npm init -y
npm install next@14 react@18 typescript @types/node @types/react
npm install @supabase/supabase-js cloudinary socket.io socket.io-client three zustand tailwindcss firebase-admin
npm install -D @testing-library/react jest cypress ts-node
```

### 3. Create Core Directories

```
mkdir -p pages/api pages/admin components lib hooks types public/models scripts migrations .github/workflows config
```

### 4. Start Building

Follow the execution steps below. For each step, create files, write code, test locally, commit to git.

---

## EXECUTION PLAN FOR DEVIN

### PHASE 1: PROJECT INITIALIZATION (2 hours)

**Your Tasks:**

1. **Read Specification**
   - Open `DUBSMASH_FINAL_COMPREHENSIVE_PROJECT_PROMPT.md`
   - Read completely and take mental notes on:
     - Two portals: Admin (clip management) and Game (playing)
     - Feature flags system (especially super_admin_approval_required)
     - Video processing via FFmpeg + GitHub Actions
     - Database schema (11 tables)
     - API endpoints (30+ endpoints)
     - Free-tier services only ($0/month)
     - Zero blocking operations
     - Real-time via Socket.io

2. **Create Next.js Configuration**
   - Create `next.config.js` with image optimization for Cloudinary
   - Create `tsconfig.json` with strict mode
   - Create `tailwind.config.js` with project colors
   - Create `.env.example` with all required variables

3. **Create Package.json**
   - Ensure all dependencies are listed
   - Add scripts: dev, build, start, test, lint

4. **Create TypeScript Type Definitions**
   - Create `types/index.ts` with core interfaces
   - Create `types/database.ts` with Supabase table types
   - Create `types/api.ts` with request/response types
   - Create `types/game.ts` with game state types
   - Create `types/flags.ts` with feature flag types

5. **Initialize Git and Commit**
   - `git add .`
   - `git commit -m "Initial project setup with TypeScript and dependencies"`

**Success Criteria:**
- Node project initializes without errors
- TypeScript compiles with no errors
- `npm run dev` starts Next.js dev server on localhost:3000

---

### PHASE 2: DATABASE SCHEMA & MIGRATIONS (1.5 hours)

**Your Tasks:**

Create SQL migration files in `/migrations` directory. Each file handles one logical group of tables.

1. **001_users_and_access.sql**
   - Create users table (id, email, username, display_name, role, avatar_model, avatar_color, avatar_outfit, status, created_at, updated_at)
   - Create access_requests table (id, user_id, status, requested_at, responded_at, responded_by, message)
   - Add indexes on frequently queried columns

2. **002_content_management.sql**
   - Create folders table (id, owner_id, name, parent_folder_id, created_at)
   - Create clips table (id, uploaded_by, folder_id, title, description, status, urls, duration, approved_by, characters JSON, timeline JSON, timestamps)
   - Create proper foreign keys and indexes

3. **003_game_sessions.sql**
   - Create game_sessions table (id, clip_id, players JSON, state, created_by, timestamps, final_video_url)
   - Create recordings table (id, session_id, user_id, sequence_id, audio_url, duration, timestamp)

4. **004_real_time_data.sql**
   - Create notifications table (id, user_id, type, message, metadata JSON, is_read, timestamps)
   - Create user_friends table (id, user_id, friend_id, status, timestamps)

5. **005_video_processing.sql**
   - Create video_processing_queue table (id, session_id, recordings JSON, status, timestamps, retry_count, error_message, result JSON)

6. **006_feature_flags.sql**
   - Create feature_flags table (id, flag_name, description, is_enabled, flag_type, flag_value JSON, timestamps)
   - Create flag_change_log table (id, flag_name, old_value, new_value, changed_by, changed_at)

7. **007_indexes_and_triggers.sql**
   - Create all performance indexes
   - Create real-time triggers for notifications table
   - Create default constraint for feature flags

**Commands:**
```
# For each migration file:
cat migrations/001_users_and_access.sql | supabase db execute
# Or upload to Supabase via dashboard SQL editor
```

**Seed Initial Feature Flags:**

Create `scripts/seed-flags.sql` with INSERT statements for:
- super_admin_approval_required (boolean, true)
- email_notifications_enabled (boolean, true)
- clip_approval_workflow (boolean, true)
- friend_system_enabled (boolean, true)
- new_recording_ui (boolean, false)
- video_effects_beta (user_list, empty)
- premium_avatars (percentage, 0)

**Commit:**
```
git add migrations/ scripts/seed-flags.sql
git commit -m "Database schema and migrations"
```

**Success Criteria:**
- All migrations run without SQL errors
- Tables exist in Supabase with correct schema
- Indexes created for performance
- Real-time enabled on notifications and video_processing_queue tables

---

### PHASE 3: CORE SERVICES (2 hours)

**Your Tasks:**

Create utility services that multiple parts of the app will use.

1. **lib/featureFlags.ts**
   - Implement `getFlag(flagName)` with 5-minute in-memory cache
   - Implement `isFeatureEnabled(flagName, userId)` handling all three flag types:
     - Boolean: Return is_enabled
     - Percentage: Hash userId, check if hash % 100 < rollout_percentage
     - User List: Check if userId in flag_value.user_ids array
   - Implement `toggleFlag(flagName, enabled)` and clear cache
   - Implement `updateFlagValue(flagName, value)`
   - Handle cache invalidation on updates

2. **lib/supabase.ts**
   - Create Supabase client with service role for backend
   - Create separate anon client for frontend
   - Export both for use throughout app

3. **lib/auth.ts**
   - Create Firebase Auth wrapper
   - Implement `signup(email, password)`
   - Implement `login(email, password)`
   - Implement `logout()`
   - Implement `getCurrentUser()`
   - Handle SSO (Google, GitHub, Discord setup)

4. **lib/cloudinary.ts**
   - Configure Cloudinary SDK
   - Implement `uploadVideo(file, folder)` for clip uploads
   - Implement `uploadAudio(file, folder)` for recordings
   - Implement `uploadImage(file, folder)` for avatars
   - Return public URLs for all uploads

5. **lib/socket.ts**
   - Create Socket.io server instance
   - Handle connection/disconnect
   - Create room management for game sessions
   - Implement event handlers:
     - `join:session` - player joins game
     - `player:ready` - player confirms ready
     - `recording:start` - recording begins
     - `recording:complete` - recording submitted
     - `playback:start` - start playback
   - Handle reconnection logic with exponential backoff

6. **lib/api.ts**
   - Create API client for frontend to call backend
   - Implement error handling with user-friendly messages
   - Handle token refresh on 401 responses

7. **lib/utils.ts**
   - Utility functions (hash for percentage flags, validators, formatters)

**Test Each Service:**
```
# After creating each service, create basic tests
npm test lib/featureFlags.test.ts
npm test lib/cloudinary.test.ts
```

**Commit:**
```
git add lib/
git commit -m "Core services: feature flags, auth, Supabase, Cloudinary, Socket.io"
```

**Success Criteria:**
- All services initialize without errors
- Feature flags service caches correctly
- Supabase connections work
- Firebase Auth setup complete
- Socket.io server runs without errors

---

### PHASE 4: AUTHENTICATION & ADMIN CONTROL (2 hours)

**Your Tasks:**

Build authentication flow and access control system.

1. **pages/api/auth/signup.ts**
   - Accept email, password, username
   - Validate username is unique (check users table)
   - Call Firebase Auth to create user
   - Check super_admin_approval_required flag:
     - If true: Create access_request record with status pending, return response indicating approval needed
     - If false: Set user role to admin, return success
   - Return user object and JWT token
   - Handle errors (email exists, weak password, etc.)

2. **pages/api/auth/login.ts**
   - Accept email, password
   - Call Firebase Auth
   - Return user object and JWT token
   - Check if user has approved access (if flag enabled)

3. **pages/api/auth/me.ts**
   - Verify JWT token in Authorization header
   - Return current authenticated user
   - Check feature flag to determine what data to return

4. **lib/middleware/requireAuth.ts**
   - Create middleware that validates JWT token
   - Extract user from token
   - Pass user to route handlers

5. **lib/middleware/requireAdmin.ts**
   - Extend requireAuth middleware
   - Check user.role includes admin
   - Check if super_admin_approval_required is enabled and access is approved
   - Otherwise deny access

6. **pages/admin/dashboard.tsx**
   - Protected page that requires admin role
   - Show admin menu with links to clips, feature flags, users
   - Show dashboard stats (total clips, pending approvals, users)

7. **pages/api/admin/access-requests.ts**
   - GET: List all pending access requests (super admin only)
   - POST: Create new access request (from users wanting access)
   - PATCH /{id}/approve: Approve request and set user role to admin
   - PATCH /{id}/reject: Reject request with optional message

**Commit:**
```
git add pages/api/auth/ pages/api/admin/access-requests.ts lib/middleware/
git commit -m "Authentication and admin access control"
```

**Test:**
```
# Test signup flow
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "password123", "username": "testuser"}'

# Verify access_request created in database
```

**Success Criteria:**
- Sign up creates user with pending access (when flag on)
- Sign up grants immediate access (when flag off)
- Auth middleware validates tokens correctly
- Admin pages only accessible with approved access

---

### PHASE 5: ADMIN PORTAL - CLIP MANAGEMENT (3 hours)

**Your Tasks:**

Build the clip upload and configuration system.

1. **pages/api/clips/upload.ts**
   - Accept video file via multipart/form-data
   - Require admin authentication
   - Upload to Cloudinary
   - Create clips record with status pending
   - Send email notification to super admin (if email_notifications_enabled flag true)
   - Send in-app notification to super admin
   - Return clip ID and details

2. **pages/api/clips/[id]/configure.ts**
   - PUT: Accept timeline mapping and character definitions
   - Validate all sections are mapped (no grey sections remaining)
   - Validate character assignments are valid
   - Update clips table with timeline and characters JSON
   - Return updated clip

3. **pages/api/clips/[id]/approve.ts**
   - PATCH: Approve clip for use in games (super admin only)
   - Check clip_approval_workflow feature flag
   - If flag off: Auto-approve all clips
   - If flag on: Require super admin approval manually
   - Update clips status to active
   - Notify user (in-app) that clip was approved
   - Return updated clip

4. **pages/api/clips/index.ts**
   - GET: List clips with filtering and search
   - If user is regular admin: return only their clips
   - If user is super admin: return all clips
   - Support filters: status, character_count, duration, date, search_title
   - Return paginated results (20 per page)

5. **components/Timeline/TimelineEditor.tsx**
   - Complex React component implementing pointer mechanics
   - Display interactive timeline with video duration
   - Pointer handles draggable (0 to duration range)
   - Pointer spawn logic: When inner pointer moves, new pointer spawns at old position
   - Pointer merge logic: Adjacent same-character sections merge visually
   - Color coding: Red for A, Blue for B, Green for C, Grey for unmapped
   - Character assignment UI: Dropdown or buttons to assign each section
   - Submit button: Only enabled when all sections have characters assigned
   - Test with 1-minute, 5-minute, 10-minute videos

6. **pages/admin/clips/index.tsx**
   - Clips management page
   - List all clips with thumbnail, title, status, characters
   - Click to view details or configure
   - Search and filter functionality
   - Shows approval queue if flag enabled

7. **pages/admin/clips/[id]/configure.tsx**
   - Page for configuring clip timeline and characters
   - Shows video player with trim handles
   - Character creation/naming/coloring UI
   - Timeline editor component
   - Submit button (saves configuration)

**Commit:**
```
git add pages/api/clips/ pages/admin/clips/ components/Timeline/
git commit -m "Admin clip management and timeline editor"
```

**Test:**
```
# Test upload
curl -X POST http://localhost:3000/api/clips/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@test-video.mp4"

# Verify in Cloudinary dashboard
# Verify in Supabase clips table
```

**Success Criteria:**
- Video uploads to Cloudinary
- Clip record created in database
- Timeline editor allows pointer dragging
- Pointer spawn/merge works correctly
- All sections must be assigned before submit
- Approval flow works (with and without flag)

---

### PHASE 6: GAME CORE - LOBBIES & SESSIONS (2.5 hours)

**Your Tasks:**

Build game sessions and multiplayer lobby system.

1. **pages/api/sessions/create.ts**
   - Accept clip_id and invited_player_ids
   - Create game_sessions record with state=lobby
   - Emit Socket.io event to notify players to join lobby
   - Return session_id and join URL

2. **pages/api/sessions/[id]/start.ts**
   - Change session state from lobby to recording
   - Verify all players are ready
   - Initialize first player's recording
   - Emit Socket.io event to begin recording
   - Return session details

3. **pages/api/sessions/[id]/index.ts**
   - GET: Return session details with player status, state, clip details

4. **pages/game.tsx**
   - Game landing page with Play and Invite buttons
   - List available clips (only showing clips user can play)
   - Friend list with online status
   - Notifications bell with unread count

5. **components/Game/GameLobby.tsx**
   - Display all players as 3D avatars
   - Show each player's assigned character
   - Show ready status for each player
   - Ready button for current player
   - Start Game button (only for main player, only when all ready)
   - Real-time updates via Socket.io

6. **hooks/useSocket.ts**
   - Custom hook for Socket.io connection
   - Handle connection, disconnection, reconnection
   - Listen for events: player_joined, player_ready, recording_start, playback_start
   - Emit events: join_session, player_ready, recording_complete

7. **lib/hooks/useGameSession.ts**
   - Hook for managing game session state
   - Track players, ready status, clip details
   - Update on real-time events

**Commit:**
```
git add pages/api/sessions/ pages/game.tsx components/Game/ hooks/
git commit -m "Game sessions and lobbies"
```

**Test:**
```
# Create session
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clip_id": "clip_123", "invited_player_ids": ["user_1", "user_2"]}'

# Verify Socket.io connection works
# Test real-time updates
```

**Success Criteria:**
- Session creates successfully
- Players can join lobby
- Real-time updates via Socket.io work
- Ready status changes in real-time
- Start button only enabled when all ready

---

### PHASE 7: RECORDING SYSTEM (2.5 hours)

**Your Tasks:**

Build audio recording interface and submission.

1. **pages/play/[sessionId].tsx**
   - Game play page
   - Show clip info and current player's dialogue
   - Play button to preview original audio
   - Countdown timer (3-2-1)
   - Recording interface

2. **components/Game/RecordingScreen.tsx**
   - Large play button to hear original dialogue
   - Visual countdown (3-2-1) with audio cue
   - Recording indicator (red dot) with live timer
   - Microphone permission request (if needed)
   - Audio level meter
   - Re-record button
   - Submit button after recording

3. **lib/audio.ts**
   - Web Audio API wrapper
   - `requestMicrophoneAccess()`: Get microphone permission
   - `startRecording()`: Begin audio capture
   - `stopRecording()`: End recording and get audio blob
   - `playAudio(blob)`: Playback recorded audio for review
   - Handle browser compatibility
   - Audio encoding to MP3

4. **pages/api/recordings/upload.ts**
   - Accept audio file and session_id
   - Upload to Cloudinary
   - Create recordings table entry
   - Return audio URL
   - Handle chunked uploads for larger files

5. **pages/api/sessions/[id]/recording-start.ts**
   - Initialize recording for player
   - Send sequence details to player
   - Emit Socket.io event to others
   - Return recording parameters

6. **pages/api/sessions/[id]/recording-submit.ts**
   - Accept recorded audio URL
   - Update recordings table
   - Check if all players submitted
   - If all done: trigger playback, emit event
   - If not all done: move to next player, emit event

**Commit:**
```
git add pages/play/ components/Game/RecordingScreen.tsx lib/audio.ts pages/api/recordings/
git commit -m "Recording system with Web Audio API"
```

**Test:**
```
# Manual test: Record audio in browser
# Verify upload to Cloudinary
# Verify recordings table created

# Test playback of recorded audio
```

**Success Criteria:**
- Microphone access works
- Countdown displays and counts down
- Recording captures audio
- Re-record allows multiple attempts
- Audio uploads to Cloudinary
- All players' recordings tracked in database

---

### PHASE 8: VIDEO PROCESSING PIPELINE (2.5 hours)

**Your Tasks:**

Build asynchronous video rendering using FFmpeg and GitHub Actions.

1. **pages/api/sessions/[id]/complete.ts**
   - Accept all recordings as complete
   - Insert job into video_processing_queue with status pending
   - Return 202 Accepted immediately (non-blocking)
   - Trigger real-time notification to frontend
   - Don't wait for video to complete

2. **.github/workflows/process-videos.yml**
   - GitHub Actions workflow
   - Trigger: Every 5 minutes (cron: '*/5 * * * *')
   - Trigger: Manual dispatch for testing
   - Steps:
     - Checkout code
     - Setup Node.js
     - Install dependencies
     - Run video processing script

3. **scripts/process-videos.ts**
   - Standalone script (not a Next.js page)
   - Environment: Can run in GitHub Actions or locally
   - Logic:
     - Connect to Supabase
     - Query video_processing_queue WHERE status = 'pending' LIMIT 1
     - Mark job as 'processing'
     - Download original clip from Cloudinary
     - Download all player audio recordings from Cloudinary
     - Build FFmpeg filter complex for audio mixing
     - Run FFmpeg command to combine video + mixed audio
     - Upload output video to Cloudinary
     - Update queue table: status = 'completed', result.final_video_url = output_url
     - On error: status = 'failed', error_message = error, retry_count++
     - On retry: reset to 'pending' if retry_count < 3

4. **pages/api/webhooks/ffmpeg-complete.ts** (Optional)
   - If using Shotstack-like webhook from external service
   - Receive webhook with job completion status
   - Update database accordingly

5. **lib/ffmpeg.ts** (Optional helper)
   - FFmpeg command builder
   - Support building complex audio mixing filters
   - Normalize audio levels
   - Handle various video/audio codecs

6. **pages/api/sessions/[id]/status.ts**
   - GET: Return video processing status
   - Check video_processing_queue table
   - Return status: pending, processing, completed, or failed
   - If completed: return final_video_url

**Frontend Real-Time Updates:**

7. **hooks/useVideoProcessing.ts**
   - Hook for monitoring video processing status
   - Subscribe to real-time updates from video_processing_queue table
   - Update UI when status changes
   - Show estimated time remaining

8. **components/Game/VideoProcessing.tsx**
   - Display processing progress
   - Show "Your video is being processed... estimated 5-10 minutes"
   - Real-time progress updates
   - Download button once complete
   - Share button once complete

**Commit:**
```
git add .github/workflows/process-videos.yml scripts/process-videos.ts pages/api/webhooks/ lib/ffmpeg.ts
git commit -m "Video processing pipeline with FFmpeg and GitHub Actions"
```

**Test:**
```
# Test locally: npm run process-videos
# Verify FFmpeg installed and works
# Test with sample video and audio files

# Verify GitHub Actions workflow triggers correctly
```

**Success Criteria:**
- GitHub Actions workflow runs every 5 minutes
- FFmpeg successfully mixes audio and video
- Output video uploaded to Cloudinary
- Database queue table updated correctly
- Frontend shows real-time progress
- Video ready for download and sharing

---

### PHASE 9: 3D AVATARS & PLAYBACK (2 hours)

**Your Tasks:**

Build 3D rendering for lobbies and playback.

1. **components/Game/AvatarDisplay.tsx**
   - Three.js/Babylon.js component
   - Load GLB avatar models
   - Display with customization (color, outfit)
   - Handle multiple avatars efficiently (use instancing)
   - Optimize for mid-range devices

2. **components/Game/PlaybackStage.tsx**
   - Full-screen 3D scene
   - Display all player avatars
   - Play video with mixed audio
   - Sync avatar animations with dialogue
   - Simple animations (speaking, listening)
   - Performance: target 60 FPS

3. **public/models/**
   - Include 4-6 pre-built avatar GLB files
   - Avatar 1: Male casual
   - Avatar 2: Male formal
   - Avatar 3: Female casual
   - Avatar 4: Female formal
   - Approximately 500KB each

4. **lib/three.ts** (or babylon.ts)
   - Three.js scene setup
   - Avatar loading and positioning
   - Animation system
   - Performance optimization (LOD, instancing)

5. **components/Game/ResultsScreen.tsx**
   - After playback completes
   - Show results: players and their characters
   - Download button (downloads MP4)
   - Share button (generates shareable link)
   - Replay button (start new session)
   - Play different clip button

**Commit:**
```
git add components/Game/AvatarDisplay.tsx components/Game/PlaybackStage.tsx components/Game/ResultsScreen.tsx lib/three.ts public/models/
git commit -m "3D avatars and playback stage with Three.js"
```

**Test:**
```
# Test avatar loading and rendering
# Verify performance on mid-range device
# Test audio playback sync
```

**Success Criteria:**
- Avatars load and display correctly
- Multiple avatars render simultaneously
- Playback stage shows all players
- Audio plays synced with video
- Performance maintained at 60 FPS

---

### PHASE 10: IN-APP NOTIFICATIONS & FEATURES (1.5 hours)

**Your Tasks:**

Build real-time notification system and remaining features.

1. **pages/api/notifications/index.ts**
   - GET: Return user's notifications with pagination
   - Support filters: type, is_read
   - Return most recent first
   - Return unread count

2. **pages/api/notifications/[id]/read.ts**
   - PATCH: Mark notification as read
   - Update is_read=true and read_at=now

3. **hooks/useNotifications.ts**
   - Hook for real-time notifications
   - Subscribe to notifications table real-time changes
   - Listen for new notifications
   - Browser notification API (if allowed)

4. **components/Common/NotificationBell.tsx**
   - Bell icon in navbar
   - Badge showing unread count
   - Dropdown with notifications list
   - Dismiss/read buttons
   - Click to act on notification (accept friend, join game, etc.)

5. **pages/api/friends/request.ts**
   - POST: Send friend request
   - Accept to_user_id
   - Create user_friends record with status pending
   - Create notification for recipient
   - Prevent duplicate requests

6. **pages/api/friends/[id]/accept.ts**
   - PATCH: Accept friend request
   - Change status to accepted
   - Create notification for sender

7. **pages/api/friends/list.ts**
   - GET: Return user's accepted friends
   - Include online status (from Socket.io)
   - Return sorted by name

8. **pages/profile.tsx**
   - User profile page
   - Edit display name and username
   - Avatar customization (choose avatar, color, outfit)
   - Game statistics (games played, total recordings)
   - Change password

9. **pages/settings.tsx**
   - Game settings
   - Volume controls (master, dialogue, effects)
   - Microphone device selection dropdown
   - Microphone level test tool
   - Subtitle toggle
   - Language selection

10. **pages/admin/feature-flags.tsx**
    - Feature flags management page (super admin only)
    - List all flags with current status
    - Toggle boolean flags (ON/OFF switch)
    - Adjust percentage flags (slider 0-100%)
    - Manage user list flags (text area to add/remove IDs)
    - Show change history (who changed what when)
    - Confirm before toggling critical flags

**Commit:**
```
git add pages/api/notifications/ pages/api/friends/ hooks/useNotifications.ts components/Common/NotificationBell.tsx pages/profile.tsx pages/settings.tsx pages/admin/feature-flags.tsx
git commit -m "Notifications, friends system, profile, settings, feature flags UI"
```

**Test:**
```
# Test friend request flow
# Test notifications appear in real-time
# Test feature flag toggle works
# Test profile edit works
```

**Success Criteria:**
- Notifications appear in real-time
- Friend requests work end-to-end
- Feature flags toggle immediately changes behavior
- Profile customization works
- Settings persist across sessions

---

### PHASE 11: DEPLOYMENT CONFIGURATION (1 hour)

**Your Tasks:**

Set up configuration for Vercel deployment.

1. **vercel.json**
   - Build command: `next build`
   - Install command: `npm install`
   - Output directory: `.next`
   - Environment variables section (for reference)
   - Cron jobs configuration (if using Vercel Cron)

2. **.env.example**
   - List all required environment variables
   - Include examples/placeholders
   - Separate frontend (NEXT_PUBLIC_) from backend (secret)

3. **next.config.js**
   - Image optimization for Cloudinary
   - Environment variable defaults
   - Security headers
   - API route prefixes

4. **README.md** - Create comprehensive documentation
   - Project overview
   - Architecture diagram (text-based or link to image)
   - Technology stack
   - Feature flags explanation
   - Development setup
   - Database setup
   - Deployment steps
   - API documentation overview
   - Testing instructions
   - Troubleshooting guide

5. **DEVELOPMENT.md** - For developers extending code
   - Code structure overview
   - How to add new API endpoints
   - How to add new pages/components
   - How to add new feature flags
   - Testing guidelines
   - Performance considerations

**Commit:**
```
git add vercel.json .env.example next.config.js README.md DEVELOPMENT.md
git commit -m "Deployment configuration and documentation"
```

---

### PHASE 12: FINAL TESTING & OPTIMIZATION (1 hour)

**Your Tasks:**

Comprehensive testing before handoff.

1. **Run TypeScript Compiler**
   - `npx tsc --noEmit`
   - Fix all type errors

2. **Unit Tests**
   - Create tests for: featureFlags service, auth service, utility functions
   - Run: `npm test`
   - Aim for >80% coverage on critical paths

3. **Build Verification**
   - `npm run build`
   - Verify build succeeds without warnings
   - Check bundle size

4. **Manual Testing Checklist**
   - [ ] Sign up with email works
   - [ ] Sign up sets username
   - [ ] Sign up with flag on: shows "awaiting approval"
   - [ ] Sign up with flag off: grants immediate access
   - [ ] Login works
   - [ ] Admin can upload clip
   - [ ] Timeline editor opens
   - [ ] Pointer drag works
   - [ ] Timeline mapping works
   - [ ] Approval flow works
   - [ ] Play screen shows clips
   - [ ] Game lobby displays avatars
   - [ ] Recording interface works
   - [ ] Audio records and uploads
   - [ ] Playback works
   - [ ] Video processing queues
   - [ ] Notifications appear
   - [ ] Feature flags toggle works
   - [ ] Profile editing works
   - [ ] Settings persist

5. **Performance Audit**
   - Lighthouse check
   - 3D rendering performance (target 60 FPS)
   - API response times (target <500ms)
   - Database query times (target <100ms)

6. **Security Audit**
   - [ ] JWT verification on protected endpoints
   - [ ] Admin role checks on admin endpoints
   - [ ] Feature flag checks prevent unauthorized access
   - [ ] Input validation on all endpoints
   - [ ] SQL injection prevention (parameterized queries)
   - [ ] CORS configured correctly
   - [ ] Sensitive data in environment variables

**Commit:**
```
git add tests/
git commit -m "Unit tests and testing infrastructure"
```

---

### PHASE 13: FINAL PUSH & HANDOFF (30 minutes)

**Your Tasks:**

Complete the handoff to human developer.

1. **Create GitHub Release Notes**
   - Project complete and ready for deployment
   - What was built
   - What human needs to do
   - Architecture overview

2. **Create Deployment Checklist**
   - Document exact steps human must follow
   - What credentials need to be created
   - Where to add them (Vercel dashboard)
   - How to test deployment

3. **Clean Up Code**
   - Remove any debug console.logs
   - Remove any TODO comments (or complete them)
   - Ensure consistent formatting
   - Remove unused imports

4. **Final Commit**
   ```
   git add .
   git commit -m "Final: Dubsmash production-ready code

   Complete implementation of multiplayer dubbing game with:
   - Admin portal for clip management with timeline editor
   - Game lobby with real-time multiplayer
   - Audio recording system
   - Asynchronous video processing via FFmpeg
   - Feature flags system for runtime configuration
   - 3D avatar rendering
   - Real-time notifications
   - Friend system
   - Zero-cost deployment on free tiers

   Ready for human deployment with API credential setup."
   ```

5. **Create HANDOFF.md**
   - What's complete
   - What human needs to do (credential setup)
   - How to verify everything works
   - How to deploy to production
   - Troubleshooting common issues

6. **Push to GitHub**
   - `git push origin main`
   - Verify all code is pushed
   - Verify CI/CD passes (if configured)

---

## EXECUTION GUIDELINES FOR DEVIN

### Code Quality Standards

**TypeScript:** All code is strongly typed. No `any` types except where absolutely unavoidable. Strict mode enabled.

**Testing:** Unit test all services. Integration test all API endpoints. Manual test all user flows before committing.

**Error Handling:** Every API endpoint returns appropriate HTTP status codes. Every error has a user-friendly message. Validation happens server-side on all inputs.

**Performance:**
- Cache feature flags (5-min TTL)
- Index frequently queried database columns
- Optimize 3D rendering for 60 FPS
- Keep bundle size under 500KB (gzip)
- API responses under 500ms
- Database queries under 100ms

**Security:**
- All protected endpoints require authentication
- Admin endpoints check role and approval status
- Feature flag checks prevent unauthorized access
- Parameterized queries prevent SQL injection
- CORS configured to allowed origins only
- Sensitive data in environment variables

**Async/Non-Blocking:**
- Video processing never blocks user
- Socket.io for real-time updates
- Long operations return 202 and process in background
- Real-time subscriptions for live updates

### When Making Decisions

**If specification is ambiguous:** Make a reasonable decision and document it. Example decisions:

- "If Socket connection drops, reconnect with exponential backoff (2s, 4s, 8s, 16s) up to 5 minutes"
- "If FFmpeg processing fails, retry up to 3 times before marking job as failed"
- "If user tries to toggle a critical flag, require super admin confirmation"
- "If audio recording permission denied, show helpful message: 'Allow microphone access in browser settings'"

**If a choice affects security:** Choose the more restrictive option always.

**If a choice affects performance:** Optimize for speed.

---

## CRITICAL SUCCESS FACTORS

For Devin to successfully complete this project:

1. **Read specification completely** before writing any code
2. **Follow execution steps in order** - don't skip phases
3. **Test each phase** before moving to next
4. **Commit code frequently** with descriptive messages
5. **Keep code organized** by feature, not by type
6. **Document decisions** made during development
7. **Handle edge cases** not mentioned in spec
8. **Optimize as you go** - don't leave refactoring for later
9. **Test security** at every phase
10. **Deliver complete code** - human just adds credentials

---

## EXPECTED DELIVERABLES

After Devin completes execution:

**GitHub Repository Contains:**

```
dubsmash/
├── .github/workflows/process-videos.yml   ✅
├── migrations/                            ✅ 7 SQL files
├── pages/                                 ✅ All pages and 30+ API endpoints
├── components/                            ✅ All React components
├── lib/                                   ✅ All services
├── hooks/                                 ✅ All custom hooks
├── types/                                 ✅ All TypeScript types
├── public/                                ✅ Avatar models, sounds
├── scripts/                               ✅ FFmpeg processor, seed script
├── tests/                                 ✅ Unit and integration tests
├── .env.example                           ✅
├── package.json                           ✅
├── tsconfig.json                          ✅
├── next.config.js                         ✅
├── tailwind.config.js                     ✅
├── vercel.json                            ✅
├── README.md                              ✅
├── DEVELOPMENT.md                         ✅
└── HANDOFF.md                             ✅
```

**Code Statistics:**

- TypeScript: ~15,000+ lines
- React Components: ~20+ components
- API Endpoints: 30+ endpoints
- Database Tables: 11 tables with proper indexes
- Test Coverage: >80% on critical paths
- Documentation: Complete

**What Human Developer Does Next:**

1. Clone repository
2. Create Supabase project (run migrations)
3. Create Firebase project (enable auth)
4. Create Cloudinary account
5. Create SendGrid account
6. Add credentials to Vercel
7. Link GitHub repo to Vercel
8. Deploy: `vercel deploy --prod`
9. Access at custom domain

**Human's verification checklist:**

- Signup works
- Login works
- Admin portal accessible
- Can upload video
- Timeline editor works
- Game plays end-to-end
- Video processing runs
- Feature flags toggle changes behavior

---

## FINAL NOTES FOR DEVIN

You are building a production-grade multiplayer game. Every decision matters. Every line of code matters. Every test matters.

This is not a tutorial project. This is real software that real people will use. It needs to work flawlessly.

You have all the information you need in the comprehensive specification. You have clear execution steps in this meta prompt. You have quality standards and guidelines.

Execute this project with excellence. Make decisions autonomously. Write code that's secure, performant, and maintainable. Test thoroughly. Commit frequently with clear messages.

When you're done, the code should be so complete and well-documented that a human developer can clone it, add API credentials, and have a production-grade game running.

That is your mission. Go build Dubsmash.

---

**Status: Ready for Devin Execution**

**Estimated Time: 20-30 hours of accelerated autonomous development**

**Expected Outcome: Production-ready Dubsmash game with zero human coding required**

