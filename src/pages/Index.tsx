import { SEOProject } from '@/types/seo';
import { useSEOStore } from '@/stores/seoStore';
import { useAuth } from '@/contexts/AuthContext';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { ProjectView } from '@/components/ProjectView';
import { SEOScoreCircle } from '@/components/SEOScoreCircle';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Calendar, Trash2, Search, LogOut, LogIn, Loader2, Cloud, HardDrive, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { CommandMenu } from '@/components/CommandMenu';

const Index = () => {
  const store = useSEOStore();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<SEOProject | null>(null);

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isCommandOpen, setCommandOpen] = useState(false);

  if (store.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleCreateProject = async (project: any) => {
    const id = await store.createProject(project);
    setCreateOpen(false);
    return id;
  };

  const projectView = selectedProject ? store.projects.find(p => p.id === selectedProject.id) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandMenu
        open={isCommandOpen}
        onOpenChange={setCommandOpen}
        onSelectProject={setSelectedProject}
        onOpenCreateDialog={() => setCreateOpen(true)}
      />

      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setCreateOpen}
        onCreateProject={handleCreateProject}
      />

      {projectView ? (
        <ProjectView project={projectView} onBack={() => setSelectedProject(null)} />
      ) : (
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <Search className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground tracking-tight">SEO Command Center</h1>
                  <p className="text-xs text-muted-foreground">Professional SEO Operations Platform</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setCommandOpen(true)}>
                  <Search className="h-4 w-4" />
                </Button>
                {store.isGuest ? (
                  <Badge variant="outline" className="gap-1.5 text-xs hidden sm:flex">
                    <HardDrive className="h-3 w-3" />
                    Local Mode
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1.5 text-xs hidden sm:flex border-primary/30 text-primary">
                    <Cloud className="h-3 w-3" />
                    Cloud Synced
                  </Badge>
                )}
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Project</span>
                </Button>
                {user ? (
                  <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground hover:text-foreground">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs">Sign Out</span>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="gap-2">
                    <LogIn className="h-4 w-4" />
                    <span className="text-xs">Sign In</span>
                  </Button>
                )}
              </div>
            </div>
          </header>

          {/* Guest banner */}
          {store.isGuest && (
            <div className="bg-primary/5 border-b border-primary/10">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  📋 You're in <strong>Guest Mode</strong> — data is saved locally on this device only.
                </p>
                <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => navigate('/auth')}>
                  Sign in to sync across devices →
                </Button>
              </div>
            </div>
          )}

          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            {store.projects.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24"
              >
                <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mb-6 glow-primary">
                  <Search className="h-10 w-10 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to SEO Command Center</h2>
                <p className="text-muted-foreground text-center max-w-md mb-8">
                  Create your first SEO project to get started with 60+ predefined professional tasks across 6 categories.
                </p>
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Project
                </Button>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">Your Projects</h2>
                  <p className="text-xs text-muted-foreground hidden md:block">
                    Pro tip: Press <kbd className="font-mono bg-muted px-1 rounded">Ctrl+K</kbd> to search
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {store.projects.map((project, i) => {
                    const score = store.getProjectScore(project.id);
                    const stats = store.getStats(project.id);
                    return (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card rounded-xl overflow-hidden cursor-pointer hover:border-primary/30 transition-all group"
                        onClick={() => setSelectedProject(project)}
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">{project.name}</h3>
                              <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                                <Globe className="h-3.5 w-3.5" />
                                <span className="text-xs">{project.domain}</span>
                              </div>
                            </div>
                            <SEOScoreCircle score={score} size={64} label="" />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{format(new Date(project.startDate), 'MMM d, yyyy')}</span>
                            {project.clientName && <span>• {project.clientName}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{ width: `${(stats.done / stats.total) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-foreground">{stats.done}/{stats.total}</span>
                          </div>
                        </div>
                        <div className="border-t border-border/50 px-5 py-3 flex justify-between items-center">
                          <div className="flex gap-3 text-xs">
                            <span className="text-success">{stats.done} done</span>
                            <span className="text-info">{stats.inProgress} active</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); store.deleteProject(project.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

export default Index;
