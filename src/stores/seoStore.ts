import { useState, useCallback } from 'react';
import { SEOProject, SEOTask, TaskHistoryEntry, SEOCategory, TaskStatus } from '@/types/seo';
import { SEO_TASK_TEMPLATES } from '@/data/seoTasks';

const STORAGE_KEY = 'seo-platform';

interface StoreData {
  projects: SEOProject[];
  tasks: SEOTask[];
  history: TaskHistoryEntry[];
}

function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { projects: [], tasks: [], history: [] };
}

function saveStore(data: StoreData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function useSEOStore() {
  const [data, setData] = useState<StoreData>(loadStore);

  const update = useCallback((updater: (d: StoreData) => StoreData) => {
    setData(prev => {
      const next = updater(prev);
      saveStore(next);
      return next;
    });
  }, []);

  const createProject = useCallback((project: Omit<SEOProject, 'id' | 'createdAt'>) => {
    const id = generateId();
    const newProject: SEOProject = { ...project, id, createdAt: new Date().toISOString() };
    
    const tasks: SEOTask[] = SEO_TASK_TEMPLATES.map(t => ({
      id: generateId(),
      projectId: id,
      category: t.category,
      title: t.title,
      description: t.description,
      whyItMatters: t.whyItMatters,
      executionSteps: t.executionSteps,
      toolsRequired: t.toolsRequired,
      expectedImpact: t.expectedImpact,
      priority: t.priority,
      status: 'not-started' as TaskStatus,
      notes: '',
      proofUrl: '',
      timeSpentMinutes: 0,
      createdAt: new Date().toISOString(),
    }));

    update(d => ({
      ...d,
      projects: [...d.projects, newProject],
      tasks: [...d.tasks, ...tasks],
    }));
    return id;
  }, [update]);

  const updateTask = useCallback((taskId: string, updates: Partial<SEOTask>) => {
    update(d => {
      const task = d.tasks.find(t => t.id === taskId);
      if (!task) return d;

      const historyEntries = [...d.history];
      if (updates.status && updates.status !== task.status) {
        historyEntries.push({
          id: generateId(),
          taskId,
          taskTitle: task.title,
          category: task.category,
          oldStatus: task.status,
          newStatus: updates.status,
          changedBy: 'Admin',
          changeDate: new Date().toISOString(),
          notes: updates.notes || '',
        });
        if (updates.status === 'done' && !updates.completionDate) {
          updates.completionDate = new Date().toISOString();
        }
      }

      return {
        ...d,
        tasks: d.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
        history: historyEntries,
      };
    });
  }, [update]);

  const deleteProject = useCallback((projectId: string) => {
    update(d => ({
      projects: d.projects.filter(p => p.id !== projectId),
      tasks: d.tasks.filter(t => t.projectId !== projectId),
      history: d.history.filter(h => {
        const task = d.tasks.find(t => t.id === h.taskId);
        return task?.projectId !== projectId;
      }),
    }));
  }, [update]);

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
    createProject,
    updateTask,
    deleteProject,
    getProjectTasks,
    getProjectHistory,
    getProjectScore,
    getStats,
  };
}
