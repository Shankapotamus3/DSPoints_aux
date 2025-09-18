# Overview

ChoreRewards is a gamified task management application that helps users stay motivated by earning points for completing chores and spending those points on rewards. Built with React (frontend) and Express (backend), the application features a modern UI using shadcn/ui components, real-time progress tracking, and a points-based reward system. Users can create and manage chores, set custom rewards, and track their transaction history in an engaging, game-like interface.

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
- **Chores**: Task management with completion tracking, point values, and timestamps
- **Rewards**: Configurable rewards with costs, availability, and metadata
- **Transactions**: Comprehensive audit trail for all point earning and spending activities
- **Schema Validation**: Drizzle-Zod integration for type-safe database operations

## Authentication & Security
- **Session-based Authentication**: Express sessions with secure cookie configuration
- **Input Validation**: Zod schemas for both client and server-side validation
- **Type Safety**: End-to-end TypeScript with shared schema definitions
- **CSRF Protection**: Built-in protection via same-origin policy and session validation

## Development Workflow
- **Hot Reloading**: Vite dev server with Express API proxy
- **Database Migrations**: Drizzle Kit for schema management and database updates
- **Error Handling**: Runtime error overlay in development with proper error boundaries
- **Build Process**: Separate client and server builds with optimized production bundles

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