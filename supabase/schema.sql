-- WNY Automation Portal Database Schema
-- Canonical schema for the current application surface.

create extension if not exists "uuid-ossp";

-- Companies using the platform
create table if not exists companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  email text unique not null,
  phone text,
  address text,
  stripe_customer_id text,
  subscription_tier text default 'free',
  subscription_status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Team members / plumbers
create table if not exists plumbers (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  name text not null,
  email text unique not null,
  phone text,
  role text default 'plumber',
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Customers
create table if not exists customers (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  name text not null,
  email text,
  phone text not null,
  address text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Lead pipeline buckets used by the CRM board
create table if not exists buckets (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  color text default '#6b7280',
  position integer not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Leads / opportunities
create table if not exists leads (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete set null,
  plumber_id uuid references plumbers(id) on delete set null,
  source text not null,
  status text default 'new',
  priority integer default 3,
  issue text not null,
  description text,
  location text,
  ai_qualification jsonb,
  ai_score integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Jobs / work orders
create table if not exists jobs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  lead_id uuid references leads(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  plumber_id uuid references plumbers(id) on delete set null,
  status text default 'scheduled',
  type text not null,
  description text,
  scheduled_date date,
  scheduled_time time,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  estimated_price decimal(10,2),
  final_price decimal(10,2),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Invoices
create table if not exists invoices (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  invoice_number text unique not null,
  service_type text,
  status text default 'pending',
  amount decimal(10,2) not null,
  tax decimal(10,2) default 0,
  total decimal(10,2) not null,
  issue_date date not null,
  due_date date,
  paid_date date,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Call logs for receptionist / call tracking
create table if not exists call_logs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  customer_name text,
  phone_number text not null,
  duration_seconds integer default 0,
  status text default 'completed',
  transcript text,
  ai_summary text,
  outcome text,
  recording boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_customers_company_id on customers(company_id);
create index if not exists idx_leads_company_id on leads(company_id);
create index if not exists idx_leads_customer_id on leads(customer_id);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_jobs_company_id on jobs(company_id);
create index if not exists idx_jobs_customer_id on jobs(customer_id);
create index if not exists idx_jobs_lead_id on jobs(lead_id);
create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_invoices_company_id on invoices(company_id);
create index if not exists idx_invoices_customer_id on invoices(customer_id);
create index if not exists idx_invoices_job_id on invoices(job_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_call_logs_company_id on call_logs(company_id);
create index if not exists idx_call_logs_customer_id on call_logs(customer_id);
create index if not exists idx_call_logs_status on call_logs(status);
create index if not exists idx_call_logs_created_at on call_logs(created_at);

alter table companies enable row level security;
alter table plumbers enable row level security;
alter table customers enable row level security;
alter table buckets enable row level security;
alter table leads enable row level security;
alter table jobs enable row level security;
alter table invoices enable row level security;
alter table call_logs enable row level security;

insert into buckets (title, color, position)
values
  ('New Leads', '#3b82f6', 1),
  ('Qualified', '#8b5cf6', 2),
  ('Quoted', '#eab308', 3),
  ('Booked', '#f97316', 4),
  ('In Progress', '#f59e0b', 5),
  ('Completed', '#22c55e', 6)
on conflict (position) do update
set
  title = excluded.title,
  color = excluded.color,
  updated_at = timezone('utc'::text, now());
