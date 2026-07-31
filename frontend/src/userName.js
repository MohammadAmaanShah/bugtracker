const KEY = "bugtracker.userName";

export function getUserName() {
  return localStorage.getItem(KEY) || "";
}

export function setUserName(name) {
  localStorage.setItem(KEY, name);
}

export function getEditorName() {
  let name = getUserName();
  if (!name) {
    name = window.prompt("Enter your name to record who made this change:");
    if (name) setUserName(name.trim());
  }
  return (name || "").trim();
}
