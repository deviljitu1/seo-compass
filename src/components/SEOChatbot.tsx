import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { SEOProject, SEOTask, TaskHistoryEntry, CATEGORIES } from '@/types/seo';

interface SEOChatbotProps {
  project: SEOProject;
  tasks: SEOTask[];
  history: TaskHistoryEntry[];
  score: number;
}

type Msg = { role: 'user' | 'assistant'; content: string };

function buildProjectContext(project: SEOProject, tasks: SEOTask[], history: TaskHistoryEntry[], score: number): string {
  const stats = {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    notStarted: tasks.filter(t => t.status === 'not-started').length,
    skipped: tasks.filter(t => t.status === 'skipped').length,
  };

  const categoryBreakdown = CATEGORIES.map(cat => {
    const catTasks = tasks.filter(t => t.category === cat.id);
    const done = catTasks.filter(t => t.status === 'done').length;
    const inProgress = catTasks.filter(t => t.status === 'in-progress').length;
    const notStarted = catTasks.filter(t => t.status === 'not-started').length;
    return `${cat.label}: ${done}/${catTasks.length} done, ${inProgress} in progress, ${notStarted} not started`;
  }).join('\n');

  const notStartedTasks = tasks
    .filter(t => t.status === 'not-started')
    .map(t => `- [${t.priority}] [${t.expectedImpact} impact] ${t.title} (${CATEGORIES.find(c => c.id === t.category)?.label})`)
    .join('\n');

  const inProgressTasks = tasks
    .filter(t => t.status === 'in-progress')
    .map(t => `- ${t.title} (${CATEGORIES.find(c => c.id === t.category)?.label}) - ${t.timeSpentMinutes}min spent`)
    .join('\n');

  const doneTasks = tasks
    .filter(t => t.status === 'done')
    .map(t => `- ${t.title} (${CATEGORIES.find(c => c.id === t.category)?.label})`)
    .join('\n');

  const recentActivity = history.slice(0, 10).map(h =>
    `- ${h.taskTitle}: ${h.oldStatus} → ${h.newStatus} (${h.changeDate})`
  ).join('\n');

  return `Project: ${project.name}
Domain: ${project.domain}
Client: ${project.clientName || 'N/A'}
Industry: ${project.industry || 'General'}
SEO Score: ${score}%

Stats: ${stats.done}/${stats.total} tasks done, ${stats.inProgress} in progress, ${stats.notStarted} not started, ${stats.skipped} skipped

Category Breakdown:
${categoryBreakdown}

Currently In Progress:
${inProgressTasks || 'None'}

Completed Tasks:
${doneTasks || 'None'}

Not Started Tasks (prioritized):
${notStartedTasks || 'None'}

Recent Activity:
${recentActivity || 'No activity yet'}`;
}

export function SEOChatbot({ project, tasks, history, score }: SEOChatbotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const projectContext = buildProjectContext(project, tasks, history, score);
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seo-chat`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          projectContext,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({ error: 'Unknown error' }));
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errData.error || 'Failed to get response'}` }]);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantSoFar = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const current = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: current } : m);
                }
                return [...prev, { role: 'assistant', content: current }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection error. Please try again.' }]);
    }
    setIsLoading(false);
  };

  const quickActions = [
    'What should I work on next?',
    'Give me a progress summary',
    'Which tasks are highest priority?',
  ];

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center glow-primary"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">SEO Assistant</h3>
                  <p className="text-xs text-muted-foreground">{project.name}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <div className="bg-secondary rounded-xl rounded-tl-sm px-3 py-2 text-sm text-foreground">
                      Hi! I'm your SEO assistant for <strong>{project.name}</strong>. I can see all your tasks, progress, and history. Ask me anything!
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-9">
                    {quickActions.map(q => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); }}
                        className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === 'user' ? 'bg-primary/15 text-primary' : 'gradient-primary text-primary-foreground'
                  }`}>
                    {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-secondary text-foreground rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <div className="bg-secondary rounded-xl rounded-tl-sm px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <form
                onSubmit={e => { e.preventDefault(); sendMessage(); }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask about your SEO project..."
                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  disabled={isLoading}
                />
                <Button type="submit" size="sm" className="h-9 w-9 p-0" disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
