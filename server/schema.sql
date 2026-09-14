BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS workspaces(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
CREATE TABLE IF NOT EXISTS users(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 name text NOT NULL, email text NOT NULL, UNIQUE(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS workspace_members(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 user_id uuid NOT NULL, role text NOT NULL CHECK(role IN ('manager','representative','viewer')),
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,role),
 FOREIGN KEY(workspace_id,user_id) REFERENCES users(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS sessions(
 token_hash text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 member_id uuid NOT NULL, csrf_token text NOT NULL, expires_at timestamptz NOT NULL,
 FOREIGN KEY(workspace_id,member_id) REFERENCES workspace_members(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS pipeline_stages(
 workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 key text NOT NULL CHECK(key IN ('new','qualified','proposal','negotiation','won','lost')),
 label text NOT NULL, position integer NOT NULL, terminal boolean NOT NULL DEFAULT false,
 PRIMARY KEY(workspace_id,key)
);
CREATE TABLE IF NOT EXISTS companies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 120), website text NOT NULL DEFAULT '', industry text NOT NULL DEFAULT '',
 size text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 owner_id uuid NOT NULL, archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,owner_id) REFERENCES workspace_members(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS contacts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 120), email text NOT NULL, phone text NOT NULL DEFAULT '', job_title text NOT NULL DEFAULT '',
 company_id uuid, owner_id uuid NOT NULL, status text NOT NULL DEFAULT 'lead' CHECK(status IN ('lead','active','customer')),
 source text NOT NULL DEFAULT 'Website', notes text NOT NULL DEFAULT '', archived boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,company_id) REFERENCES companies(workspace_id,id),
 FOREIGN KEY(workspace_id,owner_id) REFERENCES workspace_members(workspace_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_active_email ON contacts(workspace_id,lower(email)) WHERE NOT archived;
CREATE TABLE IF NOT EXISTS deals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 title text NOT NULL CHECK(length(title) BETWEEN 2 AND 150), company_id uuid NOT NULL, contact_id uuid, owner_id uuid NOT NULL,
 value numeric(12,2) NOT NULL CHECK(value>=0 AND value<=100000000), currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 stage text NOT NULL DEFAULT 'new', priority text NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
 expected_close date NOT NULL, closed_at timestamptz, lost_reason text, next_action text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 archived boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,company_id) REFERENCES companies(workspace_id,id),
 FOREIGN KEY(workspace_id,contact_id) REFERENCES contacts(workspace_id,id),
 FOREIGN KEY(workspace_id,owner_id) REFERENCES workspace_members(workspace_id,id),
 FOREIGN KEY(workspace_id,stage) REFERENCES pipeline_stages(workspace_id,key),
 CHECK((stage IN ('won','lost'))=(closed_at IS NOT NULL)),
 CHECK(stage<>'lost' OR length(trim(lost_reason))>=3)
);
CREATE TABLE IF NOT EXISTS tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 title text NOT NULL CHECK(length(title) BETWEEN 2 AND 150), due_at timestamptz NOT NULL, owner_id uuid NOT NULL,
 company_id uuid, contact_id uuid, deal_id uuid,
 priority text NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','completed')), completed_at timestamptz,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,owner_id) REFERENCES workspace_members(workspace_id,id),
 FOREIGN KEY(workspace_id,company_id) REFERENCES companies(workspace_id,id),
 FOREIGN KEY(workspace_id,contact_id) REFERENCES contacts(workspace_id,id),
 FOREIGN KEY(workspace_id,deal_id) REFERENCES deals(workspace_id,id),
 CHECK(num_nonnulls(company_id,contact_id,deal_id)<=1), CHECK((status='completed')=(completed_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS notes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 member_id uuid NOT NULL, company_id uuid, contact_id uuid, deal_id uuid,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,member_id) REFERENCES workspace_members(workspace_id,id),
 FOREIGN KEY(workspace_id,company_id) REFERENCES companies(workspace_id,id),
 FOREIGN KEY(workspace_id,contact_id) REFERENCES contacts(workspace_id,id),
 FOREIGN KEY(workspace_id,deal_id) REFERENCES deals(workspace_id,id), CHECK(num_nonnulls(company_id,contact_id,deal_id)=1)
);
CREATE TABLE IF NOT EXISTS activities(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 member_id uuid, kind text NOT NULL, entity_type text NOT NULL, entity_id uuid,
 company_id uuid, contact_id uuid, deal_id uuid, summary text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_workspace_order ON activities(workspace_id,id DESC);
CREATE INDEX IF NOT EXISTS tasks_workspace_due ON tasks(workspace_id,due_at);
CREATE INDEX IF NOT EXISTS deals_workspace_stage ON deals(workspace_id,stage);
CREATE TABLE IF NOT EXISTS automation_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
 activity_id bigint NOT NULL UNIQUE REFERENCES activities ON DELETE CASCADE,
 deal_id uuid NOT NULL, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','delivered','failed','uncertain')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz,
 delivered_at timestamptz, receipt text, claim_token text, error_code text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,deal_id) REFERENCES deals(workspace_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','workspace_members','companies','contacts','deals','tasks','notes','activities','automation_events','pipeline_stages'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename=t AND policyname='workspace_scope') THEN
   EXECUTE format('CREATE POLICY workspace_scope ON %I USING (workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid) WITH CHECK (workspace_id=nullif(current_setting(''app.workspace_id'',true),'''')::uuid)',t);
  END IF;
 END LOOP;
END $$;
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
COMMIT;
