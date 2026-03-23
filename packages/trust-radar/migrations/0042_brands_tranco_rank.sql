ALTER TABLE brands ADD COLUMN tranco_rank INTEGER;
CREATE INDEX IF NOT EXISTS idx_brands_tranco ON brands(tranco_rank);
