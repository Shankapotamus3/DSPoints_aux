# Overview

ChoreRewards is a gamified task management application that helps users stay motivated by earning points for completing chores and spending those points on rewards. Built with React (frontend) and Express (backend), the application features a modern UI using shadcn/ui components, real-time progress tracking, a points-based reward system, lottery ticket system, punishment tracking, messaging, and a full Yahtzee dice game. Users can create and manage chores, set custom rewards, play games to earn points, and track their transaction history in an engaging, game-like interface.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management with optimistic updates
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode support)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Form Handling**: React Hook Form with Zod validation schemas
- **Build System**: Vite with ESBuild for fast development and production builds

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **Database ORM**: Drizzle ORM with PostgreSQL as the target database
- **API Design**: RESTful API with JSON responses and proper HTTP status codes
- **Data Storage**: In-memory storage implementation with interface-based design for easy database migration
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **Development**: Hot module replacement via Vite integration in development mode

## Database Schema Design
- **Users**: Store user credentials and point balance
- **Chores**: Task management with completion tracking, point values, timestamps, and assignment fields
  - `assignedToId`: User the chore is assigned to (optional)
  - `completedById`: User who actually completed the chore (tracked for point awards)
  - **Point Award System**: Points are awarded to the user who completes the chore (`completedById`), not necessarily the assigned user
  - **Recurring Chore Reset**: Recurring chores automatically reset to pending status when their `nextDueDate` arrives
- **Rewards**: Configurable rewards with costs, availability, and metadata
- **Transactions**: Comprehensive audit trail for all point earning and spending activities
- **Push Subscriptions**: Browser push notification endpoints for real-time alerts
- **Schema Validation**: Drizzle-Zod integration for type-safe database operations

## Authentication & Security
- **Session-based Authentication**: Express sessions with secure cookie configuration
- **Input Validation**: Zod schemas for both client and server-side validation
- **Type Safety**: End-to-end TypeScript with shared schema definitions
- **CSRF Protection**: Built-in protection via same-origin policy and session validation

## Push Notification System
- **Web Push API**: Browser push notifications using service workers and VAPID authentication
- **Notification Types**: Chore completion alerts (to admins), chore approval confirmations (to users), reward claim notifications (to admins), and new message alerts
- **Subscription Management**: Automatic subscription on login with graceful degradation if permissions denied
- **Cleanup Strategy**: Stale push subscriptions (HTTP 410) automatically removed when sending fails
- **Security**: VAPID keys (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY) required for authentication
- **User Experience**: Non-intrusive permission requests with 1-second delay after login
- **Foreground Handling**: Service worker detects when app is visible and ensures notifications still display (critical for Android PWAs where foreground notifications can be suppressed)

## Chore Completion Workflow
- **Flexible Completion**: Any user can complete any chore regardless of assignment
- **Approval Process**: Completed chores require admin approval before points are awarded
- **Point Distribution**: Points are awarded to the user who completed the chore, tracked via `completedById` field
- **Notifications**: Admins notified when chores are completed; completers notified on approval/rejection
- **Recurring Chores**: Automatically reset to pending status and clear completion data when due date arrives
- **Reset Logic**: GET /api/chores automatically checks and resets overdue recurring chores before returning results
- **Timezone Handling**: Completion date validation allows dates within 24 hours of server time to accommodate users in all timezones (Railway servers run in UTC)

## Development Workflow
- **Hot Reloading**: Vite dev server with Express API proxy
- **Database Migrations**: Drizzle Kit for schema management and database updates
- **Error Handling**: Runtime error overlay in development with proper error boundaries
- **Build Process**: Separate client and server builds with optimized production bundles

## Deployment Architecture
- **Development Environment**: Hosted on Replit with Neon PostgreSQL database
- **Production Environment**: Hosted on Railway with standard PostgreSQL database
- **Database Driver Selection**: Automatic detection based on connection string
  - Neon databases: Uses `@neondatabase/serverless` with WebSocket support
  - Standard PostgreSQL (Railway): Uses `pg` with traditional connection pooling
- **Manual Migrations on Railway**: Database schema changes are applied via direct SQL execution when deploying new features that require table modifications

## Performance Optimizations
- **Database Prewarming**: Server prewarms database connection on startup to avoid cold start delays
- **Keep-alive Pings**: Server pings database every 4 minutes to prevent idle connection timeouts
- **Shared Connection Pool**: Session store reuses the main database pool for faster connections
- **Route-level Code Splitting**: Pages are lazy-loaded using React.lazy() to reduce initial bundle size

## Railway Keep-Alive for Push Notifications
Railway's free/basic tier scales containers to zero when idle. This means:
- **Push notifications won't work when container is sleeping** - There's no server to send them
- **First request after idle will be slow** - Container must cold-boot

**Solutions:**
1. **External Keep-alive (Free)**: Use a free service like UptimeRobot (uptimerobot.com) or cron-job.org to ping `/health` every 5 minutes
2. **Railway Always-On ($)**: Upgrade to Railway's paid plan with Always-On enabled
3. **Accept delays**: If notifications aren't critical, accept that they'll only work when server is awake

# Image Upload System

## Storage Backend Selection
The app automatically detects the deployment environment and selects the appropriate storage backend:

- **Replit Environment**: Uses Replit's built-in object storage (Google Cloud Storage with automatic authentication)
- **Railway/Other Platforms**: Uses Cloudinary when configured, falls back gracefully with error messages if not configured

## Environment Detection Logic
- Checks for Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
- If Cloudinary is configured OR if not running on Replit → uses Cloudinary
- If Replit object storage is available → uses Replit storage
- Provides clear error messages if neither is configured

## Upload Security
- **Cloudinary**: Server-generated signed uploads with timestamp-based signatures
- **Replit Storage**: Server-generated signed URLs for direct uploads
- No client-side API key exposure in either case

## Frontend Upload Flow
1. Client requests upload parameters from backend
2. Backend returns different data based on storage type:
   - Cloudinary: POST endpoint with signature and parameters
   - Replit: PUT endpoint with signed URL
3. ObjectUploader component handles both flows transparently
4. Upload completion extracts the image URL from provider-specific response

## Supported Upload Types
- **Avatar Images**: User profile pictures (5MB limit)
- **Message Images**: Image attachments in messages (10MB limit)

## Cloudinary Configuration
Required for Railway deployment (documented in CLOUDINARY_SETUP.md):
- Free tier: 25GB storage, 25GB bandwidth/month
- Automatic image optimization and WebP conversion
- Folder organization: `avatars/{userId}/` and `messages/`

# Yahtzee Game System

## Game Mechanics
- **Full Yahtzee Implementation**: Complete 13-category scorecard following classic Yahtzee rules
- **Interactive Dice Rolling**: Players can hold/release individual dice across up to 3 rolls per turn
- **Automatic Game Flow**: Games start with first roll already completed, automatic re-roll after scoring categories
- **State Synchronization**: Frontend heldDice state syncs with backend after every roll and score operation

## Scoring System
- **13 Categories**: Upper section (ones through sixes), lower section (3-of-kind, 4-of-kind, full house, small straight, large straight, Yahtzee, chance)
- **Upper Section Bonus**: 35 bonus points awarded when upper section total ≥63 points
- **Yahtzee Bonus**: 100 points awarded for each additional Yahtzee scored after the first (tracked separately in scorecard)
- **ChoreRewards Points Integration**:
  - **Non-admin wins**: 1 base point + 1 point per 10-point victory margin
  - **Admin wins**: No points awarded
  - **Non-admin losses**: Punishment assigned (no points)
  - **Admin losses**: No points awarded

## Technical Implementation
- **Database Schema**: `yahtzeeGames` table stores game state (dice, held dice, scorecard, yahtzee bonus count, final score)
- **Backend Logic**: `server/yahtzee.ts` contains all scoring algorithms and game state transitions
- **Input Validation**: Zod schemas validate all API requests (roll dice, score category)
- **Transaction Tracking**: Points awarded from Yahtzee games are recorded in transactions with type "yahtzee_win"

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver for database connectivity
- **drizzle-orm**: Type-safe ORM with schema-first approach
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight routing library for React applications
- **zod**: Schema validation for type-safe data handling

## UI & Styling Dependencies
- **@radix-ui/***: Comprehensive set of unstyled, accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe variant API for component styling
- **lucide-react**: Modern icon library with consistent design

## Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Static type checking and enhanced developer experience
- **drizzle-kit**: Database schema management and migration tools
- **eslint & prettier**: Code formatting and linting (implied by project structure)

## Third-party Integrations
- **Replit-specific plugins**: Development banner, cartographer, and runtime error modal for Replit environment
- **connect-pg-simple**: PostgreSQL session store for Express sessions
- **date-fns**: Modern date utility library for time formatting and manipulation
- **Cloudinary**: Cloud image storage and optimization service (Railway deployment)
  - **cloudinary**: Official Node.js SDK for server-side operations
  - **multer**: Middleware for handling multipart/form-data uploads