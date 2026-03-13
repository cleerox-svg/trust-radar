-- Add latitude/longitude to threats for map visualization
ALTER TABLE threats ADD COLUMN lat REAL;
ALTER TABLE threats ADD COLUMN lng REAL;
