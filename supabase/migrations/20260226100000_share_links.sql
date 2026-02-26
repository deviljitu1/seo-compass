
-- Create share_links table
CREATE TABLE public.share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.seo_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

-- Owner can manage their share links
CREATE POLICY "Owners can manage their share links"
  ON public.share_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anyone can read a share link (to validate it, no auth needed)
CREATE POLICY "Anyone can read share links"
  ON public.share_links FOR SELECT
  USING (true);

-- Allow anon/public to read a project if there's a matching share link
CREATE POLICY "Public can view shared projects"
  ON public.seo_projects FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.share_links sl
      WHERE sl.project_id = id
    )
  );

-- Allow anon/public to read tasks for a shared project
CREATE POLICY "Public can view tasks of shared projects"
  ON public.seo_tasks FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.share_links sl
      WHERE sl.project_id = project_id
    )
  );

-- Allow anon/public to read task history for a shared project
CREATE POLICY "Public can view history of shared projects"
  ON public.task_history FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.share_links sl
      INNER JOIN public.seo_tasks st ON st.id = task_id
      WHERE sl.project_id = st.project_id
    )
  );

CREATE INDEX idx_share_links_project_id ON public.share_links(project_id);
CREATE INDEX idx_share_links_token ON public.share_links(token);
