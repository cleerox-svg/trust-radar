-- Add description column to campaigns for storing technical IDs
-- when AI-generated names replace them
ALTER TABLE campaigns ADD COLUMN description TEXT;
