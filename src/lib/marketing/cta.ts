/** Sales contact for mailto links (marketing + pricing). */
export function getSalesEmail(): string {
  return process.env.NEXT_PUBLIC_SALES_EMAIL?.trim() || 'sales@plumber.os';
}

export function getSalesMailto(): string {
  return `mailto:${getSalesEmail()}`;
}

/** Optional Calendly / HubSpot / etc. When unset, use mailto for “Book a demo”. */
export function getDemoBookingUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_DEMO_BOOKING_URL?.trim();
  return u || undefined;
}

export function getDemoOrSalesHref(): string {
  return getDemoBookingUrl() ?? getSalesMailto();
}
