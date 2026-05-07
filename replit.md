# Team Task Manager

A collaborative team task management web application where users can create projects, assign tasks, track progress, and manage teams with role-based access control.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/task-manager run dev` — run the frontend (Vite dev server)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth (auto-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter routing, TanStack Query, shadcn/ui, Tailwind CSS
- Auth: Clerk (Replit-managed)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema: `lib/db/src/schema/` (users.ts, projects.ts, tasks.ts)
- API contract: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/generated/api.ts`
- Generated Zod schemas: `lib/api-zod/src/generated/api.ts`
- API routes: `artifacts/api-server/src/routes/` (users, projects, tasks, dashboard)
- Frontend pages: `artifacts/task-manager/src/pages/`
- Auth middleware: `artifacts/api-server/src/lib/auth.ts`

## Architecture decisions

- Clerk auth with proxy pattern (`/api/__clerk`) so both dev and prod use the same auth flow
- User auto-sync: first `/users/me` call creates DB user from Clerk session data
- Role-based access: project admins manage members/tasks; members can only update assigned tasks
- All dashboard stats computed server-side to avoid N+1 queries
- OpenAPI-first: spec in `lib/api-spec/openapi.yaml` gates all client code generation

## Product

- Users sign up/in via Clerk (email+password, social OAuth)
- Create projects (become admin), invite members by user ID
- Create tasks with title, description, due date, priority, and assignee
- Task statuses: To Do, In Progress, Done
- Dashboard shows total tasks, tasks by status (chart), tasks per user, overdue tasks
- Admins manage tasks and members; members update only their assigned tasks

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, always run codegen: `pnpm --filter @workspace/api-spec run codegen`
- After codegen, delete stale generated files if orval config changed modes (see `lib/api-zod/src/index.ts`)
- The `orval.config.ts` zod output uses `mode: "single"` with no workspace to avoid barrel conflicts
- `requireAuth` + `syncUser` middleware chain auto-creates DB user from Clerk session on first API call
- Production schema changes are handled automatically by Replit's Publish flow — never write manual migration scripts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `clerk-auth` skill for auth setup and customization
