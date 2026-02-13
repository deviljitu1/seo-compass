import { useState, useCallback, useEffect, useRef } from 'react';
import { SEOProject, SEOTask, TaskHistoryEntry, SEOCategory, TaskStatus } from '@/types/seo';
import { SEO_TASK_TEMPLATES } from '@/data/seoTasks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const LOCAL_KEY = 'seo-platform-guest';

interface StoreData {
  projects: SEOProject[];
  tasks: SEOTask[];
  history: TaskHistoryEntry[];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function loadLocal(): StoreData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { projects: [], tasks: [], history: [] };
}

function saveLocal(data: StoreData) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

export function useSEOStore() {
  const { user } = useAuth();
  const isGuest = !user;
  const [data, setData] = useState<StoreData>(() => isGuest ? loadLocal() : { projects: [], tasks: [], history: [] });
  const [loading, setLoading] = useState(!isGuest);
  const prevUserRef = useRef(user?.id);

  // ── Cloud loader ──
  const loadCloud = useCallback(async () => {
    if (!user) return;
    try {
      const [projectsRes, tasksRes, historyRes] = await Promise.all([
        supabase.from('seo_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('seo_tasks').select('*').order('created_at', { ascending: true }),
        supabase.from('task_history').select('*').order('change_date', { ascending: false }),
      ]);

      const projects: SEOProject[] = (projectsRes.data || []).map((p: any) => ({
        id: p.id, name: p.name, domain: p.domain, startDate: p.start_date,
        clientName: p.client_name, industry: p.industry, createdAt: p.created_at,
      }));

      const tasks: SEOTask[] = (tasksRes.data || []).map((t: any) => ({
        id: t.id, projectId: t.project_id, category: t.category as SEOCategory,
        title: t.title, description: t.description, whyItMatters: t.why_it_matters,
        executionSteps: t.execution_steps || [], toolsRequired: t.tools_required || [],
        expectedImpact: t.expected_impact, priority: t.priority, status: t.status as TaskStatus,
        completionDate: t.completion_date, notes: t.notes, proofUrl: t.proof_url,
        timeSpentMinutes: t.time_spent_minutes, createdAt: t.created_at,
        attachments: t.attachments || [],
      }));

      const history: TaskHistoryEntry[] = (historyRes.data || []).map((h: any) => ({
        id: h.id, taskId: h.task_id, taskTitle: h.task_title,
        category: h.category as SEOCategory, oldStatus: h.old_status as TaskStatus,
        newStatus: h.new_status as TaskStatus, changedBy: h.changed_by,
        changeDate: h.change_date, notes: h.notes,
      }));

      setData({ projects, tasks, history });
    } catch (err) {
      console.error('Failed to load cloud data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // When user changes, reload
  useEffect(() => {
    if (user && user.id !== prevUserRef.current) {
      prevUserRef.current = user.id;
      setLoading(true);
      loadCloud();
    } else if (!user) {
      prevUserRef.current = undefined;
      setData(loadLocal());
      setLoading(false);
    }
  }, [user, loadCloud]);

  // Initial cloud load
  useEffect(() => {
    if (user) loadCloud();
  }, []);

  // ── Local helpers ──
  const updateLocal = useCallback((updater: (d: StoreData) => StoreData) => {
    setData(prev => {
      const next = updater(prev);
      saveLocal(next);
      return next;
    });
  }, []);

  // ── Create project ──
  const createProject = useCallback(async (project: Omit<SEOProject, 'id' | 'createdAt'>) => {
    if (isGuest) {
      const id = generateId();
      const newProject: SEOProject = { ...project, id, createdAt: new Date().toISOString() };
      const tasks: SEOTask[] = SEO_TASK_TEMPLATES.map(t => ({
        id: generateId(), projectId: id, category: t.category, title: t.title,
        description: t.description, whyItMatters: t.whyItMatters,
        executionSteps: t.executionSteps, toolsRequired: t.toolsRequired,
        expectedImpact: t.expectedImpact, priority: t.priority,
        status: 'not-started' as TaskStatus, notes: '', proofUrl: '',
        timeSpentMinutes: 0, createdAt: new Date().toISOString(), attachments: [],
      }));
      updateLocal(d => ({ ...d, projects: [...d.projects, newProject], tasks: [...d.tasks, ...tasks] }));
      return id;
    }

    const { data: newProject, error } = await supabase.from('seo_projects')
      .insert({ user_id: user!.id, name: project.name, domain: project.domain, start_date: project.startDate, client_name: project.clientName, industry: project.industry })
      .select().single();

    if (error || !newProject) { console.error('Failed:', error); return ''; }

    const taskRows = SEO_TASK_TEMPLATES.map(t => ({
      user_id: user!.id, project_id: newProject.id, category: t.category, title: t.title,
      description: t.description, why_it_matters: t.whyItMatters, execution_steps: t.executionSteps,
      tools_required: t.toolsRequired, expected_impact: t.expectedImpact, priority: t.priority,
      status: 'not-started', notes: '', proof_url: '', time_spent_minutes: 0,
    }));
    await supabase.from('seo_tasks').insert(taskRows);
    await loadCloud();
    return newProject.id;
  }, [isGuest, user, updateLocal, loadCloud]);

  // ── Update task ──
  const updateTask = useCallback(async (taskId: string, updates: Partial<SEOTask>) => {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (isGuest) {
      updateLocal(d => {
        const historyEntries = [...d.history];
        if (updates.status && updates.status !== task.status) {
          historyEntries.push({
            id: generateId(), taskId, taskTitle: task.title, category: task.category,
            oldStatus: task.status, newStatus: updates.status, changedBy: 'Guest',
            changeDate: new Date().toISOString(), notes: updates.notes || '',
          });
          if (updates.status === 'done' && !updates.completionDate) updates.completionDate = new Date().toISOString();
        }
        return { ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t), history: historyEntries };
      });
      return;
    }

    if (updates.status && updates.status !== task.status) {
      await supabase.from('task_history').insert({
        user_id: user!.id, task_id: taskId, task_title: task.title, category: task.category,
        old_status: task.status, new_status: updates.status, changed_by: 'Admin', notes: updates.notes || '',
      });
      if (updates.status === 'done' && !updates.completionDate) updates.completionDate = new Date().toISOString();
    }

    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.proofUrl !== undefined) dbUpdates.proof_url = updates.proofUrl;
    if (updates.timeSpentMinutes !== undefined) dbUpdates.time_spent_minutes = updates.timeSpentMinutes;
    if (updates.completionDate !== undefined) dbUpdates.completion_date = updates.completionDate;
    if (updates.attachments !== undefined) dbUpdates.attachments = updates.attachments;

    if (Object.keys(dbUpdates).length > 0) {
      await supabase.from('seo_tasks').update(dbUpdates).eq('id', taskId);
    }
    await loadCloud();
  }, [isGuest, user, data.tasks, updateLocal, loadCloud]);

  // ── Upload attachment ──
  const uploadAttachment = useCallback(async (taskId: string, file: File): Promise<string | null> => {
    if (isGuest) {
      // For guests, store as data URL in localStorage
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const task = data.tasks.find(t => t.id === taskId);
          if (task) {
            const attachments = [...(task.attachments || []), dataUrl];
            updateLocal(d => ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, attachments } : t) }));
          }
          resolve(dataUrl);
        };
        reader.readAsDataURL(file);
      });
    }

    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${taskId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('task-attachments').upload(path, file);
    if (error) { console.error('Upload failed:', error); return null; }

    const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(path);
    const url = urlData.publicUrl;

    // Update task attachments array
    const task = data.tasks.find(t => t.id === taskId);
    const currentAttachments = task?.attachments || [];
    const newAttachments = [...currentAttachments, url];
    await supabase.from('seo_tasks').update({ attachments: newAttachments }).eq('id', taskId);
    await loadCloud();
    return url;
  }, [isGuest, user, data.tasks, updateLocal, loadCloud]);

  // ── Delete attachment ──
  const deleteAttachment = useCallback(async (taskId: string, attachmentUrl: string) => {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;
    const newAttachments = (task.attachments || []).filter((a: string) => a !== attachmentUrl);

    if (isGuest) {
      updateLocal(d => ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, attachments: newAttachments } : t) }));
      return;
    }

    // Delete from storage if it's a supabase URL
    if (attachmentUrl.includes('task-attachments')) {
      const path = attachmentUrl.split('/task-attachments/')[1];
      if (path) await supabase.storage.from('task-attachments').remove([path]);
    }
    await supabase.from('seo_tasks').update({ attachments: newAttachments }).eq('id', taskId);
    await loadCloud();
  }, [isGuest, data.tasks, updateLocal, loadCloud]);

  // ── Delete project ──
  const deleteProject = useCallback(async (projectId: string) => {
    if (isGuest) {
      updateLocal(d => ({
        projects: d.projects.filter(p => p.id !== projectId),
        tasks: d.tasks.filter(t => t.projectId !== projectId),
        history: d.history.filter(h => { const t = d.tasks.find(t => t.id === h.taskId); return t?.projectId !== projectId; }),
      }));
      return;
    }
    await supabase.from('seo_projects').delete().eq('id', projectId);
    await loadCloud();
  }, [isGuest, user, updateLocal, loadCloud]);

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
    const completedWeight = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + weights[t.expectedImpact], 0);
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
    projects: data.projects, tasks: data.tasks, history: data.history, loading, isGuest,
    createProject, updateTask, deleteProject, uploadAttachment, deleteAttachment,
    getProjectTasks, getProjectHistory, getProjectScore, getStats,
  };
}
