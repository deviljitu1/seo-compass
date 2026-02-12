import { useState } from 'react';
import { SEOProject, SEOTask, TaskHistoryEntry, CATEGORIES, SEOCategory } from '@/types/seo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileDown, FileText, Clock, CheckCircle2, TrendingUp, BarChart3 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface SEOReportExportProps {
  project: SEOProject;
  tasks: SEOTask[];
  history: TaskHistoryEntry[];
  score: number;
}

export function SEOReportExport({ project, tasks, history, score }: SEOReportExportProps) {
  const [open, setOpen] = useState(false);
  const [includeEmployerProof, setIncludeEmployerProof] = useState(true);
  const [includeTaskDetails, setIncludeTaskDetails] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [generating, setGenerating] = useState(false);

  const stats = {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    notStarted: tasks.filter(t => t.status === 'not-started').length,
    skipped: tasks.filter(t => t.status === 'skipped').length,
    totalTime: tasks.reduce((sum, t) => sum + t.timeSpentMinutes, 0),
    highImpactDone: tasks.filter(t => t.status === 'done' && t.expectedImpact === 'high').length,
    highImpactTotal: tasks.filter(t => t.expectedImpact === 'high').length,
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      // Header
      doc.setFillColor(219, 39, 119); // pink-600
      doc.rect(0, 0, pageWidth, 45, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('SEO AUDIT REPORT', 14, 22);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`${project.name} — ${project.domain}`, 14, 32);
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, 14, 40);

      y = 55;

      // Project Info
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const infoLines = [
        `Client: ${project.clientName || 'N/A'}`,
        `Industry: ${project.industry || 'General'}`,
        `Start Date: ${format(new Date(project.startDate), 'MMMM d, yyyy')}`,
      ];
      infoLines.forEach(line => {
        doc.text(line, 14, y);
        y += 6;
      });
      y += 5;

      // Score Section
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(14, y, pageWidth - 28, 35, 3, 3, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(219, 39, 119);
      doc.text(`SEO Health Score: ${score}%`, 22, y + 14);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${stats.done}/${stats.total} tasks completed • ${stats.inProgress} in progress • ${formatTime(stats.totalTime)} invested`, 22, y + 26);
      y += 45;

      // Category Breakdown
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 51, 51);
      doc.text('Category Breakdown', 14, y);
      y += 8;

      const catData = CATEGORIES.map(cat => {
        const catTasks = tasks.filter(t => t.category === cat.id);
        const catDone = catTasks.filter(t => t.status === 'done').length;
        const catTime = catTasks.reduce((s, t) => s + t.timeSpentMinutes, 0);
        const pct = catTasks.length ? Math.round((catDone / catTasks.length) * 100) : 0;
        return [cat.label, `${catDone}/${catTasks.length}`, `${pct}%`, formatTime(catTime)];
      });

      autoTable(doc, {
        startY: y,
        head: [['Category', 'Progress', 'Completion', 'Time Invested']],
        body: catData,
        theme: 'grid',
        headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [51, 51, 51] },
        alternateRowStyles: { fillColor: [252, 231, 243] },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 15;

      // Task Details
      if (includeTaskDetails) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 51, 51);
        doc.text('Task Details', 14, y);
        y += 8;

        CATEGORIES.forEach(cat => {
          const catTasks = tasks.filter(t => t.category === cat.id);
          if (catTasks.length === 0) return;

          if (y > 250) { doc.addPage(); y = 20; }

          const taskRows = catTasks.map(t => [
            t.title,
            t.expectedImpact.charAt(0).toUpperCase() + t.expectedImpact.slice(1),
            t.status === 'not-started' ? 'Not Started' : t.status === 'in-progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1),
            formatTime(t.timeSpentMinutes),
            t.notes ? t.notes.substring(0, 60) + (t.notes.length > 60 ? '...' : '') : '—',
          ]);

          autoTable(doc, {
            startY: y,
            head: [[`${cat.label}`, 'Impact', 'Status', 'Time', 'Notes']],
            body: taskRows,
            theme: 'striped',
            headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
            columnStyles: {
              0: { cellWidth: 55 },
              1: { cellWidth: 20 },
              2: { cellWidth: 22 },
              3: { cellWidth: 18 },
              4: { cellWidth: 'auto' },
            },
            margin: { left: 14, right: 14 },
          });

          y = (doc as any).lastAutoTable.finalY + 10;
        });
      }

      // Employer Proof Mode
      if (includeEmployerProof) {
        doc.addPage();
        y = 20;

        doc.setFillColor(219, 39, 119);
        doc.rect(0, 0, pageWidth, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('EMPLOYER PROOF — WORK SUMMARY', 14, 18);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${project.name} • ${format(new Date(), 'MMMM d, yyyy')}`, 14, 28);

        y = 45;

        // Work Summary Stats
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(14, y, pageWidth - 28, 50, 3, 3, 'F');

        doc.setTextColor(219, 39, 119);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(`${stats.done}`, 30, y + 18);
        doc.text(formatTime(stats.totalTime), 80, y + 18);
        doc.text(`${score}%`, 145, y + 18);

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('Tasks Completed', 30, y + 28);
        doc.text('Time Invested', 80, y + 28);
        doc.text('SEO Score Achieved', 145, y + 28);

        doc.setFontSize(9);
        doc.setTextColor(51, 51, 51);
        doc.text(`High-impact tasks: ${stats.highImpactDone}/${stats.highImpactTotal} completed`, 30, y + 42);
        doc.text(`Completion rate: ${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}%`, 120, y + 42);

        y += 60;

        // Completed Work Log
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 51, 51);
        doc.text('Completed Work Log', 14, y);
        y += 8;

        const completedTasks = tasks
          .filter(t => t.status === 'done')
          .sort((a, b) => (b.completionDate || '').localeCompare(a.completionDate || ''));

        if (completedTasks.length > 0) {
          const completedRows = completedTasks.map(t => {
            const cat = CATEGORIES.find(c => c.id === t.category);
            return [
              t.title,
              cat?.label || t.category,
              t.expectedImpact.charAt(0).toUpperCase() + t.expectedImpact.slice(1),
              formatTime(t.timeSpentMinutes),
              t.completionDate ? format(new Date(t.completionDate), 'MMM d, yyyy') : '—',
              t.proofUrl ? 'Yes' : '—',
            ];
          });

          autoTable(doc, {
            startY: y,
            head: [['Task', 'Category', 'Impact', 'Time', 'Completed', 'Evidence']],
            body: completedRows,
            theme: 'grid',
            headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
            margin: { left: 14, right: 14 },
          });

          y = (doc as any).lastAutoTable.finalY + 15;
        }

        // Evidence Links
        const tasksWithProof = completedTasks.filter(t => t.proofUrl);
        if (tasksWithProof.length > 0) {
          if (y > 240) { doc.addPage(); y = 20; }
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Evidence & Documentation Links', 14, y);
          y += 8;

          const proofRows = tasksWithProof.map(t => [t.title, t.proofUrl]);
          autoTable(doc, {
            startY: y,
            head: [['Task', 'Proof URL']],
            body: proofRows,
            theme: 'striped',
            headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
            columnStyles: { 1: { cellWidth: 100 } },
            margin: { left: 14, right: 14 },
          });
          y = (doc as any).lastAutoTable.finalY + 15;
        }

        // Notes Summary
        const tasksWithNotes = completedTasks.filter(t => t.notes);
        if (tasksWithNotes.length > 0) {
          if (y > 240) { doc.addPage(); y = 20; }
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Work Notes & Observations', 14, y);
          y += 8;

          const noteRows = tasksWithNotes.map(t => [t.title, t.notes]);
          autoTable(doc, {
            startY: y,
            head: [['Task', 'Notes']],
            body: noteRows,
            theme: 'striped',
            headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
            columnStyles: { 1: { cellWidth: 120 } },
            margin: { left: 14, right: 14 },
          });
        }
      }

      // Timeline
      if (includeTimeline && history.length > 0) {
        doc.addPage();
        y = 20;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 51, 51);
        doc.text('Activity Timeline', 14, y);
        y += 8;

        const timelineRows = history.slice(0, 50).map(h => {
          const cat = CATEGORIES.find(c => c.id === h.category);
          return [
            format(new Date(h.changeDate), 'MMM d, yyyy HH:mm'),
            h.taskTitle,
            cat?.label || h.category,
            `${h.oldStatus.replace('-', ' ')} → ${h.newStatus.replace('-', ' ')}`,
            h.notes || '—',
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [['Date', 'Task', 'Category', 'Status Change', 'Notes']],
          body: timelineRows,
          theme: 'grid',
          headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `SEO Command Center — ${project.name} — Page ${i} of ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }

      doc.save(`SEO-Report-${project.name.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setGenerating(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Category', 'Task', 'Impact', 'Priority', 'Status', 'Time (min)', 'Completion Date', 'Notes', 'Proof URL'];
    const rows = tasks.map(t => {
      const cat = CATEGORIES.find(c => c.id === t.category);
      return [
        cat?.label || t.category,
        t.title,
        t.expectedImpact,
        t.priority,
        t.status,
        t.timeSpentMinutes.toString(),
        t.completionDate || '',
        `"${(t.notes || '').replace(/"/g, '""')}"`,
        t.proofUrl,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SEO-Tasks-${project.name.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileDown className="h-4 w-4" />
          Export Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Export SEO Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Preview Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{stats.done}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <Clock className="h-5 w-5 text-info mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{formatTime(stats.totalTime)}</div>
              <div className="text-xs text-muted-foreground">Invested</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold text-foreground">{score}%</div>
              <div className="text-xs text-muted-foreground">SEO Score</div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="employer-proof" className="text-sm">Employer Proof Mode</Label>
              </div>
              <Switch id="employer-proof" checked={includeEmployerProof} onCheckedChange={setIncludeEmployerProof} />
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Adds a dedicated page with work completed, time invested, evidence links, and score improvements.
            </p>

            <div className="flex items-center justify-between">
              <Label htmlFor="task-details" className="text-sm">Include Task Details</Label>
              <Switch id="task-details" checked={includeTaskDetails} onCheckedChange={setIncludeTaskDetails} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="timeline" className="text-sm">Include Activity Timeline</Label>
              <Switch id="timeline" checked={includeTimeline} onCheckedChange={setIncludeTimeline} />
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={generatePDF}
              disabled={generating}
              className="flex-1 gap-2"
            >
              <FileDown className="h-4 w-4" />
              {generating ? 'Generating...' : 'Export PDF'}
            </Button>
            <Button
              variant="outline"
              onClick={exportCSV}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
