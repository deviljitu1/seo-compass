import { useState } from 'react';
import { SEOProject, SEOCategory, CATEGORIES } from '@/types/seo';
import { useSEOStore } from '@/stores/seoStore';
import { SEOScoreCircle } from '@/components/SEOScoreCircle';
import { TaskCard } from '@/components/TaskCard';
import { TimelineView } from '@/components/TimelineView';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, FileText, PenTool, ExternalLink, MapPin, BarChart3, Clock, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const iconMap: Record<string, React.ReactNode> = {
  Settings: <Settings className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  PenTool: <PenTool className="h-4 w-4" />,
  ExternalLink: <ExternalLink className="h-4 w-4" />,
  MapPin: <MapPin className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
};

interface ProjectViewProps {
  project: SEOProject;
  onBack: () => void;
}

type ViewMode = 'dashboard' | 'timeline' | SEOCategory;

export function ProjectView({ project, onBack }: ProjectViewProps) {
  const [activeView, setActiveView] = useState<ViewMode>('dashboard');
  const { getProjectTasks, getProjectHistory, getProjectScore, getStats, updateTask } = useSEOStore();

  const score = getProjectScore(project.id);
  const stats = getStats(project.id);
  const history = getProjectHistory(project.id);

  const navItems = [
    { id: 'dashboard' as ViewMode, label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    ...CATEGORIES.map(c => ({ id: c.id as ViewMode, label: c.label, icon: iconMap[c.icon] })),
    { id: 'timeline' as ViewMode, label: 'Timeline', icon: <Clock className="h-4 w-4" /> },
  ];

  const renderContent = () => {
    if (activeView === 'timeline') {
      return <TimelineView history={history} />;
    }

    if (activeView === 'dashboard') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="glass-card rounded-xl p-4 flex flex-col items-center justify-center col-span-2 lg:col-span-1 glow-primary">
              <SEOScoreCircle score={score} size={120} />
            </div>
            {[
              { label: 'Total Tasks', value: stats.total, color: 'text-foreground' },
              { label: 'Completed', value: stats.done, color: 'text-success' },
              { label: 'In Progress', value: stats.inProgress, color: 'text-info' },
              { label: 'Not Started', value: stats.notStarted, color: 'text-muted-foreground' },
            ].map(stat => (
              <div key={stat.label} className="glass-card rounded-xl p-4 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
                <span className="text-xs text-muted-foreground mt-1">{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map(cat => {
              const tasks = getProjectTasks(project.id, cat.id);
              const done = tasks.filter(t => t.status === 'done').length;
              const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveView(cat.id)}
                  className="glass-card rounded-xl p-5 text-left hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                      {iconMap[cat.icon]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{cat.label}</h3>
                      <p className="text-xs text-muted-foreground">{cat.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{done}/{tasks.length} tasks</span>
                    <span className="text-xs font-bold text-primary">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {history.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-semibold text-sm text-foreground mb-3">Recent Activity</h3>
              <TimelineView history={history.slice(0, 5)} />
            </div>
          )}
        </div>
      );
    }

    // Category view
    const tasks = getProjectTasks(project.id, activeView as SEOCategory);
    const cat = CATEGORIES.find(c => c.id === activeView);

    return (
      <div className="space-y-3">
        {cat && (
          <div className="mb-4">
            <h2 className="text-lg font-bold text-foreground">{cat.label}</h2>
            <p className="text-sm text-muted-foreground">{cat.description}</p>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="secondary">{tasks.filter(t => t.status === 'done').length}/{tasks.length} completed</Badge>
            </div>
          </div>
        )}
        <AnimatePresence>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onUpdate={updateTask} />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Button>
          <div className="h-5 w-px bg-border" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground truncate">{project.name}</h1>
            <p className="text-xs text-muted-foreground">{project.domain}</p>
          </div>
          <Badge variant="outline" className="hidden sm:flex">{project.industry || 'General'}</Badge>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto flex">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 lg:w-64 border-r border-border/50 min-h-[calc(100vh-3.5rem)] p-3 space-y-1 sticky top-14 self-start">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeView === item.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </aside>

        {/* Mobile nav */}
        <div className="md:hidden sticky top-14 z-40 bg-background border-b border-border/50 overflow-x-auto">
          <div className="flex gap-1 p-2">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-all ${
                  activeView === item.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
