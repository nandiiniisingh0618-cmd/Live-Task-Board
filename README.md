# 📋 Live Task Board

A **real-time Kanban board** with a premium off-white scrapbook aesthetic.  
Built as full-stack interview prep covering every skill on modern internship JDs.

![Angular](https://img.shields.io/badge/Angular-17-red?logo=angular)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3-brightgreen?logo=spring)
![WebSockets](https://img.shields.io/badge/WebSockets-STOMP-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)

---

## ✨ Features

- **Real-time sync** — drag a card in one tab, it moves instantly in every other open tab (WebSocket / STOMP, no polling)
- **Kanban board** — To Do / In Progress / Done columns with CDK drag-and-drop
- **Scrapbook UI** — off-white lined-paper columns, pastel sticky notes, tape strips, polaroid stats card, handwriting fonts
- **REST API** — full CRUD + reorder endpoint
- **WebSocket broadcast** — every mutation pushes a `TaskEvent` to `/topic/tasks`
- **Vintage toast notifications** — slide-in label tickets for CREATE / UPDATE / DELETE / REORDER events
- **Docker-ready** — multi-stage Dockerfile + docker-compose for one-command local setup

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Spring Boot 3.3, Java 17, Spring Data JPA |
| WebSocket | STOMP over WebSocket (`spring-boot-starter-websocket`) |
| Database (dev) | H2 in-memory |
| Database (prod) | PostgreSQL 16 |
| Frontend | Angular 17 (Standalone API) |
| WS Client | `@stomp/stompjs` |
| Drag & Drop | `@angular/cdk` DragDropModule |
| Animations | `@angular/animations` |
| Containerisation | Docker multi-stage build, docker-compose |
| Frontend hosting | Vercel |
| Backend hosting | Railway |

---

## 🚀 Running Locally

### Option A — No Docker

**Terminal 1 — Backend (H2 in-memory, starts instantly):**
```bash
cd backend
./mvnw spring-boot:run        # Windows: .\mvnw.cmd spring-boot:run
# → http://localhost:8080
# → H2 console: http://localhost:8080/h2-console  (JDBC: jdbc:h2:mem:taskdb)
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm start
# → http://localhost:4200
```

### Option B — Docker (requires Docker Desktop)

```bash
# 1. Build Angular production bundle
cd frontend && npm install && npm run build && cd ..

# 2. Start everything
docker compose up --build
# → Frontend: http://localhost:4200
# → Backend:  http://localhost:8080
# → DB:       PostgreSQL on port 5432
```

---

## 🌐 Deploying

### Frontend → Vercel (automatic)
1. Import this repo on [vercel.com](https://vercel.com)
2. Vercel reads `vercel.json` automatically — no extra config needed
3. Set environment variable in Vercel dashboard:
   - (optional) update `frontend/src/environments/environment.prod.ts` with your backend URL

### Backend → Railway
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select this repo, set **Root Directory** to `backend`
3. Railway auto-detects Maven and builds with `./mvnw package`
4. Add a PostgreSQL plugin — Railway injects `DATABASE_URL` automatically
5. Set these env vars in Railway:
   ```
   SPRING_PROFILES_ACTIVE=prod
   DB_HOST=<railway-postgres-host>
   DB_PORT=5432
   DB_NAME=railway
   DB_USER=postgres
   DB_PASSWORD=<railway-postgres-password>
   ```
6. Copy the public Railway URL and paste into `frontend/src/environments/environment.prod.ts`:
   ```ts
   apiUrl: 'https://YOUR_RAILWAY_APP.up.railway.app',
   wsUrl:  'wss://YOUR_RAILWAY_APP.up.railway.app/ws'
   ```
7. Redeploy on Vercel

---

## 📁 Project Structure

```
live-task-board/
├── backend/                          ← Spring Boot
│   ├── src/main/java/com/example/taskboard/
│   │   ├── config/WebSocketConfig.java
│   │   ├── controller/TaskController.java
│   │   ├── model/Task.java
│   │   └── repository/TaskRepository.java
│   ├── src/main/resources/
│   │   ├── application.properties         (H2 dev)
│   │   └── application-prod.properties    (PostgreSQL prod)
│   └── Dockerfile
│
├── frontend/                         ← Angular 17
│   └── src/app/
│       ├── services/task.service.ts
│       ├── app.component.ts
│       ├── app.component.html
│       ├── app.component.css
│       └── environments/
│           ├── environment.ts             (dev → localhost)
│           └── environment.prod.ts        (prod → Railway URL)
│
├── vercel.json                       ← Vercel SPA config
├── docker-compose.yml
└── nginx.conf
```

---

## 🎯 Interview Talking Points

- **WebSockets vs Polling** — `SimpMessagingTemplate.convertAndSend("/topic/tasks", event)` pushes to all subscribers instantly; the client never asks, the server tells.
- **Docker multi-stage build** — JDK for compiling, JRE-only for running. Halves image size. Non-root user for security hardening.
- **Spring profiles** — `application.properties` (H2) vs `application-prod.properties` (PostgreSQL), switched via `SPRING_PROFILES_ACTIVE` env var.
- **Angular CDK drag-drop** — `cdkDropListGroup` + `cdkDropList` + `cdkDrag`; on drop fires `PUT /api/tasks/reorder` which broadcasts a `REORDER` event to all clients.
- **Conventional commits** — structured commit messages (`feat:`, `chore:`, `fix:`) make the history readable and grep-able.
