-- Add BIMI monitoring fields to brands table
ALTER TABLE brands ADD COLUMN bimi_record TEXT;
ALTER TABLE brands ADD COLUMN bimi_svg_url TEXT;
ALTER TABLE brands ADD COLUMN bimi_vmc_url TEXT;
ALTER TABLE brands ADD COLUMN bimi_vmc_valid INTEGER DEFAULT 0;
ALTER TABLE brands ADD COLUMN bimi_vmc_expiry TEXT;
ALTER TABLE brands ADD COLUMN bimi_grade TEXT;
ALTER TABLE brands ADD COLUMN bimi_last_checked TEXT;

-- Register migration
INSERT INTO d1_migrations (name) VALUES ('0058_add_bimi_to_brands.sql');
