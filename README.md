# Mindmap

A fast, keyboard-driven mindmapping app: infinite canvas, auto-layout, autosave, and shareable
links. Built full-stack with Next.js.

## Features

- Infinite pan/zoom canvas with inline node editing, per-node color, and collapse/expand
- A mindmap can hold several independent primary ideas (a forest of trees), not just one central
  topic — press `Enter` on a primary idea to add another, or use the toolbar's "Add primary idea"
- Keyboard-first editing: `Tab` add child · `Enter` add sibling (or a new primary idea, on a root) ·
  `Delete`/`Backspace` remove subtree · `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z` undo/redo ·
  `Cmd/Ctrl+D` duplicate subtree · `Cmd/Ctrl+S` force-save
- One-click Tidy Up auto-layout (tree or radial), powered by `d3-hierarchy`
- Debounced autosave with optimistic-concurrency conflict detection (never silently overwrites
  someone else's newer edit)
- Shareable links with `VIEW` or `EDIT` permission, no login required to open one
- Optional real-time collaboration (see below) — live co-editing on top of a share link or your own
  account, when the deployment has Liveblocks configured
- Dashboard with thumbnails, rename, duplicate, delete
- Export to PNG, JSON, and Markdown; import JSON or Markdown back in
- Dark mode

## Tech stack

- **Framework**: Next.js 15 (App Router, TypeScript) — React frontend + API routes as the backend
- **Canvas**: [`@xyflow/react`](https://reactflow.dev) (React Flow) for the node/edge graph
- **Layout**: `d3-hierarchy` for tree and radial auto-layout (forest-aware — lays out and separates
  multiple independent primary ideas in one canvas)
- **UI**: Tailwind CSS v4 + shadcn/ui (Radix primitives) + `lucide-react`
- **State**: Zustand (editor store + undo/redo history store)
- **Database**: Prisma ORM, SQLite locally, PostgreSQL-ready for production
- **Auth**: Auth.js (NextAuth v5), credentials login, JWT sessions
- **Real-time collaboration (optional)**: [Liveblocks](https://liveblocks.io) — the app's one
  external SaaS dependency, and entirely opt-in. Everything else in this app is self-hosted; leave
  `LIVEBLOCKS_SECRET_KEY` unset to run fully solo with zero collaboration UI
- **Testing**: Vitest (unit) + Playwright (e2e)

## Getting started

```bash
npm install
cp .env.example .env      # then fill in NEXTAUTH_SECRET (openssl rand -base64 32)
npx prisma migrate dev    # creates the local SQLite database
npm run db:seed           # optional — demo user: demo@example.com / password123
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To enable real-time collaboration, add `LIVEBLOCKS_SECRET_KEY` to `.env` (get one from
[liveblocks.io/dashboard/apikeys](https://liveblocks.io/dashboard/apikeys)) and restart the dev
server. Leaving it unset is fully supported — the app runs exactly as it does without it.

## Scripts

| Script               | Purpose                                        |
| -------------------- | ----------------------------------------------- |
| `npm run dev`         | Start the dev server (Turbopack)               |
| `npm run build`       | Production build                               |
| `npm run start`       | Run the production build                       |
| `npm run lint`        | ESLint                                         |
| `npm run typecheck`   | TypeScript, no emit                            |
| `npm run format` / `format:check` | Prettier                           |
| `npm run db:migrate`  | Create/apply a dev migration                   |
| `npm run db:push`     | Push the schema without a migration file       |
| `npm run db:seed`     | Seed the demo user + a starter mindmap         |
| `npm run db:studio`   | Prisma Studio (browse the database)            |
| `npm run db:reset`    | Drop, re-migrate, and re-seed the dev database |
| `npm run test`        | Vitest unit tests                              |
| `npm run test:watch`  | Vitest in watch mode                           |
| `npm run test:e2e`    | Playwright end-to-end tests                    |

## Testing

- **Unit** (Vitest): tree utilities (reparent/descendants/cascade-delete), undo/redo history
  semantics, tree + radial layout, Markdown round-tripping, and permission checks.
- **E2E** (Playwright): register → create a mindmap → add nodes via keyboard → reload → confirm
  persistence; create a share link and confirm `VIEW` vs `EDIT` behavior for a logged-out visitor.
  Each run gets its own throwaway SQLite database (`tests/e2e/.tmp/e2e.db`), so it never touches
  your dev data.

Not covered, deliberately: visual regression, load testing, a cross-browser matrix, and an
automated accessibility audit.

## Deploying

### Option A — Docker / VPS, keep SQLite

The `Dockerfile` builds a lean production image using Next's `output: "standalone"`. If you're
running on a single instance (no horizontal scaling) and don't need Postgres, you can keep SQLite:
mount a volume for the database file and point `DATABASE_URL` at it.

```bash
docker build -t mindmap .
docker run -p 3000:3000 \
  -e DATABASE_URL="file:/data/prod.db" \
  -e NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  -e NEXTAUTH_URL="https://your-domain.example" \
  -v mindmap-data:/data \
  mindmap
```

### Option B — Docker Compose with Postgres

`docker-compose.yml` runs the app alongside a Postgres container — do the schema swap below
first, then:

```bash
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" > .env
docker compose up --build -d
docker compose exec app npx prisma migrate deploy
```

### Option C — Vercel (or any platform without a persistent filesystem)

SQLite needs a writable, persistent disk, which platforms like Vercel don't provide — you must do
the Postgres swap below first. Point `DATABASE_URL` at a managed Postgres instance (Neon, Supabase,
Railway, RDS, etc.) and set `NEXTAUTH_SECRET` / `NEXTAUTH_URL` in the project's environment
variables.

### SQLite → PostgreSQL swap

The schema was written so this is a small, mechanical change — two fields (`Mindmap.content` and
`ShareLink.permission`) are deliberately plain `String` rather than Prisma's native `Json`/`enum`
types specifically so they behave identically on both databases, so nothing about those needs to
change.

1. In `prisma/schema.prisma`, change the datasource provider:
   ```diff
   datasource db {
   - provider = "sqlite"
   + provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Point `DATABASE_URL` at your Postgres instance, e.g.
   `postgresql://user:password@host:5432/dbname`.
3. The existing `prisma/migrations/` history was generated for SQLite and its SQL isn't
   Postgres-compatible, so replace it rather than trying to apply it:
   ```bash
   rm -rf prisma/migrations
   npx prisma migrate dev --name init   # against your new Postgres database
   ```
   (For a quick one-off environment with no migration history to maintain, `npx prisma db push`
   works too.)
4. Redeploy. No application code changes are required.

## Known limitations

- **Real-time collaboration is optional and off by default.** Without `LIVEBLOCKS_SECRET_KEY` set,
  sharing is link-based (view or edit) with no live multi-cursor editing — autosave's
  optimistic-concurrency check (`clientUpdatedAt` vs. the server's current `updatedAt`) prevents
  silently clobbering a newer save, surfacing a "reload to see the latest version" prompt on
  conflict instead of merging. With it configured, this is lifted for anyone in an active session.
- **Rate limiting is in-memory and per-process** (`src/lib/rate-limit.ts`), so it resets on
  restart and isn't shared across multiple instances. Fine for a single-instance deployment; swap
  in Redis (e.g. Upstash) before running more than one instance behind a load balancer. This also
  applies to the new `/api/liveblocks-auth` route, which Liveblocks itself doesn't fix — it's a
  newly anonymous-reachable endpoint (via share tokens) worth keeping in mind if you enable
  collaboration on a multi-instance deployment.
- **Thumbnails are inline base64**, capped in size, stored directly on the `Mindmap` row — there's
  no separate object storage. Fine at this scale; would need to move to blob storage (S3/R2) if
  thumbnails grow larger or the dataset gets large.

## Roadmap

- [x] Phase 0 — Scaffold & tooling
- [x] Phase 1 — Database & auth
- [x] Phase 2 — Core canvas editing
- [x] Phase 3 — Toolbar, keyboard shortcuts, undo/redo, auto-layout
- [x] Phase 4 — Sharing & dashboard
- [x] Phase 5 — Import/export
- [x] Phase 6 — Polish (dark mode, animations, responsive)
- [x] Phase 7 — Tests
- [x] Phase 8 — Deployment artifacts & docs
- [x] Phase 9 — Forest model (multiple primary ideas per mindmap)
- [x] Phase 10 — Liveblocks foundation (rooms, auth, opt-in switch)
- [ ] Phase 11 — Liveblocks storage sync + presence UI
- [ ] Phase 12 — Content richness (notes, tasks, attachments)
- [ ] Phase 13 — Views (presentation mode & outline view)
- [ ] Phase 14 — Export/import expansion (PDF, DOCX, PPTX)
- [ ] Phase 15 — Organization (folders, tags, search, version history)
