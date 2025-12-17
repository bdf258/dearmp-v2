# DearMP v2

A comprehensive case management and email handling system designed for UK Members of Parliament (MPs) and their office staff. DearMP helps manage constituent casework, policy correspondence, and coordinated campaigns with AI-powered email classification and batch triage capabilities.

## Features

- **Casework Management** - Track and manage individual constituent assistance requests (housing, benefits, immigration, etc.)
- **Policy Email Handling** - Process legislative correspondence with AI-powered classification
- **Campaign Management** - Handle coordinated campaign emails with bulk response capabilities
- **Constituent Database** - Maintain records of constituents and their interactions
- **AI Classification** - Automatic categorization of incoming emails using Google Gemini
- **Batch Triage** - Rapidly process large volumes of correspondence
- **Two-Factor Authentication** - TOTP authenticator app support for enhanced security
- **Real-time Updates** - Live notifications and status tracking via WebSocket

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Radix UI component library
- TipTap rich text editor

**Backend:**
- Supabase (PostgreSQL 15)
- Supabase Edge Functions
- Google Gemini API for AI features

**Deployment:**
- Docker with Nginx
- Traefik-ready configuration

## Prerequisites

- Node.js 20+
- npm 10+
- Docker and Docker Compose (for containerized deployment)
- Supabase CLI (for local development)
- Google Gemini API key (optional, for AI features)

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dearmp-v2

# Install dependencies
npm install
```

### Environment Setup

Create environment files with your configuration:

```bash
# Frontend environment (.env)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```bash
# Supabase edge functions (supabase/.env)
cp supabase/.env.example supabase/.env
# Edit with your GEMINI_API_KEY
```

### Local Development

```bash
# Start Supabase locally
npm run supabase:start

# Apply database migrations
npm run supabase:db:push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`.

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access at http://localhost:3000
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run supabase:start` | Start local Supabase instance |
| `npm run supabase:stop` | Stop local Supabase |
| `npm run supabase:db:push` | Apply database migrations |
| `npm run supabase:db:reset` | Reset database |
| `npm run supabase:functions:deploy` | Deploy edge functions |

## Project Structure

```
dearmp-v2/
├── src/
│   ├── components/       # React components
│   │   ├── mail/         # Email handling components
│   │   ├── settings/     # Settings components
│   │   ├── notes/        # Notes system
│   │   └── ui/           # Radix UI components
│   ├── pages/            # Page components
│   │   ├── casework/     # Casework management
│   │   ├── policy/       # Policy email handling
│   │   ├── office/       # Office management
│   │   └── mp/           # MP-specific pages
│   ├── lib/              # Utilities and hooks
│   └── data/             # Sample data
├── supabase/
│   ├── migrations/       # Database migrations
│   └── functions/        # Edge functions
├── public/               # Static assets
└── docker-compose.yml    # Docker configuration
```

## Security

DearMP v2 implements comprehensive security measures:

- Row-Level Security (RLS) in Supabase
- Content Security Policy (CSP) headers
- XSS protection with DOMPurify
- Two-factor authentication (TOTP)
- Secure session management with JWT

## Documentation

- [Outlook Integration](./OUTLOOK_INTEGRATION_SUMMARY.md) - Email sending implementation details
- [Technical Debt Analysis](./technical-debt-analysis.md) - Known issues and priorities

## License

Proprietary - All rights reserved.
