import { useEffect, useRef, useState } from "react";
import { fetchBugs, getToken, setToken, fetchMe } from "./api.js";
import AuthPage from "./components/AuthPage.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";
import BugForm from "./components/BugForm.jsx";
import BugCard from "./components/BugCard.jsx";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
  { value: "closed", label: "Closed" },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const searchTimer = useRef(null);

  useEffect(() => {
    async function restore() {
      if (!getToken()) {
        setAuthLoading(false);
        return;
      }
      try {
        const me = await fetchMe();
        setUser(me);
      } catch {
        setToken("");
      } finally {
        setAuthLoading(false);
      }
    }
    restore();
  }, []);

  useEffect(() => {
    if (user?.isApproved) loadBugs();
  }, [statusFilter, user]);

  function handleSearch(value) {
    setQ(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadBugs({ q: value, status: statusFilter });
    }, 250);
  }

  function handleStatusFilter(value) {
    setStatusFilter(value);
    loadBugs({ q, status: value });
  }

  async function loadBugs(overrides = {}) {
    try {
      const data = await fetchBugs({
        q: overrides.q ?? q,
        status: overrides.status ?? statusFilter,
      });
      setBugs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCreated(bug) {
    setBugs((prev) => [bug, ...prev]);
  }

  function handleUpdated(updated) {
    setBugs((prev) =>
      prev.map((b) => (b._id === updated._id ? updated : b))
    );
  }

  function handleDeleted(id) {
    setBugs((prev) => prev.filter((b) => b._id !== id));
  }

  function handleAuthenticated({ token, user: nextUser }) {
    if (token) setToken(token);
    setUser(nextUser);
  }

  function handleLogout() {
    setToken("");
    setUser(null);
    setBugs([]);
  }

  if (authLoading) {
    return (
      <div className="page">
        <p className="muted center">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <AuthPage onAuthenticated={handleAuthenticated} />
      </div>
    );
  }

  if (!user.isApproved) {
    return (
      <div className="page">
        <header className="header">
          <h1>Bug Tracker</h1>
          <p>Report, review, and track bugs with screenshots</p>
        </header>
        <div className="card pending-page">
          <h2>Awaiting admin approval</h2>
          <p>
            Hi {user.name}, your phone number is verified. An admin needs to
            approve your account before you can use the app.
          </p>
          <button type="button" className="btn-primary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <div className="topbar">
          <h1>Bug Tracker</h1>
          <div className="user-chip">
            <span className="user-name">{user.name}</span>
            <span
              className={`badge ${
                user.role === "admin" ? "badge-admin" : "badge-user"
              }`}
            >
              {user.role}
            </span>
            <button type="button" className="btn-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
        <p>Report, review, and track bugs with screenshots</p>
      </header>

      {user.role === "admin" && (
        <AdminDashboard currentUserId={user.id} />
      )}

      <main className="layout">
        <aside>
          <BugForm userName={user.name} onCreated={handleCreated} />
        </aside>

        <section>
          <div className="toolbar">
            <input
              type="search"
              className="search-input"
              placeholder="Search by title, role, or description..."
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <div className="status-filters">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`filter-chip ${
                    statusFilter === f.value ? "active" : ""
                  }`}
                  onClick={() => handleStatusFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <h2 className="section-title">
            Reported bugs <span className="count">{bugs.length}</span>
          </h2>

          {loading && <p className="muted">Loading bugs...</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && bugs.length === 0 && (
            <p className="muted">No bugs found.</p>
          )}

          <div className="bug-list">
            {bugs.map((bug) => (
              <BugCard
                key={bug._id}
                bug={bug}
                userName={user.name}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
