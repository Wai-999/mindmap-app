# Mindmap

A fast, keyboard-driven mindmapping app: infinite canvas, auto-layout, autosave, and shareable
links. Built full-stack with Next.js.

> Status: actively being built. This README is filled in incrementally as each part of the app
> lands; see the "Roadmap" section for what's done.

## Tech stack

- **Framework**: Next.js 15 (App Router, TypeScript) — React frontend + API routes as the backend
- **Canvas**: [`@xyflow/react`](https://reactflow.dev) (React Flow) for the node/edge graph
- **Layout**: `d3-hierarchy` for tree and radial auto-layout
- **UI**: Tailwind CSS v4 + shadcn/ui (Radix primitives) + `lucide-react`
- **State**: Zustand (editor store + undo/redo history store)
- **Database**: Prisma ORM, SQLite locally, PostgreSQL-ready for production
- **Auth**: Auth.js (NextAuth v5), credentials login, JWT sessions
- **Testing**: Vitest (unit) + Playwright (e2e)

## Getting started

```bash
npm install
cp .env.example .env      # then fill in NEXTAUTH_SECRET (openssl rand -base64 32)
npx prisma migrate dev    # creates the local SQLite database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                            | Purpose                          |
| --------------------------------- | -------------------------------- |
| `npm run dev`                     | Start the dev server (Turbopack) |
| `npm run build`                   | Production build                 |
| `npm run start`                   | Run the production build         |
| `npm run lint`                    | ESLint                           |
| `npm run typecheck`               | TypeScript, no emit              |
| `npm run format` / `format:check` | Prettier                         |

(Database and test scripts are documented here once those phases land.)

## Roadmap

- [x] Phase 0 — Scaffold & tooling
- [ ] Phase 1 — Database & auth
- [ ] Phase 2 — Core canvas editing
- [ ] Phase 3 — Toolbar, keyboard shortcuts, undo/redo, auto-layout
- [ ] Phase 4 — Sharing & dashboard
- [ ] Phase 5 — Import/export
- [ ] Phase 6 — Polish (dark mode, animations, responsive)
- [ ] Phase 7 — Tests
- [ ] Phase 8 — Deployment artifacts & docs
