# Bug Tracker

Full-stack bug display app: report bugs with **title**, **in role**, **description**, and **screenshot**.

Features:
- Search by title / role / description
- Filter by status (open / in progress / fixed / closed)
- Edit bugs (including screenshot replacement/removal)
- Status changes record **who** made them
- Full edit history on each card (field, old → new value, editor, timestamp)
- "Reported by" name is remembered in localStorage

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
- `POST /api/bugs` — create a bug (multipart form: `title`, `role`, `description`, optional `screenshot`, optional `reportedBy`)
- `PUT /api/bugs/:id` — edit a bug (multipart; pass `editedBy` to record who changed it; pass `removeScreenshot=true` to delete the image)
- `DELETE /api/bugs/:id` — delete a bug
- `/uploads` — serves uploaded screenshots

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

The Vite dev server proxies `/api` and `/uploads` to the backend, so no extra config is needed.
