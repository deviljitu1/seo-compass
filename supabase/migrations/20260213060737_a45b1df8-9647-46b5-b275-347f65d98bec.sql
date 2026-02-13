
-- Create storage bucket for task attachments (screenshots, charts, etc.)
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true);

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload task attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access for viewing attachments
CREATE POLICY "Task attachments are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments');

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add attachments column to seo_tasks for storing image URLs
ALTER TABLE public.seo_tasks ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
