import BugForm from "../components/BugForm.jsx";

export default function ReportBugPage({ userName, isAdmin, onCreated }) {
  return (
    <div className="report-page">
      <BugForm userName={userName} isAdmin={isAdmin} onCreated={onCreated} />
    </div>
  );
}
