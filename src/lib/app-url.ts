export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function buildEntryUrl(token: string) {
  return `${getAppUrl()}/entry/${token}`;
}