import { redirect } from 'next/navigation';

export default function WebsiteGrowthRedirectPage() {
  redirect('/marketing?tab=seo');
}
