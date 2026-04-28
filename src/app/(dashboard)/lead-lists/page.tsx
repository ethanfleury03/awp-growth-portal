import { redirect } from 'next/navigation';

export default function LeadListsRedirectPage() {
  redirect('/outreach?tab=lists');
}
