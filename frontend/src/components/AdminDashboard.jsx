import { useEffect, useState } from "react";
import { fetchUsers, updateUser } from "../api.js";

export default function AdminDashboard({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setApproved(user, value) {
    try {
      await updateUser(user._id, { approved: value });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function toggleRole(user) {
    try {
      await updateUser(user._id, {
        role: user.role === "admin" ? "user" : "admin",
      });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  const pendingCount = users.filter((u) => !u.isApproved).length;

  return (
    <section className="admin-section">
      <div className="admin-head">
        <h2>Admin dashboard</h2>
        <span className="muted">
          {pendingCount} pending · {users.length - pendingCount} approved
        </span>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading users...</p>}
      {!loading && users.length === 0 && <p className="muted">No users yet.</p>}

      <div className="user-list">
        {users.map((u) => {
          const isSelf =
            currentUserId && String(u._id) === String(currentUserId);
          return (
            <div className="user-row card" key={u._id}>
              <div className="user-main">
                <strong>{u.name}</strong>
                <span className="muted">{u.phone}</span>
                <span
                  className={`badge ${
                    u.role === "admin" ? "badge-admin" : "badge-user"
                  }`}
                >
                  {u.role}
                </span>
                {u.isApproved ? (
                  <span className="badge badge-ok">approved</span>
                ) : (
                  <span className="badge badge-warn">pending</span>
                )}
              </div>
              <div className="user-actions">
                <button
                  type="button"
                  disabled={isSelf}
                  className={`btn-mini ${u.isApproved ? "btn-revoke" : "btn-approve"}`}
                  onClick={() => setApproved(u, !u.isApproved)}
                >
                  {u.isApproved ? "Revoke" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={isSelf}
                  className="btn-mini"
                  onClick={() => toggleRole(u)}
                >
                  Make {u.role === "admin" ? "user" : "admin"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
