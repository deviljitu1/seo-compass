import { useState, useRef } from 'react';
import { SEOTask, TaskStatus } from '@/types/seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Clock, ExternalLink, AlertTriangle, CheckCircle2, Circle, Pause, SkipForward, Upload, ImageIcon, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskCardProps {
  task: SEOTask;
  onUpdate: (taskId: string, updates: Partial<SEOTask>) => void;
  onUploadAttachment?: (taskId: string, file: File) => Promise<string | null>;
  onDeleteAttachment?: (taskId: string, url: string) => void;
}

const statusConfig: Record<TaskStatus, { label: string; icon: React.ReactNode; className: string }> = {
  'not-started': { label: 'Not Started', icon: <Circle className="h-3.5 w-3.5" />, className: 'bg-muted text-muted-foreground' },
  'in-progress': { label: 'In Progress', icon: <Pause className="h-3.5 w-3.5" />, className: 'bg-info/20 text-info' },
  'done': { label: 'Done', icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: 'bg-success/20 text-success' },
  'skipped': { label: 'Skipped', icon: <SkipForward className="h-3.5 w-3.5" />, className: 'bg-muted text-muted-foreground' },
};

const impactConfig = {
  high: { label: 'High Impact', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  medium: { label: 'Medium Impact', className: 'bg-warning/15 text-warning border-warning/30' },
  low: { label: 'Low Impact', className: 'bg-muted text-muted-foreground border-border' },
};

export function TaskCard({ task, onUpdate, onUploadAttachment, onDeleteAttachment }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = statusConfig[task.status];
  const impact = impactConfig[task.expectedImpact];
  const attachments = task.attachments || [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadAttachment) return;
    setUploading(true);
    await onUploadAttachment(task.id, file);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <motion.div
      layout
      className={`glass-card rounded-lg overflow-hidden transition-all ${
        task.status === 'done' ? 'opacity-70' : ''
      }`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
          {status.icon}
          {status.label}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.title}
          </h4>
        </div>
        {attachments.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <ImageIcon className="h-3 w-3" />
            {attachments.length}
          </span>
        )}
        <Badge variant="outline" className={`text-xs ${impact.className}`}>
          {impact.label}
        </Badge>
        {task.timeSpentMinutes > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {task.timeSpentMinutes}m
          </span>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
              <p className="text-sm text-muted-foreground">{task.description}</p>

              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="text-xs font-semibold text-warning uppercase tracking-wide">Why It Matters</span>
                </div>
                <p className="text-sm text-foreground/80">{task.whyItMatters}</p>
              </div>

              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Execution Steps</h5>
                <ol className="space-y-1.5">
                  {task.executionSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tools Required</h5>
                <div className="flex flex-wrap gap-1.5">
                  {task.toolsRequired.map(tool => (
                    <Badge key={tool} variant="secondary" className="text-xs">{tool}</Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={task.status} onValueChange={(v: TaskStatus) => onUpdate(task.id, { status: v })}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not-started">Not Started</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="skipped">Skipped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Time Spent (min)</label>
                  <Input
                    type="number"
                    className="h-9 text-sm"
                    value={task.timeSpentMinutes || ''}
                    onChange={e => onUpdate(task.id, { timeSpentMinutes: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Proof URL</label>
                <div className="flex gap-2">
                  <Input
                    className="h-9 text-sm flex-1"
                    value={task.proofUrl}
                    onChange={e => onUpdate(task.id, { proofUrl: e.target.value })}
                    placeholder="Screenshot or document URL..."
                  />
                  {task.proofUrl && (
                    <Button variant="outline" size="sm" className="h-9" onClick={() => window.open(task.proofUrl, '_blank')}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Attachments / Screenshots */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Screenshots & Attachments
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </Button>
                </div>

                {attachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {attachments.map((url, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-border bg-secondary/30">
                        <img
                          src={url}
                          alt={`Attachment ${i + 1}`}
                          className="w-full h-24 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(url, '_blank')}
                        />
                        {onDeleteAttachment && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteAttachment(task.id, url); }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {attachments.length === 0 && (
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">
                      Click to upload screenshots, charts, or audit evidence
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <Textarea
                  className="text-sm min-h-[80px] resize-none"
                  value={task.notes}
                  onChange={e => onUpdate(task.id, { notes: e.target.value })}
                  placeholder="Add your notes here..."
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
