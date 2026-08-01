import AdminDashboard from "../components/AdminDashboard.jsx";

export default function AdminPage({ currentUserId, onUsersChanged }) {
  return (
    <section>
      <AdminDashboard currentUserId={currentUserId} onUsersChanged={onUsersChanged} />
    </section>
  );
}
