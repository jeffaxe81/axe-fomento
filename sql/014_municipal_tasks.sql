-- AF-020: secretarias, integrantes autorizados e tarefas de candidatura.
-- Sem equipes globais ou acesso a projetos de outros municípios.
CREATE TABLE public.municipal_secretariats(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 3 AND 120),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id),
 UNIQUE(municipality_id,name),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id)
);

CREATE TABLE public.municipal_secretariat_members(
 municipality_id uuid NOT NULL,
 secretariat_id uuid NOT NULL,
 user_id uuid NOT NULL,
 granted_by uuid NOT NULL,
 granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz,
 PRIMARY KEY(municipality_id,secretariat_id,user_id),
 FOREIGN KEY(secretariat_id,municipality_id)
  REFERENCES public.municipal_secretariats(id,municipality_id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(granted_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_secretariat_members_active
 ON public.municipal_secretariat_members(municipality_id,user_id,secretariat_id)
 WHERE revoked_at IS NULL;

CREATE TABLE public.municipal_tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 secretariat_id uuid NOT NULL,
 assigned_to uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 5 AND 180),
 details text NOT NULL DEFAULT '' CHECK(length(details)<=1200),
 status text NOT NULL DEFAULT 'pendente'
  CHECK(status IN ('pendente','em_andamento','concluida','cancelada')),
 due_on date NOT NULL CHECK(due_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 10000),
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,municipality_id,project_id),
 FOREIGN KEY(project_id,municipality_id)
   REFERENCES public.projects(id,municipality_id) ON DELETE CASCADE,
 FOREIGN KEY(secretariat_id,municipality_id)
   REFERENCES public.municipal_secretariats(id,municipality_id),
 FOREIGN KEY(municipality_id,secretariat_id,assigned_to)
   REFERENCES public.municipal_secretariat_members(municipality_id,secretariat_id,user_id),
 FOREIGN KEY(created_by,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(updated_by,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_tasks_tenant_due
 ON public.municipal_tasks(municipality_id,due_on,project_id);
CREATE INDEX idx_tasks_tenant_assignee
 ON public.municipal_tasks(municipality_id,assigned_to,status,due_on);

CREATE TABLE public.municipal_task_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 project_id uuid NOT NULL,
 task_id uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('created','transferred','status_changed','deadline_changed')),
 previous_assignee uuid,
 next_assignee uuid,
 previous_status text,
 next_status text,
 previous_due_on date,
 next_due_on date,
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 10 AND 500),
 revision integer NOT NULL CHECK(revision>=1),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(task_id,revision),
 FOREIGN KEY(task_id,municipality_id,project_id)
  REFERENCES public.municipal_tasks(id,municipality_id,project_id) ON DELETE CASCADE,
 FOREIGN KEY(actor_id,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(previous_assignee,municipality_id) REFERENCES public.users(id,municipality_id),
 FOREIGN KEY(next_assignee,municipality_id) REFERENCES public.users(id,municipality_id)
);
CREATE INDEX idx_task_events_tenant
 ON public.municipal_task_events(municipality_id,project_id,task_id,revision DESC);

CREATE TABLE public.municipal_secretariat_member_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 municipality_id uuid NOT NULL,
 secretariat_id uuid NOT NULL,
 user_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('granted','revoked')),
 actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(municipality_id,secretariat_id,user_id)
  REFERENCES public.municipal_secretariat_members(municipality_id,secretariat_id,user_id),
 FOREIGN KEY(actor_id,municipality_id) REFERENCES public.users(id,municipality_id)
);

ALTER TABLE public.municipal_secretariats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_secretariats FORCE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_secretariat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_secretariat_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_task_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_secretariat_member_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_secretariat_member_events FORCE ROW LEVEL SECURITY;

CREATE POLICY secretariats_tenant ON public.municipal_secretariats
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND created_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY secretariat_members_tenant ON public.municipal_secretariat_members
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND granted_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY municipal_tasks_tenant ON public.municipal_tasks
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND updated_by=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY task_events_tenant ON public.municipal_task_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY member_events_tenant ON public.municipal_secretariat_member_events
 USING(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(municipality_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid
  AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid);
