-- Deterministic seed (safe to re-run)
INSERT INTO companies (id, name, email, phone, address)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Adirondack White Pine Cabins',
  'awpcabins@gmail.com',
  '+1 (518) 891-1444',
  '18 Plumb Creek Lane, Saranac Lake, New York 12983'
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  address = excluded.address,
  updated_at = datetime('now');

INSERT INTO buckets (company_id, title, color, position) VALUES
  ('00000000-0000-4000-8000-000000000001', 'New Lead', '#2563eb', 1),
  ('00000000-0000-4000-8000-000000000001', 'Contacted', '#0ea5e9', 2),
  ('00000000-0000-4000-8000-000000000001', 'Qualified', '#16a34a', 3),
  ('00000000-0000-4000-8000-000000000001', 'Planning Call Scheduled', '#7c3aed', 4),
  ('00000000-0000-4000-8000-000000000001', 'Site Details Needed', '#d97706', 5),
  ('00000000-0000-4000-8000-000000000001', 'Design / Layout Discussion', '#db2777', 6),
  ('00000000-0000-4000-8000-000000000001', 'Estimate Needed', '#ea580c', 7),
  ('00000000-0000-4000-8000-000000000001', 'Proposal Sent', '#ca8a04', 8),
  ('00000000-0000-4000-8000-000000000001', 'Follow-Up Needed', '#dc2626', 9),
  ('00000000-0000-4000-8000-000000000001', 'Won', '#15803d', 10),
  ('00000000-0000-4000-8000-000000000001', 'Lost', '#64748b', 11),
  ('00000000-0000-4000-8000-000000000001', 'Nurture', '#475569', 12)
ON CONFLICT(company_id, position) DO UPDATE SET
  title = excluded.title,
  color = excluded.color,
  updated_at = datetime('now');

INSERT INTO customers (id, company_id, name, email, phone, address, notes)
VALUES (
  'c0000001-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'John Miller',
  'john.miller.demo@example.com',
  '(518) 555-0101',
  'Lake Placid, NY',
  'Demo AWP cabin lead'
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  address = excluded.address,
  notes = excluded.notes,
  updated_at = datetime('now');

INSERT INTO leads (
  id,
  company_id,
  customer_id,
  source,
  status,
  priority,
  issue,
  description,
  location,
  ai_qualification,
  ai_score,
  lead_context_json,
  next_follow_up_at,
  estimated_value_cents
)
VALUES (
  'e0000001-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'c0000001-0000-4000-8000-000000000001',
  'website_form',
  'new_lead',
  2,
  'Second home cabin near Lake Placid',
  'Demo lead interested in a four-season second home near Lake Placid.',
  'Lake Placid, NY',
  'High-fit demo buyer. Confirm land, site access, utilities, layout goals, and timeline.',
  78,
  '{"leadType":"Homeowner","ownsLand":"Yes","hasSiteAccess":"Unknown","utilitiesAvailable":"Unknown","intendedUse":"Second Home","estimatedBudget":"$300k-$400k","timeline":"6-12 months","cabinInterestLevel":"High","notes":"Demo data. Replace with real inquiry details before outreach.","assignedOwner":"AWP Sales","aiSummary":"Likely high-fit buyer researching a second home in a priority Adirondack location.","demoData":true,"demoKey":"john-miller-lake-placid"}',
  datetime('now', '+2 days'),
  32500000
)
ON CONFLICT(id) DO UPDATE SET
  source = excluded.source,
  status = excluded.status,
  priority = excluded.priority,
  issue = excluded.issue,
  description = excluded.description,
  location = excluded.location,
  ai_qualification = excluded.ai_qualification,
  ai_score = excluded.ai_score,
  lead_context_json = excluded.lead_context_json,
  next_follow_up_at = excluded.next_follow_up_at,
  estimated_value_cents = excluded.estimated_value_cents,
  updated_at = datetime('now');
