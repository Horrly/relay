# Relay

**Real-time chat rooms built with Django Channels, Redis and React.**

![CI](https://github.com/Horrly/relay/actions/workflows/ci.yml/badge.svg)

Relay is a Slack-style chat app: create rooms, invite yourself in, and talk to everyone in the room instantly. Messages are delivered over WebSockets and saved to PostgreSQL, so history is there when you come back.

![Relay screenshot](docs/screenshot.png)

<!-- Replace with your real URL once deployed:
**Live demo:** https://relay-xxxx.onrender.com — log in with `demo` / `Demo-pass-123`
(Free hosting: the first load after a quiet period can take up to a minute while the server wakes up.)
-->

## Features

- **Real-time messaging** over WebSockets (Django Channels), fanned out through a Redis channel layer
- **JWT authentication** for both the REST API and WebSocket connections
- **Chat rooms**: create, browse and switch between rooms
- **Typing indicators** and **join/leave notices**
- **Message history** with cursor-based pagination ("Load older messages")
- **Auto-reconnect** with exponential backoff, plus catching up on messages missed while offline
- **Responsive UI** built with React 18 and Tailwind CSS v4
- **Tested**: 28 backend tests (REST, WebSocket and deployment) and frontend unit tests, run on every push by GitHub Actions
- **One-command setup** with Docker Compose (Postgres + Redis + backend + frontend)

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Django 5.2, Django REST Framework, Django Channels, Daphne (ASGI) |
| Real-time | WebSockets, Redis channel layer |
| Auth | JWT (djangorestframework-simplejwt) |
| Database | PostgreSQL (SQLite for quick local runs) |
| Frontend | React 18, React Router, Vite, Tailwind CSS v4 |
| Testing | pytest, pytest-django, pytest-asyncio, Vitest |
| DevOps | Docker, Docker Compose, GitHub Actions |

## Architecture

```mermaid
flowchart LR
    B1[Browser A] -- "REST /api" --> V[Vite dev server / proxy]
    B2[Browser B] -- "WebSocket /ws" --> V
    V --> D[Daphne ASGI server]
    D --> DRF[Django REST Framework<br/>auth, rooms, history]
    D --> C[Channels ChatConsumer<br/>one per connection]
    DRF --> PG[(PostgreSQL)]
    C --> PG
    C <-- "group_send" --> R[(Redis channel layer)]
```

When a user sends a message, their `ChatConsumer` saves it to Postgres and calls `group_send` on the room's group. Redis delivers that event to every consumer in the group — even across multiple server processes — and each one pushes it down its own WebSocket.

### WebSocket protocol

Connect to `ws://<host>/ws/rooms/<slug>/?token=<access JWT>`.

| Direction | Event |
|---|---|
| client → server | `{"type": "message", "content": "hello"}` |
| client → server | `{"type": "typing", "is_typing": true}` |
| server → client | `{"type": "message", "message": {"id", "author", "content", "created_at"}}` |
| server → client | `{"type": "typing", "user": "ada", "is_typing": true}` |
| server → client | `{"type": "presence", "user": "ada", "action": "joined"}` |
| server → client | `{"type": "error", "detail": "..."}` |

Close codes: `4401` unauthenticated, `4404` room not found.

### REST API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register/` | Create an account |
| POST | `/api/auth/login/` | Get access + refresh tokens |
| POST | `/api/auth/refresh/` | Refresh the access token |
| GET | `/api/auth/me/` | Current user |
| GET / POST | `/api/rooms/` | List / create rooms |
| GET | `/api/rooms/<slug>/` | Room details |
| GET | `/api/rooms/<slug>/messages/?before=<id>` | Message history (50 per page) |

## Getting started

### Option 1: Docker (recommended)

```bash
docker compose up --build
```

Open http://localhost:5173, create an account, and open a second browser (or an incognito window) with another account to chat between them.

### Option 2: Run locally

Needs Python 3.11+ and Node 20+. Without `REDIS_URL` the app uses an in-memory channel layer, which is fine for a single dev server.

**Backend** (Git Bash on Windows):

```bash
cd backend
python -m venv venv
source venv/Scripts/activate      # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Frontend** (new terminal):

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

## Running tests

```bash
cd backend && pytest        # REST + WebSocket tests
cd frontend && npm test     # unit tests
```

## Deployment

Relay runs on [Render](https://render.com) (web service + Key Value/Redis, both free) with [Neon](https://neon.com) for Postgres. In production, Django serves the built React app through WhiteNoise, so the site, the API and the WebSockets all share one origin — no CORS setup needed.

The whole setup is described in [`render.yaml`](render.yaml):

- **Build:** [`build.sh`](build.sh) builds the React app, installs Python packages and collects static files.
- **Start:** runs migrations, seeds the demo account and rooms (`python manage.py seed_demo`), then starts Daphne.
- **Health check:** `GET /api/health/` confirms the app and database are up.

To deploy your own copy: create a Neon project and copy its connection string, then in Render choose **New → Blueprint**, pick this repo, and paste the connection string when asked for `DATABASE_URL`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | dev key | Django secret key — **required when `DEBUG=False`** |
| `DEBUG` | `True` | Set to `False` in production |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated hostnames (Render's hostname is added automatically) |
| `DATABASE_URL` | SQLite | e.g. `postgres://user:pass@host:5432/db` |
| `REDIS_URL` | in-memory layer | e.g. `redis://localhost:6379/0` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Frontend origin(s) for local dev |
| `DEMO_USERNAME` / `DEMO_PASSWORD` | `demo` / `Demo-pass-123` | Demo account created by `seed_demo` |

## Roadmap

- [ ] Online-users list per room (Redis sets)
- [ ] Private / invite-only rooms and direct messages
- [ ] Read receipts and unread counts
- [ ] Message editing, deleting and reactions
- [ ] File and image uploads
- [ ] Rate limiting on message sends
- [ ] Playwright end-to-end tests in CI
- [x] Production deploy on Render with a demo account

## Author

**Toheeb Olatunde** — Computer Science, Obafemi Awolowo University
GitHub: [@Horrly](https://github.com/Horrly)
