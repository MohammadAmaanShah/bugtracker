import BugForm from "../components/BugForm.jsx";

export default function ReportBugPage({ userName, onCreated }) {
  return (
    <div className="report-page">
      <BugForm userName={userName} onCreated={onCreated} />
    </div>
  );
}
