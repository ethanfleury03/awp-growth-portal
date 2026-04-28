import { redirect } from 'next/navigation';

export default function CrmRedirectPage() {
  redirect('/leads?view=pipeline');
}
