export const FAQ_ITEMS = [
  {
    q: 'How long does setup take?',
    a: 'Most teams are live the same day. You sign up with Clerk, configure the workspace, import customers from CSV if needed, connect Stripe when payments are ready, and tune the AI context around your real business data.',
  },
  {
    q: 'Can I keep my existing sales process?',
    a: 'Yes. The CRM stages, lead context, outreach records, estimate defaults, and AI guardrails can be adapted around your current workflow instead of forcing a generic sales pipeline.',
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
    q: 'Can I bring my own brand and business context?',
    a: 'On Pro and Scale, yes. Your workspace can use brand-specific labels, company details, content guidelines, and AI guardrails so generated work matches the account instead of a generic template.',
  },
  {
    q: "What happens if the AI doesn't have enough information?",
    a: 'It should say what is missing instead of inventing facts. The assistant is guided to use CRM records, knowledge items, growth records, and explicit guardrails before making recommendations.',
  },
  {
    q: 'Do you handle SMS opt-out for me?',
    a: 'Yes. The inbound SMS webhook processes STOP / START / UNSUBSCRIBE keywords automatically and records the consent state per customer. All outbound SMS respects that state.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export a full JSON dump of every customer, lead, invoice, estimate, payment, and attachment at any time. GDPR/CCPA privacy endpoints are built in for individual customer requests too.',
  },
] as const;
