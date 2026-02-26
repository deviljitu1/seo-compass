import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Download, Calendar as CalendarIcon, FileDown, FileText, Clock, CheckCircle2, TrendingUp, BarChart3 } from "lucide-react";
import { useSEOStore } from "@/stores/seoStore";
import { SEOProject, SEOTask, TaskHistoryEntry, TaskStatus, SEOCategory, CATEGORIES } from "@/types/seo";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportReportDialogProps {
    project: SEOProject;
    tasks?: SEOTask[];
    history?: TaskHistoryEntry[];
    score?: number;
}

type PeriodType = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "allTime" | "custom";

type ExportTab = "pdf" | "csv-activity";

export function ExportReportDialog({ project, tasks: propTasks, history: propHistory, score: propScore }: ExportReportDialogProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ExportTab>("pdf");

    // PDF State
    const [includeEmployerProof, setIncludeEmployerProof] = useState(true);
    const [includeTaskDetails, setIncludeTaskDetails] = useState(true);
    const [includeTimeline, setIncludeTimeline] = useState(true);
    const [generating, setGenerating] = useState(false);

    // CSV Activity State
    const [period, setPeriod] = useState<PeriodType>("allTime");
    const [date, setDate] = useState<DateRange | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
    const [categoryFilter, setCategoryFilter] = useState<SEOCategory | "all">("all");
    const [groupByDate, setGroupByDate] = useState(false);

    const { getProjectHistory, getProjectScore, getStats, tasks: storeTasks } = useSEOStore();

    const tasks = propTasks ?? storeTasks.filter(t => t.projectId === project.id);
    const history = propHistory ?? getProjectHistory(project.id);
    const score = propScore ?? getProjectScore(project.id);

    const stats = {
        total: tasks.length,
        done: tasks.filter(t => t.status === "done").length,
        inProgress: tasks.filter(t => t.status === "in-progress").length,
        notStarted: tasks.filter(t => t.status === "not-started").length,
        totalTime: tasks.reduce((sum, t) => sum + t.timeSpentMinutes, 0),
        highImpactDone: tasks.filter(t => t.status === "done" && t.expectedImpact === "high").length,
        highImpactTotal: tasks.filter(t => t.expectedImpact === "high").length,
    };

    const formatTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins}m`;
        return `${hours}h ${mins}m`;
    };

    const handlePeriodChange = (value: PeriodType) => {
        setPeriod(value);
        const today = new Date();
        switch (value) {
            case "today": setDate({ from: today, to: today }); break;
            case "yesterday": { const yest = subDays(today, 1); setDate({ from: yest, to: yest }); break; }
            case "last7": setDate({ from: subDays(today, 6), to: today }); break;
            case "last30": setDate({ from: subDays(today, 29), to: today }); break;
            case "thisMonth": setDate({ from: startOfMonth(today), to: endOfMonth(today) }); break;
            case "allTime": setDate(undefined); break;
            case "custom": if (!date?.from) setDate({ from: today, to: today }); break;
        }
    };

    const generatePDF = async () => {
        setGenerating(true);
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            let y = 20;

            doc.setFillColor(219, 39, 119);
            doc.rect(0, 0, pageWidth, 45, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text("SEO AUDIT REPORT", 14, 22);
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.text(`${project.name} — ${project.domain}`, 14, 32);
            doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy")}`, 14, 40);

            y = 55;
            doc.setTextColor(51, 51, 51);
            doc.setFontSize(10);
            const infoLines = [
                `Client: ${project.clientName || "N/A"}`,
                `Industry: ${project.industry || "General"}`,
                `Start Date: ${format(new Date(project.startDate), "MMMM d, yyyy")}`,
            ];
            infoLines.forEach(line => {
                doc.text(line, 14, y);
                y += 6;
            });
            y += 5;

            doc.setFillColor(249, 250, 251);
            doc.roundedRect(14, y, pageWidth - 28, 35, 3, 3, "F");
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(219, 39, 119);
            doc.text(`SEO Health Score: ${score}%`, 22, y + 14);
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`${stats.done}/${stats.total} tasks completed • ${stats.inProgress} in progress • ${formatTime(stats.totalTime)} invested`, 22, y + 26);
            y += 45;

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(51, 51, 51);
            doc.text("Category Breakdown", 14, y);
            y += 8;

            const catData = CATEGORIES.map(cat => {
                const catTasks = tasks.filter(t => t.category === cat.id);
                const catDone = catTasks.filter(t => t.status === "done").length;
                const catTime = catTasks.reduce((s, t) => s + t.timeSpentMinutes, 0);
                const pct = catTasks.length ? Math.round((catDone / catTasks.length) * 100) : 0;
                return [cat.label, `${catDone}/${catTasks.length}`, `${pct}%`, formatTime(catTime)];
            });

            autoTable(doc, {
                startY: y,
                head: [["Category", "Progress", "Completion", "Time Invested"]],
                body: catData,
                theme: "grid",
                headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 9 },
                bodyStyles: { fontSize: 9, textColor: [51, 51, 51] },
                alternateRowStyles: { fillColor: [252, 231, 243] },
                margin: { left: 14, right: 14 },
            });

            y = (doc as any).lastAutoTable.finalY + 15;

            if (includeTaskDetails) {
                if (y > 240) { doc.addPage(); y = 20; }
                doc.setFontSize(14);
                doc.text("Task Details", 14, y);
                y += 8;

                CATEGORIES.forEach(cat => {
                    const catTasks = tasks.filter(t => t.category === cat.id);
                    if (catTasks.length === 0) return;

                    if (y > 250) { doc.addPage(); y = 20; }

                    const taskRows = catTasks.map(t => [
                        t.title,
                        t.expectedImpact.charAt(0).toUpperCase() + t.expectedImpact.slice(1),
                        t.status === "not-started" ? "Not Started" : t.status === "in-progress" ? "In Progress" : t.status.charAt(0).toUpperCase() + t.status.slice(1),
                        formatTime(t.timeSpentMinutes),
                        t.notes ? t.notes.substring(0, 60) + (t.notes.length > 60 ? "..." : "") : "—",
                    ]);

                    autoTable(doc, {
                        startY: y,
                        head: [[`${cat.label}`, "Impact", "Status", "Time", "Notes"]],
                        body: taskRows,
                        theme: "striped",
                        headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
                        bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
                        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 20 }, 2: { cellWidth: 22 }, 3: { cellWidth: 18 }, 4: { cellWidth: "auto" } },
                        margin: { left: 14, right: 14 },
                    });

                    y = (doc as any).lastAutoTable.finalY + 10;
                });
            }

            if (includeEmployerProof) {
                doc.addPage();
                y = 20;

                doc.setFillColor(219, 39, 119);
                doc.rect(0, 0, pageWidth, 35, "F");
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(18);
                doc.text("EMPLOYER PROOF — WORK SUMMARY", 14, 18);
                doc.setFontSize(10);
                doc.text(`${project.name} • ${format(new Date(), "MMMM d, yyyy")}`, 14, 28);

                y = 45;
                doc.setFillColor(249, 250, 251);
                doc.roundedRect(14, y, pageWidth - 28, 50, 3, 3, "F");

                doc.setTextColor(219, 39, 119);
                doc.setFontSize(24);
                doc.text(`${stats.done}`, 30, y + 18);
                doc.text(formatTime(stats.totalTime), 80, y + 18);
                doc.text(`${score}%`, 145, y + 18);

                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text("Tasks Completed", 30, y + 28);
                doc.text("Time Invested", 80, y + 28);
                doc.text("SEO Score Achieved", 145, y + 28);

                doc.setFontSize(9);
                doc.setTextColor(51, 51, 51);
                doc.text(`High-impact tasks: ${stats.highImpactDone}/${stats.highImpactTotal} completed`, 30, y + 42);
                doc.text(`Completion rate: ${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}%`, 120, y + 42);

                y += 60;
                doc.setFontSize(14);
                doc.text("Completed Work Log", 14, y);
                y += 8;

                const completedTasks = tasks.filter(t => t.status === "done").sort((a, b) => (b.completionDate || "").localeCompare(a.completionDate || ""));

                if (completedTasks.length > 0) {
                    const completedRows = completedTasks.map(t => {
                        const cat = CATEGORIES.find(c => c.id === t.category);
                        return [
                            t.title,
                            cat?.label || t.category,
                            t.expectedImpact.charAt(0).toUpperCase() + t.expectedImpact.slice(1),
                            formatTime(t.timeSpentMinutes),
                            t.completionDate ? format(new Date(t.completionDate), "MMM d, yyyy") : "—",
                            t.proofUrl ? "Yes" : "—",
                        ];
                    });

                    autoTable(doc, {
                        startY: y,
                        head: [["Task", "Category", "Impact", "Time", "Completed", "Evidence"]],
                        body: completedRows,
                        theme: "grid",
                        headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
                        bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
                        margin: { left: 14, right: 14 },
                    });

                    y = (doc as any).lastAutoTable.finalY + 15;
                }

                const tasksWithProof = completedTasks.filter(t => t.proofUrl);
                if (tasksWithProof.length > 0) {
                    if (y > 240) { doc.addPage(); y = 20; }
                    doc.setFontSize(14);
                    doc.text("Evidence & Documentation Links", 14, y);
                    y += 8;

                    const proofRows = tasksWithProof.map(t => [t.title, t.proofUrl]);
                    autoTable(doc, {
                        startY: y,
                        head: [["Task", "Proof URL"]],
                        body: proofRows,
                        theme: "striped",
                        headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
                        bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
                        columnStyles: { 1: { cellWidth: 100 } },
                        margin: { left: 14, right: 14 },
                    });
                    y = (doc as any).lastAutoTable.finalY + 15;
                }

                const tasksWithNotes = completedTasks.filter(t => t.notes);
                if (tasksWithNotes.length > 0) {
                    if (y > 240) { doc.addPage(); y = 20; }
                    doc.setFontSize(14);
                    doc.text("Work Notes & Observations", 14, y);
                    y += 8;

                    const noteRows = tasksWithNotes.map(t => [t.title, t.notes]);
                    autoTable(doc, {
                        startY: y,
                        head: [["Task", "Notes"]],
                        body: noteRows,
                        theme: "striped",
                        headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
                        bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
                        columnStyles: { 1: { cellWidth: 120 } },
                        margin: { left: 14, right: 14 },
                    });
                }
            }

            if (includeTimeline && history.length > 0) {
                doc.addPage();
                y = 20;

                doc.setFontSize(14);
                doc.text("Activity Timeline", 14, y);
                y += 8;

                const timelineRows = history.slice(0, 50).map(h => {
                    const cat = CATEGORIES.find(c => c.id === h.category);
                    return [
                        format(new Date(h.changeDate), "MMM d, yyyy HH:mm"),
                        h.taskTitle,
                        cat?.label || h.category,
                        `${h.oldStatus.replace("-", " ")} → ${h.newStatus.replace("-", " ")}`,
                        h.notes || "—",
                    ];
                });

                autoTable(doc, {
                    startY: y,
                    head: [["Date", "Task", "Category", "Status Change", "Notes"]],
                    body: timelineRows,
                    theme: "grid",
                    headStyles: { fillColor: [219, 39, 119], textColor: [255, 255, 255], fontSize: 8 },
                    bodyStyles: { fontSize: 7, textColor: [51, 51, 51] },
                    margin: { left: 14, right: 14 },
                });
            }

            const totalPages = doc.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(150, 150, 150);
                doc.text(`SEO Command Center — ${project.name} — Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
            }

            doc.save(`SEO-Report-${project.name.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            setGenerating(false);
            setOpen(false);
        }
    };

    const exportTasksCSV = () => {
        const headers = ["Category", "Task", "Impact", "Priority", "Status", "Time (min)", "Completion Date", "Notes", "Proof URL"];
        const rows = tasks.map(t => {
            const cat = CATEGORIES.find(c => c.id === t.category);
            return [
                cat?.label || t.category,
                t.title,
                t.expectedImpact,
                t.priority,
                t.status,
                t.timeSpentMinutes.toString(),
                t.completionDate || "",
                `"${(t.notes || "").replace(/"/g, '""')}"`,
                t.proofUrl,
            ].join(",");
        });

        const csv = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `SEO-Tasks-${project.name.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setOpen(false);
    };

    const handleExportActivityLog = () => {
        let filteredHistory = history.filter((h) => {
            if (period !== "allTime") {
                if (!date?.from) return false;
                const changeDate = new Date(h.changeDate);
                const from = startOfDay(date.from);
                const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
                if (!isWithinInterval(changeDate, { start: from, end: to })) return false;
            }
            if (statusFilter !== "all" && h.newStatus !== statusFilter) return false;
            if (categoryFilter !== "all" && h.category !== categoryFilter) return false;
            return true;
        });

        filteredHistory.sort((a, b) => new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime());

        const headers = ["Date", "Task ID", "Task Title", "Category", "Action", "Old Status", "New Status", "User", "Notes"];

        const escapeCsv = (str: string | undefined | null) => {
            if (!str) return "";
            const stringValue = String(str);
            const needsQuotes = stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"');
            if (needsQuotes) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };

        let rows: string[][] = [];
        let lastDate = "";

        filteredHistory.forEach((h) => {
            const dateStr = format(new Date(h.changeDate), "yyyy-MM-dd");
            if (groupByDate && dateStr !== lastDate) {
                rows.push([`--- ${dateStr} ---`, "", "", "", "", "", "", "", ""]);
                lastDate = dateStr;
            }
            rows.push([
                format(new Date(h.changeDate), "yyyy-MM-dd HH:mm:ss"),
                h.taskId,
                h.taskTitle,
                h.category,
                "Status Update",
                h.oldStatus,
                h.newStatus,
                h.changedBy,
                escapeCsv(h.notes)
            ]);
        });

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(",") + "\r\n";
        rows.forEach((row) => {
            csvContent += row.map((e) => escapeCsv(e)).join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);

        let filename = `${project.name.replace(/\s+/g, "_")}_activity_log`;
        if (period !== "allTime" && date?.from) {
            filename += `_${format(date.from, "yyyy-MM-dd")}`;
            if (date.to && !isSameDay(date.from, date.to)) {
                filename += `_to_${format(date.to, "yyyy-MM-dd")}`;
            }
        } else if (period === "allTime") {
            filename += "_all_time";
        }

        filename += ".csv";
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <FileDown className="h-4 w-4" />
                    <span className="hidden sm:inline">Export Report</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Export Project Data
                    </DialogTitle>
                    <DialogDescription>
                        Generate PDF reports or export your data to CSV.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ExportTab)} className="w-full mt-2">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="pdf">Full Report (PDF / Tasks)</TabsTrigger>
                        <TabsTrigger value="csv-activity">Activity Log (CSV)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pdf" className="space-y-5 pt-4">
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
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <Label htmlFor="employer-proof" className="text-sm">Employer Proof Mode (PDF)</Label>
                                        <p className="text-xs text-muted-foreground">Adds time tracking and evidence links.</p>
                                    </div>
                                </div>
                                <Switch id="employer-proof" checked={includeEmployerProof} onCheckedChange={setIncludeEmployerProof} />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="task-details" className="text-sm font-normal">Include Task Details (PDF)</Label>
                                <Switch id="task-details" checked={includeTaskDetails} onCheckedChange={setIncludeTaskDetails} />
                            </div>

                            <div className="flex items-center justify-between">
                                <Label htmlFor="timeline" className="text-sm font-normal">Include Activity Timeline (PDF)</Label>
                                <Switch id="timeline" checked={includeTimeline} onCheckedChange={setIncludeTimeline} />
                            </div>
                        </div>

                        {/* Export Buttons */}
                        <div className="flex gap-3 pt-2 border-t">
                            <Button onClick={generatePDF} disabled={generating} className="flex-1 gap-2">
                                <FileDown className="h-4 w-4" />
                                {generating ? "Generating..." : "Export PDF Report"}
                            </Button>
                            <Button variant="outline" onClick={exportTasksCSV} className="gap-2">
                                <FileText className="h-4 w-4" />
                                All Tasks CSV
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="csv-activity" className="space-y-5 pt-4">
                        <div className="space-y-3">
                            <Label>Time Period</Label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: "today", label: "Today" },
                                    { id: "yesterday", label: "Yesterday" },
                                    { id: "last7", label: "Last 7 Days" },
                                    { id: "thisMonth", label: "This Month" },
                                    { id: "allTime", label: "All Time" },
                                    { id: "custom", label: "Custom Range" },
                                ].map((p) => (
                                    <Button
                                        key={p.id}
                                        size="sm"
                                        onClick={() => handlePeriodChange(p.id as PeriodType)}
                                        className={`h-8 ${period === p.id ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"}`}
                                    >
                                        {p.label}
                                    </Button>
                                ))}
                            </div>

                            {period === "custom" && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {date?.from ? (
                                                    date.to ? (
                                                        <>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>
                                                    ) : (
                                                        format(date.from, "LLL dd, y")
                                                    )
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                        </div>

                        {/* Filters */}
                        <div className="flex items-center space-x-2 pb-2">
                            <Checkbox id="groupByDate" checked={groupByDate} onCheckedChange={(checked) => setGroupByDate(checked === true)} />
                            <Label htmlFor="groupByDate">Group export by date</Label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Status Filter</Label>
                                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="done">Completed Only</SelectItem>
                                        <SelectItem value="in-progress">In Progress</SelectItem>
                                        <SelectItem value="not-started">Not Started</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as SEOCategory | "all")}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {CATEGORIES.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="pt-2 border-t">
                            <Button onClick={handleExportActivityLog} className="w-full gap-2">
                                <Download className="h-4 w-4" />
                                Download Activity CSV
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
