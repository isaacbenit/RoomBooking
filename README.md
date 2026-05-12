# Booking Solutions (Full‑Stack Meeting Room Booking)

Two-folder monorepo:
- `client/`: React + React Router + Axios + Tailwind CSS
- `server/`: Node.js + Express + PostgreSQL (`pg`) + JWT + bcrypt

## Setup the database on Supabase (step by step)

1. Create a Supabase project.
2. In Supabase, open **SQL Editor** → **New query**.
3. Copy/paste the entire contents of `server/database.sql` into the editor.
4. Click **Run**.
5. Verify seed rooms:
   - Go to **Table Editor** → `rooms`
   - You should see exactly:
     - **Business Class Room**
     - **Ground Floor Operations Room**
6. Get your connection string:
   - Go to **Project Settings** → **Database**
   - Copy the **Connection string** (URI format).

## Run locally

1. Create env files:
   - Copy `server/.env.example` → `server/.env`
   - Set:
     - `DATABASE_URL` to your Supabase Postgres connection string
     - `JWT_SECRET` to a long random string
   - Copy `client/.env.example` → `client/.env`
2. Install dependencies (root):

```bash
npm install
```

3. Start both backend + frontend (root):

```bash
npm start
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000` (health: `GET /api/health`)

## Deploy backend to Render

1. Push this repo to GitHub.
2. Create a new **Web Service** in Render.
3. Connect your GitHub repo.
4. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables in Render:
   - `DATABASE_URL`: your Supabase connection string
   - `JWT_SECRET`: long random string
   - `PORT`: `5000` (Render may override; the app respects `PORT`)
   - (Optional) `NODE_ENV`: `production`
6. Deploy.

## Deploy frontend to Vercel

1. Push this repo to GitHub.
2. Create a new Vercel project from the repo.
3. Configure:
   - **Root Directory**: `client`
   - **Framework**: Vite (auto-detected)
4. Add environment variables in Vercel:
   - `VITE_API_URL`: your Render backend URL (for example `https://your-service.onrender.com`)
5. Deploy.

## Notes / Behaviors

- **Auth**: JWT returned from login/register is stored in `localStorage`.
- **Admin cap**: only **5** Admin accounts may exist.
  - The register form automatically hides Admin once the cap is reached.
  - The server also enforces the cap and rejects Admin registration when full.
- **Conflict detection**: booking requests (and approvals) are rejected if they overlap an **approved** booking for the same room + date.
- **Room deletion**: deleting a room also deletes linked bookings (FK cascade).

