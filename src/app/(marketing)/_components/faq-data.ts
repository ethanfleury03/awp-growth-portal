export const FAQ_ITEMS = [
  {
    q: 'How long does setup take?',
    a: 'Most shops are live in under 20 minutes. You sign up with Clerk, connect Stripe, import customers from CSV (optional), and forward your main business line to the AI receptionist number. We stay on-call during your first week.',
  },
  {
    q: 'Do I have to replace my existing phone number?',
    a: "No. You can forward your existing Twilio, RingCentral, or cell number to WNY Automation Portal. Customers keep calling the number they already know; the AI just answers when your front desk can't.",
  },
  {
    q: 'What payment processors do you support?',
    a: "Stripe Connect is native — destination charges, deposits, refunds, disputes, ACH, Apple Pay, and 2-day payouts. We do not mark up payment processing; Stripe's published rates apply.",
  },
  {
    q: 'Is my customer data really isolated between tenants?',
    a: 'Yes. Every query is scoped by `company_id` at the application layer, and Postgres Row-Level Security enforces the same boundary at the database layer. An internal guard test fails CI if anyone writes an unscoped tenant query.',
  },
  {
    q: 'Can I bring my own voice / brand for the receptionist?',
    a: 'On Pro and Scale, yes. We clone your greeting, tune the voice, and swap in your brand name + hours. Demo mode lets you hear the AI before you forward a single call.',
  },
  {
    q: "What happens if the AI receptionist doesn't understand the caller?",
    a: 'It escalates. Based on rules you configure, the call transfers to your on-call rotation, drops a voicemail into your lead inbox, or texts the customer a booking link. You always see the full transcript.',
  },
  {
    q: 'Do you handle SMS opt-out for me?',
    a: 'Yes. The inbound SMS webhook processes STOP / START / UNSUBSCRIBE keywords automatically and records the consent state per customer. All outbound SMS respects that state.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export a full JSON dump of every customer, job, invoice, estimate, payment, and attachment at any time. GDPR/CCPA privacy endpoints are built in for individual customer requests too.',
  },
] as const;
