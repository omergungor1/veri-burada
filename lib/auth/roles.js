function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

export function isAdminEmail(email) {
  const value = normalizeEmail(email);
  if (!value) return false;
  return getAdminEmails().includes(value);
}

export function homePathForEmail(email) {
  return isAdminEmail(email) ? "/admin" : "/panel";
}
