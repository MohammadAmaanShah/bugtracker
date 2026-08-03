import { useEffect, useState } from "react";
import {
  getToken,
  setToken,
  fetchMe,
  fetchBugs,
  fetchPendingUserCount,
} from "./api.js";
import AuthPage from "./components/AuthPage.jsx";
import BugsPage from "./pages/BugsPage.jsx";
import ReportBugPage from "./pages/ReportBugPage.jsx";
import ActivityPage from "./pages/ActivityPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

const PAGES = [
  { key: "bugs", label: "Bugs" },
  { key: "report", label: "Report Bug" },
  { key: "activity", label: "Activity" },
  { key: "admin", label: "Admin", adminOnly: true },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("bugs");
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

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
  }, [user]);

  async function loadBugs() {
    try {
      const data = await fetchBugs();
      setBugs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingCount() {
    if (user?.role !== "admin") return;
    try {
      const data = await fetchPendingUserCount();
      setPendingCount(data.count ?? 0);
    } catch {
      setPendingCount(0);
    }
  }

  useEffect(() => {
    if (user?.role !== "admin") {
      setPendingCount(0);
      return;
    }
    loadPendingCount();
    const id = setInterval(loadPendingCount, 30000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (user?.role === "admin" && page === "admin") loadPendingCount();
  }, [page, user]);

  function handleCreated(bug) {
    setBugs((prev) => [bug, ...prev]);
  }

  function handleAuthenticated({ token, user: nextUser }) {
    if (token) setToken(token);
    setUser(nextUser);
    setPage("bugs");
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
            Hi {user.name || user.username}, your username is verified. An admin needs to approve
            your account before you can use the app.
          </p>
          <button type="button" className="btn-primary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  const visiblePages = PAGES.filter(
    (p) => !p.adminOnly || user.role === "admin"
  );

  return (
    <div className="page">
      <header className="header">
        <div className="topbar">
          <h1>Bug Tracker</h1>
          <div className="user-chip">
            <span className="user-name">{user.name || user.username}</span>
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
        <nav className="page-nav">
          {visiblePages.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`nav-link ${page === p.key ? "active" : ""}`}
              onClick={() => setPage(p.key)}
            >
              {p.label}
              {p.key === "admin" && pendingCount > 0 && (
                <span className="nav-badge" title={`${pendingCount} pending signup${pendingCount === 1 ? "" : "s"}`}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {page === "bugs" && (
          <BugsPage
            bugs={bugs}
            setBugs={setBugs}
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
            userName={user.name || user.username}
            isAdmin={user.role === "admin"}
          />
        )}
        {page === "report" && (
          <ReportBugPage
            userName={user.name || user.username}
            isAdmin={user.role === "admin"}
            onCreated={handleCreated}
          />
        )}
        {page === "activity" && <ActivityPage isAdmin={user.role === "admin"} />}
        {page === "admin" && user.role === "admin" && (
          <AdminPage currentUserId={user.id} onUsersChanged={loadPendingCount} />
        )}
      </main>
    </div>
  );
}
