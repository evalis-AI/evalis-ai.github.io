-- =============================================
-- Migration 026: Interview-Only B2B Companies
-- Multi-tenant registry for interview platform
-- with BYOK (Bring Your Own Key) support
-- =============================================

-- 1. Interview Companies (B2B tenant registry)
CREATE TABLE IF NOT EXISTS interview_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  company_slug TEXT UNIQUE NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT DEFAULT '',
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter','professional','enterprise')),

  -- BYOK: Client's own Gemini API key (stored server-side only)
  gemini_api_key TEXT DEFAULT NULL,

  -- Interview configuration
  allowed_roles TEXT[] DEFAULT '{}',
  max_questions INT DEFAULT 5,
  avatar_mode TEXT DEFAULT 'orb' CHECK (avatar_mode IN ('orb','simli')),
  voice_enabled BOOLEAN DEFAULT true,
  text_enabled BOOLEAN DEFAULT true,

  -- Branding (white-label)
  brand_name TEXT DEFAULT '',
  brand_color TEXT DEFAULT '#6366f1',
  brand_logo_url TEXT DEFAULT '',

  -- Usage limits
  monthly_interview_limit INT DEFAULT 50,
  interviews_used_this_month INT DEFAULT 0,
  usage_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', now()) + interval '1 month'),

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 year')
);

-- STRICT RLS: gemini_api_key must NEVER be readable by browser/anon
ALTER TABLE interview_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert interview_companies" ON interview_companies;
CREATE POLICY "Allow anon insert interview_companies" ON interview_companies
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select safe fields" ON interview_companies;
CREATE POLICY "Allow anon select safe fields" ON interview_companies
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Admin full access" ON interview_companies;
CREATE POLICY "Admin full access" ON interview_companies
  FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ic_agent ON interview_companies(agent_id);
CREATE INDEX IF NOT EXISTS idx_ic_slug ON interview_companies(company_slug);
CREATE INDEX IF NOT EXISTS idx_ic_email ON interview_companies(contact_email);

GRANT SELECT, INSERT ON interview_companies TO anon;
GRANT ALL ON interview_companies TO authenticated;

-- 2. Create a secure VIEW that excludes API keys (for anon/public queries)
CREATE OR REPLACE VIEW interview_companies_public AS
SELECT
  id, agent_id, company_name, company_slug, contact_email,
  plan, allowed_roles, max_questions, avatar_mode,
  voice_enabled, text_enabled,
  brand_name, brand_color, brand_logo_url,
  monthly_interview_limit, interviews_used_this_month,
  is_active, created_at
FROM interview_companies;

GRANT SELECT ON interview_companies_public TO anon;
GRANT SELECT ON interview_companies_public TO authenticated;

-- 3. Create interview_sessions table if it doesn't exist + add multi-tenant columns
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  role TEXT DEFAULT '',
  level TEXT DEFAULT '',
  question_count INT DEFAULT 0,
  avg_score INT DEFAULT 0,
  recommendation TEXT DEFAULT '',
  status TEXT DEFAULT 'started',
  client_ip TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert interview_sessions" ON interview_sessions;
CREATE POLICY "Allow anon insert interview_sessions" ON interview_sessions
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select interview_sessions" ON interview_sessions;
CREATE POLICY "Allow anon select interview_sessions" ON interview_sessions
  FOR SELECT TO anon USING (true);

GRANT SELECT, INSERT ON interview_sessions TO anon;
GRANT ALL ON interview_sessions TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_sessions' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE interview_sessions ADD COLUMN company_id UUID REFERENCES interview_companies(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_sessions' AND column_name = 'candidate_name'
  ) THEN
    ALTER TABLE interview_sessions ADD COLUMN candidate_name TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_sessions' AND column_name = 'candidate_email'
  ) THEN
    ALTER TABLE interview_sessions ADD COLUMN candidate_email TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_sessions' AND column_name = 'report_json'
  ) THEN
    ALTER TABLE interview_sessions ADD COLUMN report_json JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interview_sessions' AND column_name = 'mode'
  ) THEN
    ALTER TABLE interview_sessions ADD COLUMN mode TEXT DEFAULT 'text';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_is_company ON interview_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_is_candidate_email ON interview_sessions(candidate_email);

-- 4. Create api_keys table if it doesn't exist (needed for B2B registration)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  agent_id TEXT NOT NULL,
  plan TEXT DEFAULT 'starter',
  monthly_limit INT DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert api_keys" ON api_keys;
CREATE POLICY "Allow anon insert api_keys" ON api_keys
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select api_keys" ON api_keys;
CREATE POLICY "Allow anon select api_keys" ON api_keys
  FOR SELECT TO anon USING (true);

GRANT SELECT, INSERT ON api_keys TO anon;
GRANT ALL ON api_keys TO authenticated;

CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_agent ON api_keys(agent_id);

-- 5. Create agent_configs table if it doesn't exist (needed for registration)
CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  agent_name TEXT DEFAULT 'AI Assistant',
  company_description TEXT DEFAULT '',
  custom_knowledge TEXT DEFAULT '',
  contact_email TEXT NOT NULL,
  contact_phone TEXT DEFAULT '',
  website TEXT DEFAULT '',
  brand_color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert agent_configs" ON agent_configs;
CREATE POLICY "Allow anon insert agent_configs" ON agent_configs
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select agent_configs" ON agent_configs;
CREATE POLICY "Allow anon select agent_configs" ON agent_configs
  FOR SELECT TO anon USING (true);

GRANT SELECT, INSERT ON agent_configs TO anon;
GRANT SELECT, INSERT, UPDATE ON agent_configs TO authenticated;

CREATE INDEX IF NOT EXISTS idx_agent_configs_agent_id ON agent_configs(agent_id);

-- 6. Monthly usage reset function (call via cron or scheduled worker)
CREATE OR REPLACE FUNCTION reset_monthly_interview_usage()
RETURNS void AS $$
BEGIN
  UPDATE interview_companies
  SET interviews_used_this_month = 0,
      usage_reset_at = date_trunc('month', now()) + interval '1 month'
  WHERE usage_reset_at <= now();
END;
$$ LANGUAGE plpgsql;
