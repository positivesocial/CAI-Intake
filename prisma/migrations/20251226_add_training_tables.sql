-- Add Training Example and Parsing Accuracy Log tables
-- Run this migration manually if needed

-- Create training_examples table
CREATE TABLE IF NOT EXISTS "training_examples" (
    "id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_text" TEXT NOT NULL,
    "source_file_name" TEXT,
    "source_file_hash" TEXT,
    "correct_parts" JSONB NOT NULL,
    "correct_metadata" JSONB,
    "category" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "client_name" TEXT,
    "has_headers" BOOLEAN NOT NULL DEFAULT true,
    "column_count" INTEGER,
    "row_count" INTEGER,
    "has_edge_notation" BOOLEAN NOT NULL DEFAULT false,
    "has_groove_notation" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "organization_id" TEXT,

    CONSTRAINT "training_examples_pkey" PRIMARY KEY ("id")
);

-- Create parsing_accuracy_logs table
CREATE TABLE IF NOT EXISTS "parsing_accuracy_logs" (
    "id" TEXT NOT NULL,
    "parse_job_id" TEXT,
    "provider" TEXT NOT NULL,
    "source_type" TEXT,
    "total_parts" INTEGER NOT NULL,
    "correct_parts" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "dimension_accuracy" DOUBLE PRECISION,
    "material_accuracy" DOUBLE PRECISION,
    "edging_accuracy" DOUBLE PRECISION,
    "grooving_accuracy" DOUBLE PRECISION,
    "quantity_accuracy" DOUBLE PRECISION,
    "label_accuracy" DOUBLE PRECISION,
    "few_shot_examples_used" INTEGER NOT NULL DEFAULT 0,
    "patterns_applied" INTEGER NOT NULL DEFAULT 0,
    "client_template_used" BOOLEAN NOT NULL DEFAULT false,
    "document_difficulty" TEXT,
    "client_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT,

    CONSTRAINT "parsing_accuracy_logs_pkey" PRIMARY KEY ("id")
);

-- Add indexes for training_examples
CREATE INDEX IF NOT EXISTS "training_examples_organization_id_idx" ON "training_examples"("organization_id");
CREATE INDEX IF NOT EXISTS "training_examples_category_idx" ON "training_examples"("category");
CREATE INDEX IF NOT EXISTS "training_examples_client_name_idx" ON "training_examples"("client_name");
CREATE INDEX IF NOT EXISTS "training_examples_difficulty_idx" ON "training_examples"("difficulty");
CREATE INDEX IF NOT EXISTS "training_examples_source_file_hash_idx" ON "training_examples"("source_file_hash");
CREATE INDEX IF NOT EXISTS "training_examples_success_count_idx" ON "training_examples"("success_count" DESC);

-- Add indexes for parsing_accuracy_logs
CREATE INDEX IF NOT EXISTS "parsing_accuracy_logs_org_created_idx" ON "parsing_accuracy_logs"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "parsing_accuracy_logs_provider_idx" ON "parsing_accuracy_logs"("provider");
CREATE INDEX IF NOT EXISTS "parsing_accuracy_logs_accuracy_idx" ON "parsing_accuracy_logs"("accuracy");
CREATE INDEX IF NOT EXISTS "parsing_accuracy_logs_created_at_idx" ON "parsing_accuracy_logs"("created_at" DESC);

-- Add foreign key constraints
ALTER TABLE "training_examples" 
ADD CONSTRAINT "training_examples_organization_id_fkey" 
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parsing_accuracy_logs" 
ADD CONSTRAINT "parsing_accuracy_logs_organization_id_fkey" 
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

