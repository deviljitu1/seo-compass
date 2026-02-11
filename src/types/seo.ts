export type SEOCategory = 
  | 'technical'
  | 'on-page'
  | 'content'
  | 'off-page'
  | 'local'
  | 'tracking';

export type TaskStatus = 'not-started' | 'in-progress' | 'done' | 'skipped';
export type Impact = 'high' | 'medium' | 'low';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface SEOTask {
  id: string;
  projectId: string;
  category: SEOCategory;
  title: string;
  description: string;
  whyItMatters: string;
  executionSteps: string[];
  toolsRequired: string[];
  expectedImpact: Impact;
  priority: Priority;
  status: TaskStatus;
  completionDate?: string;
  notes: string;
  proofUrl: string;
  timeSpentMinutes: number;
  createdAt: string;
}

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  category: SEOCategory;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
  changedBy: string;
  changeDate: string;
  notes: string;
}

export interface SEOProject {
  id: string;
  name: string;
  domain: string;
  startDate: string;
  clientName: string;
  industry: string;
  createdAt: string;
}

export interface CategoryInfo {
  id: SEOCategory;
  label: string;
  icon: string;
  description: string;
  color: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'technical', label: 'Technical SEO', icon: 'Settings', description: 'Site infrastructure & crawlability', color: 'chart-1' },
  { id: 'on-page', label: 'On-Page SEO', icon: 'FileText', description: 'Content optimization & structure', color: 'chart-2' },
  { id: 'content', label: 'Content SEO', icon: 'PenTool', description: 'Content strategy & creation', color: 'chart-3' },
  { id: 'off-page', label: 'Off-Page SEO', icon: 'ExternalLink', description: 'Link building & authority', color: 'chart-4' },
  { id: 'local', label: 'Local SEO', icon: 'MapPin', description: 'Local search optimization', color: 'chart-5' },
  { id: 'tracking', label: 'Tracking & Analytics', icon: 'BarChart3', description: 'Performance monitoring', color: 'info' },
];
