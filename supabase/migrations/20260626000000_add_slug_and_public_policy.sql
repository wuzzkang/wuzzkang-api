-- Add slug column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);

-- Enable select access for public/anonymous users on deployed projects
CREATE POLICY "Allow public select for deployed projects" ON public.projects
  FOR SELECT USING (status = 'deployed');
