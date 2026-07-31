import AdminDashboard from "../components/AdminDashboard.jsx";

export default function AdminPage({ currentUserId }) {
  return (
    <section>
      <AdminDashboard currentUserId={currentUserId} />
    </section>
  );
}
