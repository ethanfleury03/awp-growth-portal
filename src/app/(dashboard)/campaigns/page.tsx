import { redirect } from 'next/navigation';

export default function CampaignsRedirectPage() {
  redirect('/outreach?tab=campaigns');
}
