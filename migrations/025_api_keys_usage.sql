-- =============================================
-- Migration 025: Multi-Tenant API Keys & Usage
-- Tables for: API key auth, usage tracking,
-- per-client rate limiting & isolation
-- =============================================

-- 1. API Keys for B2B Clients
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agent_configs(agent_id),
  plan TEXT DEFAULT 'starter',
  monthly_limit INT DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 year')
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select api_keys" ON api_keys
  FOR SELECT TO anon USING (true);

CREATE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_keys_agent ON api_keys(agent_id);

GRANT SELECT ON api_keys TO anon;
GRANT ALL ON api_keys TO authenticated;

-- 2. Usage Logs (per-client metering)
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  endpoint TEXT DEFAULT '',
  tokens_used INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert usage_logs" ON usage_logs
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select usage_logs" ON usage_logs
  FOR SELECT TO anon USING (true);

CREATE INDEX idx_usage_logs_agent ON usage_logs(agent_id);
CREATE INDEX idx_usage_logs_created ON usage_logs(created_at DESC);

GRANT SELECT, INSERT ON usage_logs TO anon;
GRANT ALL ON usage_logs TO authenticated;

-- 3. Helper view: monthly usage per client
CREATE OR REPLACE VIEW client_monthly_usage AS
SELECT
  agent_id,
  date_trunc('month', created_at) AS month,
  COUNT(*) AS total_requests,
  SUM(tokens_used) AS total_tokens
FROM usage_logs
GROUP BY agent_id, date_trunc('month', created_at);

GRANT SELECT ON client_monthly_usage TO anon;
GRANT SELECT ON client_monthly_usage TO authenticated;
