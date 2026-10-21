# D10. Python backend, React frontend, generated API client

Status: superseded by D34 (2026-10-21)
Decision: Backend: Python, FastAPI, Pydantic, Pydantic AI, SQLAlchemy 2 + Alembic, SQLite (WAL).
Frontend: React, TypeScript, Vite, Tailwind, shadcn/ui, dnd-kit, TanStack Query. The frontend's
API client is generated from FastAPI's OpenAPI schema.
Why: Reuses the tested Python core from the Discord prototype; the owner reviews Python
fluently; the generated client stops frontend and backend drifting apart, which matters when
AI agents write both halves.
Rejected: All-TypeScript (equally valid if the old code were thrown away); Next.js (long
agent runs fit poorly); HTMX (drag-and-drop and streaming get awkward).
Implemented in: `../architecture.md`.
