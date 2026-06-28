-- Add edit_count column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS edit_count INT DEFAULT 0;
