-- =============================================
-- Migration 024: New B2B AI Service Tables
-- Tables for: WhatsApp chats, Agent configs,
-- Document jobs, Leads pipeline
-- =============================================

-- 1. WhatsApp Chat Logs
CREATE TABLE IF NOT EXISTS wa_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_from TEXT NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT,
  client_id TEXT DEFAULT 'evalis',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert wa_chats" ON wa_chats
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select wa_chats" ON wa_chats
  FOR SELECT TO anon USING (true);

CREATE INDEX idx_wa_chats_client ON wa_chats(client_id);
CREATE INDEX idx_wa_chats_created ON wa_chats(created_at DESC);

GRANT SELECT, INSERT ON wa_chats TO anon;
GRANT SELECT, INSERT ON wa_chats TO authenticated;

-- 2. White-Label Agent Configurations
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
CREATE POLICY "Allow anon insert agent_configs" ON agent_configs
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select agent_configs" ON agent_configs
  FOR SELECT TO anon USING (true);

CREATE INDEX idx_agent_configs_agent_id ON agent_configs(agent_id);

GRANT SELECT, INSERT ON agent_configs TO anon;
GRANT SELECT, INSERT, UPDATE ON agent_configs TO authenticated;

-- 3. Document Processing Jobs
CREATE TABLE IF NOT EXISTS document_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_type TEXT DEFAULT 'general',
  input_length INT DEFAULT 0,
  status TEXT DEFAULT 'pending',
  client_ip TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert document_jobs" ON document_jobs
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select document_jobs" ON document_jobs
  FOR SELECT TO anon USING (true);

GRANT SELECT, INSERT ON document_jobs TO anon;
GRANT SELECT, INSERT ON document_jobs TO authenticated;

-- 4. Leads Pipeline
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT DEFAULT '',
  website TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  ai_score TEXT DEFAULT '',
  status TEXT DEFAULT 'new',
  source TEXT DEFAULT 'manual',
  deal_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert leads" ON leads
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select leads" ON leads
  FOR SELECT TO anon USING (true);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created ON leads(created_at DESC);

GRANT SELECT, INSERT ON leads TO anon;
GRANT ALL ON leads TO authenticated;

-- 5. Add agent_id column to ai_chats (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_chats' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE ai_chats ADD COLUMN agent_id TEXT DEFAULT 'eva-default';
  END IF;
END $$;
