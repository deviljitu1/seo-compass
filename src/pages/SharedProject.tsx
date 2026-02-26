import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SEOProject, SEOTask, TaskHistoryEntry, SEOCategory, TaskStatus, CATEGORIES } from '@/types/seo';
import { SEOScoreCircle } from '@/components/SEOScoreCircle';
import { TimelineView } from '@/components/TimelineView';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
    Globe, Calendar, Search, Loader2, Lock, Settings, FileText, PenTool,
    ExternalLink, MapPin, BarChart3, Clock, LayoutDashboard, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { TaskCard } from '@/components/TaskCard';
import { toast } from 'sonner';

const iconMap: Record<string, React.ReactNode> = {
    Settings: <Settings className="h-4 w-4" />,
    FileText: <FileText className="h-4 w-4" />,
    PenTool: <PenTool className="h-4 w-4" />,
    ExternalLink: <ExternalLink className="h-4 w-4" />,
    MapPin: <MapPin className="h-4 w-4" />,
    BarChart3: <BarChart3 className="h-4 w-4" />,
};

type ViewMode = 'dashboard' | 'timeline' | SEOCategory;

const statusColors: Record<TaskStatus, string> = {
    'done': 'bg-success/15 text-success border-success/30',
    'in-progress': 'bg-info/15 text-info border-info/30',
    'not-started': 'bg-muted/50 text-muted-foreground border-border/50',
    'skipped': 'bg-muted/30 text-muted-foreground/60 border-border/30 line-through',
};

const statusLabels: Record<TaskStatus, string> = {
    'done': 'Done',
    'in-progress': 'In Progress',
    'not-started': 'Not Started',
    'skipped': 'Skipped',
};

const impactColors = {
    high: 'text-destructive border-destructive/30 bg-destructive/10',
    medium: 'text-warning border-warning/30 bg-warning/10',
    low: 'text-muted-foreground border-border/50 bg-muted/30',
};

export default function SharedProjectPage() {
    const { token } = useParams<{ token: string }>();
    const [project, setProject] = useState<SEOProject | null>(null);
    const [tasks, setTasks] = useState<SEOTask[]>([]);
    const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [activeView, setActiveView] = useState<ViewMode>('dashboard');
    const [accessLevel, setAccessLevel] = useState<'viewer' | 'editor'>('viewer');
    const [ownerId, setOwnerId] = useState<string>('');

    useEffect(() => {
        if (!token) { setNotFound(true); setLoading(false); return; }
        loadSharedData();
    }, [token]);

    const loadSharedData = async () => {
        setLoading(true);
        try {
            // 1. Resolve the token → project_id
            const { data: link, error: linkErr } = await supabase
                .from('share_links')
                .select('project_id, access_level, user_id')
                .eq('token', token!)
                .maybeSingle();

            if (linkErr || !link) { setNotFound(true); return; }

            const projectId = link.project_id;
            setAccessLevel(link.access_level as 'viewer' | 'editor' || 'viewer');
            setOwnerId(link.user_id);

            // 2. Load project
            const { data: proj } = await supabase
                .from('seo_projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (!proj) { setNotFound(true); return; }

            setProject({
                id: proj.id, name: proj.name, domain: proj.domain,
                startDate: proj.start_date, clientName: proj.client_name,
                industry: proj.industry, createdAt: proj.created_at,
            });

            // 3. Load tasks
            const { data: tasksData } = await supabase
                .from('seo_tasks')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: true });

            const mappedTasks: SEOTask[] = (tasksData || []).map((t: any) => ({
                id: t.id, projectId: t.project_id, category: t.category as SEOCategory,
                title: t.title, description: t.description, whyItMatters: t.why_it_matters,
                executionSteps: t.execution_steps || [], toolsRequired: t.tools_required || [],
                expectedImpact: t.expected_impact, priority: t.priority, status: t.status as TaskStatus,
                completionDate: t.completion_date, notes: t.notes, proofUrl: t.proof_url,
                timeSpentMinutes: t.time_spent_minutes, createdAt: t.created_at,
                attachments: t.attachments || [],
            }));
            setTasks(mappedTasks);

            // 4. Load history
            const taskIds = mappedTasks.map(t => t.id);
            if (taskIds.length > 0) {
                const { data: histData } = await supabase
                    .from('task_history')
                    .select('*')
                    .in('task_id', taskIds)
                    .order('change_date', { ascending: false });

                setHistory((histData || []).map((h: any) => ({
                    id: h.id, taskId: h.task_id, taskTitle: h.task_title,
                    category: h.category as SEOCategory, oldStatus: h.old_status as TaskStatus,
                    newStatus: h.new_status as TaskStatus, changedBy: h.changed_by,
                    changeDate: h.change_date, notes: h.notes,
                })));
            }
        } catch (err) {
            console.error(err);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    };

    const score = useMemo(() => {
        if (tasks.length === 0) return 0;
        const weights = { high: 3, medium: 2, low: 1 };
        const totalWeight = tasks.reduce((sum, t) => sum + weights[t.expectedImpact], 0);
        const completedWeight = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + weights[t.expectedImpact], 0);
        return Math.round((completedWeight / totalWeight) * 100);
    }, [tasks]);

    const stats = useMemo(() => ({
        total: tasks.length,
        done: tasks.filter(t => t.status === 'done').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        notStarted: tasks.filter(t => t.status === 'not-started').length,
        skipped: tasks.filter(t => t.status === 'skipped').length,
    }), [tasks]);

    const updateSharedTask = async (taskId: string, updates: Partial<SEOTask>) => {
        if (accessLevel !== 'editor') return;

        // Optimistic UI update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));

        const dbUpdates: any = {};
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.proofUrl !== undefined) dbUpdates.proof_url = updates.proofUrl;
        if (updates.timeSpentMinutes !== undefined) dbUpdates.time_spent_minutes = updates.timeSpentMinutes;
        if (updates.completionDate !== undefined) dbUpdates.completion_date = updates.completionDate;
        if (updates.attachments !== undefined) dbUpdates.attachments = updates.attachments;

        try {
            if (Object.keys(dbUpdates).length > 0) {
                const { error } = await supabase.from('seo_tasks').update(dbUpdates).eq('id', taskId);
                if (error) throw error;
            }

            if (updates.status) {
                const task = tasks.find(t => t.id === taskId);
                if (task && task.status !== updates.status) {
                    await supabase.from('task_history').insert({
                        user_id: ownerId,
                        task_id: taskId,
                        task_title: task.title,
                        category: task.category,
                        old_status: task.status,
                        new_status: updates.status,
                        changed_by: 'Public Editor',
                        notes: updates.notes || ''
                    });

                    // Reload history to show the timeline correctly
                    const { data: histData } = await supabase
                        .from('task_history')
                        .select('*')
                        .eq('task_id', taskId)
                        .order('change_date', { ascending: false });

                    if (histData) {
                        setHistory(prev => {
                            const newHistData = histData.map((h: any) => ({
                                id: h.id, taskId: h.task_id, taskTitle: h.task_title,
                                category: h.category as SEOCategory, oldStatus: h.old_status as TaskStatus,
                                newStatus: h.new_status as TaskStatus, changedBy: h.changed_by,
                                changeDate: h.change_date, notes: h.notes,
                            }));
                            const combined = [...prev, ...newHistData];
                            // Remove duplicates by ID and sort
                            return Array.from(new Map(combined.map(item => [item.id, item])).values())
                                .sort((a, b) => new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime());
                        });
                    }
                }
            }
        } catch (err) {
            console.error("Failed to update task", err);
            toast.error("Failed to save changes.");
            // Revert on error by reloading entirely
            loadSharedData();
        }
    };

    const navItems = [
        { id: 'dashboard' as ViewMode, label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
        ...CATEGORIES.map(c => ({ id: c.id as ViewMode, label: c.label, icon: iconMap[c.icon] })),
        { id: 'timeline' as ViewMode, label: 'Timeline', icon: <Clock className="h-4 w-4" /> },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4 z-10"
                >
                    <div className="w-16 h-16 rounded-2xl glass-card flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </motion.div>
            </div>
        );
    }

    if (notFound || !project) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="glass-card p-10 rounded-3xl flex flex-col items-center text-center max-w-lg z-10 border-border/40 shadow-2xl"
                >
                    <div className="w-20 h-20 rounded-2xl bg-muted/80 flex items-center justify-center mb-6 shadow-inner">
                        <Lock className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">Link Unavailable</h1>
                    <p className="text-base text-muted-foreground">
                        This share link is invalid or has been revoked by the project owner. If you believe this is a mistake, please reach out to the project administrator.
                    </p>
                </motion.div>
            </div>
        );
    }

    const renderContent = () => {
        if (activeView === 'timeline') {
            return <TimelineView history={history} />;
        }

        if (activeView === 'dashboard') {
            const highPriorityPending = tasks
                .filter(t => t.status !== 'done' && t.status !== 'skipped' && (t.expectedImpact === 'high' || t.priority === 'critical'))
                .slice(0, 5);

            return (
                <div className="space-y-6">
                    {/* Stats row */}
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

                    {/* Category cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {CATEGORIES.map(cat => {
                            const catTasks = tasks.filter(t => t.category === cat.id);
                            const done = catTasks.filter(t => t.status === 'done').length;
                            const pct = catTasks.length ? Math.round((done / catTasks.length) * 100) : 0;
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
                                        <span className="text-xs text-muted-foreground">{done}/{catTasks.length} completed</span>
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

                    {/* High priority pending */}
                    {highPriorityPending.length > 0 && (
                        <div className="glass-card rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                <h3 className="font-semibold text-sm text-foreground">High-Priority Pending Tasks</h3>
                            </div>
                            <div className="space-y-2">
                                {highPriorityPending.map(task => (
                                    accessLevel === 'editor' ? (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            onUpdate={updateSharedTask}
                                            onUploadAttachment={async () => { toast.error("File upload is only supported for account holders."); return null; }}
                                        />
                                    ) : (
                                        <ReadOnlyTaskRow key={task.id} task={task} />
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent activity */}
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
        const catTasks = tasks.filter(t => t.category === (activeView as SEOCategory));
        const cat = CATEGORIES.find(c => c.id === activeView);
        const catDone = catTasks.filter(t => t.status === 'done').length;

        return (
            <div className="space-y-4">
                {cat && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">{cat.label}</h2>
                            <p className="text-sm text-muted-foreground">{cat.description}</p>
                            <div className="flex items-center gap-3 mt-2">
                                <Badge variant="secondary">{catDone}/{catTasks.length} completed</Badge>
                                <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-primary"
                                        style={{ width: `${catTasks.length ? (catDone / catTasks.length) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {catTasks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">No tasks in this category.</div>
                ) : (
                    <div className="space-y-2">
                        {catTasks.map(task => (
                            accessLevel === 'editor' ? (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onUpdate={updateSharedTask}
                                    onUploadAttachment={async () => { toast.error("File upload is only supported for account holders."); return null; }}
                                />
                            ) : (
                                <ReadOnlyTaskRow key={task.id} task={task} />
                            )
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background text-foreground relative selection:bg-primary/20">
            {/* Subtle background grid & glow */}
            <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0" />

            {/* Top bar */}
            <header className="border-b border-border/50 bg-background/60 backdrop-blur-2xl sticky top-0 z-50 transition-all duration-300">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-primary/60 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
                            <Search className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-sm font-bold text-foreground truncate">{project.name}</h1>
                            <p className="text-xs text-muted-foreground truncate">{project.domain}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {accessLevel === 'editor' ? (
                            <Badge variant="outline" className="hidden sm:flex border-warning/30 bg-warning/5 text-warning gap-1.5 shadow-sm">
                                <ShieldAlert className="h-3 w-3" />
                                Editor View
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="hidden sm:flex border-primary/30 bg-primary/5 text-primary gap-1.5 shadow-sm">
                                <Lock className="h-3 w-3" />
                                Read-Only View
                            </Badge>
                        )}
                        {project.industry && (
                            <Badge variant="secondary" className="hidden sm:flex shadow-sm bg-secondary/50">{project.industry}</Badge>
                        )}
                    </div>
                </div>
            </header>

            <div className={`relative z-10 border-b backdrop-blur-md ${accessLevel === 'editor' ? 'bg-warning/10 border-warning/20' : 'bg-primary/10 border-primary/20'}`}>
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2 overflow-x-auto">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {accessLevel === 'editor' ? <ShieldAlert className="h-3 w-3 text-warning" /> : <Lock className="h-3 w-3" />}
                        You're viewing a shared project — <strong className="text-foreground">{accessLevel === 'editor' ? 'editor mode' : 'read-only'}</strong>.
                        {project.clientName && <span>Client: <strong className="text-foreground">{project.clientName}</strong></span>}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Started {format(new Date(project.startDate), 'MMM d, yyyy')}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto flex relative z-10">
                {/* Sidebar */}
                <aside className="hidden md:block w-56 lg:w-64 border-r border-border/40 min-h-[calc(100vh-6.5rem)] p-4 space-y-1.5 sticky top-[5.5rem] self-start bg-background/30 backdrop-blur-sm">
                    {navItems.map(item => {
                        const isCategory = item.id !== 'dashboard' && item.id !== 'timeline';
                        const catTasks = isCategory ? tasks.filter(t => t.category === item.id as SEOCategory) : [];
                        const catDone = catTasks.filter(t => t.status === 'done').length;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.id)}
                                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative group overflow-hidden ${activeView === item.id
                                        ? 'text-primary shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                            >
                                {activeView === item.id && (
                                    <motion.div
                                        layoutId="activeNavBackground"
                                        className="absolute inset-0 bg-primary/10 rounded-xl"
                                        initial={false}
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className={`relative z-10 transition-colors ${activeView === item.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                    {item.icon}
                                </span>
                                <span className="relative z-10 flex-1 text-left">{item.label}</span>
                                {isCategory && (
                                    <span className="relative z-10 text-xs font-semibold bg-background/50 px-2 py-0.5 rounded-full border border-border/50 shadow-sm opacity-80 group-hover:opacity-100 transition-opacity">
                                        {catDone}/{catTasks.length}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </aside>

                {/* Mobile nav */}
                <div className="md:hidden sticky top-[5.5rem] z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 overflow-x-auto w-full flex scrollbar-hide">
                    <div className="flex gap-2 p-3 min-w-max">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveView(item.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shadow-sm border ${activeView === item.id
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-card text-muted-foreground hover:bg-muted border-border/50'
                                    }`}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main content */}
                <motion.main
                    key={activeView}
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.3 }}
                    className="flex-1 p-4 sm:p-6 lg:p-10 min-w-0 pb-20"
                >
                    {renderContent()}
                </motion.main>
            </div>
        </div>
    );
}

// Compact read-only task row
function ReadOnlyTaskRow({ task }: { task: SEOTask }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl overflow-hidden"
        >
            <button
                className="w-full text-left p-4 flex items-start gap-3"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Status indicator */}
                <div className={`mt-0.5 flex-shrink-0 w-2.5 h-2.5 rounded-full border ${task.status === 'done' ? 'bg-success border-success' :
                    task.status === 'in-progress' ? 'bg-info border-info' :
                        task.status === 'skipped' ? 'bg-muted border-muted-foreground/30' :
                            'border-muted-foreground/40 bg-transparent'
                    }`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium text-foreground ${task.status === 'skipped' ? 'line-through opacity-50' : ''}`}>
                            {task.title}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[task.status]}`}>
                            {statusLabels[task.status]}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${impactColors[task.expectedImpact]}`}>
                            {task.expectedImpact} impact
                        </span>
                    </div>
                    {!expanded && task.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{task.description}</p>
                    )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                    {expanded ? '▲' : '▼'}
                </span>
            </button>

            {expanded && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3"
                >
                    {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                    )}
                    {task.whyItMatters && (
                        <div>
                            <p className="text-xs font-semibold text-foreground mb-1">Why it matters</p>
                            <p className="text-xs text-muted-foreground">{task.whyItMatters}</p>
                        </div>
                    )}
                    {task.notes && (
                        <div>
                            <p className="text-xs font-semibold text-foreground mb-1">Notes</p>
                            <p className="text-xs text-muted-foreground">{task.notes}</p>
                        </div>
                    )}
                    {task.completionDate && (
                        <p className="text-xs text-success flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Completed {format(new Date(task.completionDate), 'MMM d, yyyy')}
                        </p>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
}
