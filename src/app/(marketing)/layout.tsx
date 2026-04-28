import { redirect } from 'next/navigation';

export default function PortalRootRedirect() {
  redirect('/sign-in');
}
