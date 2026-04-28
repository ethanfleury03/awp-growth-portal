-- Deterministic seed (safe to re-run)
INSERT OR IGNORE INTO companies (id, name, email, phone, address)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Demo Plumbing Co.',
  'demo@plumberos.com',
  '(555) 010-0000',
  '123 Main St, Brooklyn, NY'
);

INSERT INTO buckets (id, title, color, position) VALUES
  ('b0000001-0000-4000-8000-000000000001', 'New Leads', '#3b82f6', 1),
  ('b0000002-0000-4000-8000-000000000002', 'Qualified', '#8b5cf6', 2),
  ('b0000003-0000-4000-8000-000000000003', 'Quoted', '#eab308', 3),
  ('b0000004-0000-4000-8000-000000000004', 'Booked', '#f97316', 4),
  ('b0000005-0000-4000-8000-000000000005', 'In Progress', '#f59e0b', 5),
  ('b0000006-0000-4000-8000-000000000006', 'Completed', '#22c55e', 6)
ON CONFLICT(position) DO UPDATE SET
  title = excluded.title,
  color = excluded.color,
  updated_at = datetime('now');

INSERT OR IGNORE INTO customers (id, company_id, name, email, phone, address)
VALUES (
  'c0000001-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Sample Customer',
  'customer@example.com',
  '(555) 010-1000',
  '456 Oak Ave, Queens, NY'
);

INSERT OR IGNORE INTO leads (id, company_id, customer_id, source, status, priority, issue, description, location)
VALUES (
  'e0000001-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'c0000001-0000-4000-8000-000000000001',
  'website',
  'new',
  2,
  'Leaking kitchen faucet',
  'Steady drip under sink; needs same-day if possible.',
  '456 Oak Ave, Queens, NY'
);
