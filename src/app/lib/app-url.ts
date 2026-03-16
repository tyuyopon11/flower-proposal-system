export function getAppUrl() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    "http://localhost:3000";

  return appUrl.replace(/\/+$/, "");
}

export function buildEntryUrl(token: string) {
  return `${getAppUrl()}/entry/${token}`;
}