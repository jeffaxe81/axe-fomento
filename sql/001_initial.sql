CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  uf char(2) NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  ibge_code varchar(7),
  population integer CHECK (population >= 0),
  priority_areas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, uf)
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  provider text NOT NULL,
  source_url text,
  deadline date,
  areas text[] NOT NULL DEFAULT '{}',
  eligible_ufs char(2)[] NOT NULL DEFAULT '{}',
  min_population integer,
  max_population integer,
  funding_amount numeric(16, 2),
  is_example boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT population_range CHECK (min_population IS NULL OR max_population IS NULL OR min_population <= max_population)
);
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES municipalities(id) ON DELETE RESTRICT,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'preparacao', 'submetido', 'aprovado', 'recusado')),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_municipality ON projects (municipality_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities (deadline);
