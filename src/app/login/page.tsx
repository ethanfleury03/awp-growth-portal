import { redirect } from 'next/navigation';

type LoginSearchParams = Record<string, string | string[] | undefined>;

function toQueryString(sp: LoginSearchParams): string {
  const u = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) u.append(key, v);
    } else {
      u.set(key, value);
    }
  }
  return u.toString();
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const sp = await searchParams;
  const q = toQueryString(sp);
  redirect(q ? `/sign-in?${q}` : '/sign-in');
}
