export function paymentsAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    'http://localhost:3003'
  ).replace(/\/$/, '');
}
