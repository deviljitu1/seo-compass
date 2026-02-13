import { useState, useCallback, useEffect } from 'react';
import { SEOProject, SEOTask, TaskHistoryEntry, SEOCategory, TaskStatus } from '@/types/seo';
import { SEO_TASK_TEMPLATES } from '@/data/seoTasks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StoreData {
  projects: SEOProject[];
  tasks: SEOTask[];
  history: TaskHistoryEntry[];
}

export function useSEOStore() {
  const { user } = useAuth();
  const [data, setData] = useState<StoreData>({ projects: [], tasks: [], history: [] });
  const [loading, setLoading] = useState(true);

  // Load all data from Supabase
  const loadData = useCallback(async () => {
    if (!user) {
      setData({ projects: [], tasks: [], history: [] });
      setLoading(false);
      return;
    }

    try {
      const [projectsRes, tasksRes, historyRes] = await Promise.all([
        supabase.from('seo_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('seo_tasks').select('*').order('created_at', { ascending: true }),
        supabase.from('task_history').select('*').order('change_date', { ascending: false }),
      ]);

      const projects: SEOProject[] = (projectsRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        domain: p.domain,
        startDate: p.start_date,
        clientName: p.client_name,
        industry: p.industry,
        createdAt: p.created_at,
      }));

      const tasks: SEOTask[] = (tasksRes.data || []).map((t: any) => ({
        id: t.id,
        projectId: t.project_id,
        category: t.category as SEOCategory,
        title: t.title,
        description: t.description,
        whyItMatters: t.why_it_matters,
        executionSteps: t.execution_steps || [],
        toolsRequired: t.tools_required || [],
        expectedImpact: t.expected_impact,
        priority: t.priority,
        status: t.status as TaskStatus,
        completionDate: t.completion_date,
        notes: t.notes,
        proofUrl: t.proof_url,
        timeSpentMinutes: t.time_spent_minutes,
        createdAt: t.created_at,
      }));

      const history: TaskHistoryEntry[] = (historyRes.data || []).map((h: any) => ({
        id: h.id,
        taskId: h.task_id,
        taskTitle: h.task_title,
        category: h.category as SEOCategory,
        oldStatus: h.old_status as TaskStatus,
        newStatus: h.new_status as TaskStatus,
        changedBy: h.changed_by,
        changeDate: h.change_date,
        notes: h.notes,
      }));

      setData({ projects, tasks, history });
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createProject = useCallback(async (project: Omit<SEOProject, 'id' | 'createdAt'>) => {
    if (!user) return '';

    const { data: newProject, error } = await supabase
      .from('seo_projects')
      .insert({
        user_id: user.id,
        name: project.name,
        domain: project.domain,
        start_date: project.startDate,
        client_name: project.clientName,
        industry: project.industry,
      })
      .select()
      .single();

    if (error || !newProject) {
      console.error('Failed to create project:', error);
      return '';
    }

    // Create tasks from templates
    const taskRows = SEO_TASK_TEMPLATES.map(t => ({
      user_id: user.id,
      project_id: newProject.id,
      category: t.category,
      title: t.title,
      description: t.description,
      why_it_matters: t.whyItMatters,
      execution_steps: t.executionSteps,
      tools_required: t.toolsRequired,
      expected_impact: t.expectedImpact,
      priority: t.priority,
      status: 'not-started',
      notes: '',
      proof_url: '',
      time_spent_minutes: 0,
    }));

    await supabase.from('seo_tasks').insert(taskRows);

    await loadData();
    return newProject.id;
  }, [user, loadData]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<SEOTask>) => {
    if (!user) return;

    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Track status changes in history
    if (updates.status && updates.status !== task.status) {
      await supabase.from('task_history').insert({
        user_id: user.id,
        task_id: taskId,
        task_title: task.title,
        category: task.category,
        old_status: task.status,
        new_status: updates.status,
        changed_by: 'Admin',
        notes: updates.notes || '',
      });

      if (updates.status === 'done' && !updates.completionDate) {
        updates.completionDate = new Date().toISOString();
      }
    }

    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.proofUrl !== undefined) dbUpdates.proof_url = updates.proofUrl;
    if (updates.timeSpentMinutes !== undefined) dbUpdates.time_spent_minutes = updates.timeSpentMinutes;
    if (updates.completionDate !== undefined) dbUpdates.completion_date = updates.completionDate;

    if (Object.keys(dbUpdates).length > 0) {
      await supabase.from('seo_tasks').update(dbUpdates).eq('id', taskId);
    }

    await loadData();
  }, [user, data.tasks, loadData]);

  const deleteProject = useCallback(async (projectId: string) => {
    if (!user) return;
    await supabase.from('seo_projects').delete().eq('id', projectId);
    await loadData();
  }, [user, loadData]);

  const getProjectTasks = useCallback((projectId: string, category?: SEOCategory) => {
    return data.tasks.filter(t => t.projectId === projectId && (!category || t.category === category));
  }, [data.tasks]);

  const getProjectHistory = useCallback((projectId: string) => {
    const projectTaskIds = new Set(data.tasks.filter(t => t.projectId === projectId).map(t => t.id));
    return data.history.filter(h => projectTaskIds.has(h.taskId)).sort((a, b) =>
      new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime()
    );
  }, [data.tasks, data.history]);

  const getProjectScore = useCallback((projectId: string) => {
    const tasks = data.tasks.filter(t => t.projectId === projectId);
    if (tasks.length === 0) return 0;
    const weights = { high: 3, medium: 2, low: 1 };
    const totalWeight = tasks.reduce((sum, t) => sum + weights[t.expectedImpact], 0);
    const completedWeight = tasks
      .filter(t => t.status === 'done')
      .reduce((sum, t) => sum + weights[t.expectedImpact], 0);
    return Math.round((completedWeight / totalWeight) * 100);
  }, [data.tasks]);

  const getStats = useCallback((projectId: string) => {
    const tasks = data.tasks.filter(t => t.projectId === projectId);
    return {
      total: tasks.length,
      done: tasks.filter(t => t.status === 'done').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      notStarted: tasks.filter(t => t.status === 'not-started').length,
      skipped: tasks.filter(t => t.status === 'skipped').length,
    };
  }, [data.tasks]);

  return {
    projects: data.projects,
    tasks: data.tasks,
    history: data.history,
    loading,
    createProject,
    updateTask,
    deleteProject,
    getProjectTasks,
    getProjectHistory,
    getProjectScore,
    getStats,
  };
}
