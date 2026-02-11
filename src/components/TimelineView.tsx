import { TaskHistoryEntry, CATEGORIES } from '@/types/seo';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, SkipForward, Play } from 'lucide-react';

interface TimelineViewProps {
  history: TaskHistoryEntry[];
}

const statusIcon = {
  'done': <CheckCircle2 className="h-4 w-4 text-success" />,
  'in-progress': <Play className="h-4 w-4 text-info" />,
  'skipped': <SkipForward className="h-4 w-4 text-muted-foreground" />,
  'not-started': <ArrowRight className="h-4 w-4 text-muted-foreground" />,
};

export function TimelineView({ history }: TimelineViewProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No activity yet</p>
        <p className="text-sm">Start working on tasks to see your timeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {history.map((entry, i) => {
        const cat = CATEGORIES.find(c => c.id === entry.category);
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-4 p-3 rounded-lg hover:bg-secondary/30 transition-colors"
          >
            <div className="flex-shrink-0 mt-1">
              {statusIcon[entry.newStatus]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {entry.taskTitle}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground capitalize">{entry.oldStatus.replace('-', ' ')}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground capitalize">{entry.newStatus.replace('-', ' ')}</span>
                {cat && <span className="text-xs text-muted-foreground">• {cat.label}</span>}
              </div>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {format(new Date(entry.changeDate), 'MMM d, yyyy HH:mm')}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
