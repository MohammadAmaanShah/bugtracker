# Bug Tracker

Full-stack bug display app: report bugs with **title**, **in role**, **description**, and **screenshot**.

Features:
- Search by title / role / description
- Filter by status (in progress / fixed)
- Edit bugs (including screenshot replacement/removal)
- Status changes record **who** made them
- Full edit history on each card (field, old → new value, editor, timestamp)
- Activity log tracks **who** created, updated the status of, or deleted each bug
- "Reported by" is chosen from the list of verified (admin-approved) users
- Login / signup uses a **username** (no phone number)
- Separate pages: Bugs, Report Bug, Activity, and Admin (user verification)

- Frontend: React (Vite)
- Backend: Node + Express
- Database: MongoDB (Mongoose)
- Colors taken from [nuhaos.com](https://nuhaos.com) (cream `#f4eedf`, green `#37472f`, gold `#a86c0c`, brown `#3a2a06`)

## Setup

### 1. Backend

```bash
cd backend
npm install
```

Add your MongoDB connection key:

1. Open `backend/.env`
2. Replace `MONGODB_URI` with your connection string, e.g.
   `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/bugtracker`

Run it:

```bash
npm run dev
```

API runs on `http://localhost:5001`

- `GET /api/bugs` — list bugs (`?q=` search, `?status=` filter)
- `POST /api/bugs` — create a bug (multipart form: `title`, `role`, `description`, `reportedBy`, optional `screenshot`)
- `PUT /api/bugs/:id` — edit a bug (multipart; pass `editedBy` to record who changed it; pass `removeScreenshot=true` to delete the image)
- `DELETE /api/bugs/:id` — delete a bug
- `GET /api/actions` — activity log (who created / changed status of / deleted bugs)
- `GET /api/users/verified` — verified (approved) users for the "Reported by" dropdown
- `/uploads` — serves uploaded screenshots

Auth endpoints:

- `POST /api/auth/signup` — `{ name, username, password }`
- `POST /api/auth/login` — `{ username, password }`
- `GET /api/auth/me` — current user

Admin endpoints:

- `GET /api/admin/users` — list users
- `PATCH /api/admin/users/:id` — approve / change role

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

The Vite dev server proxies `/api` and `/uploads` to the backend, so no extra config is needed.
