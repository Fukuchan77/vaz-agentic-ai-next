-- Req 6.6 / 7.1 / 7.5: add approval_state enum and job_step table.
-- Backs per-step approval tracking and observed usage accumulation.
-- Foreign key cascades on job deletion. No extra index added since composite PK
-- (job_id, step_id) backs both sum(total_tokens) and conditional state updates.
CREATE TYPE "approval_state" AS ENUM ('pending', 'consumed');

CREATE TABLE "job_step" (
	"job_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"approval_state" approval_state,
	"consumed_at" timestamp with time zone,
	"total_tokens" integer NOT NULL DEFAULT 0,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "job_step_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE cascade,
	CONSTRAINT "job_step_job_id_step_id_pk" PRIMARY KEY ("job_id","step_id")
);
