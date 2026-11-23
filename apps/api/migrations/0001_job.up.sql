-- 001 job queue (data-model.md §2). Rows are claimed with FOR UPDATE SKIP LOCKED.
CREATE TABLE job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CONSTRAINT job_name_format CHECK (name ~ '^[a-z][a-z0-9_.]{0,63}$'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CONSTRAINT job_status_valid CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3 CONSTRAINT job_max_attempts_min CHECK (max_attempts >= 1),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  origin_traceparent text,
  trace_parent text,
  -- Pseudonymous staff ID only, same rule as RequestContext.staffId: never an email.
  staff_id text CONSTRAINT job_staff_id_format CHECK (staff_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX job_claimable_idx ON job (run_after, created_at) WHERE status IN ('queued', 'running');
