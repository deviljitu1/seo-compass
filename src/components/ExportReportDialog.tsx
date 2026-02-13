import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Download, Calendar as CalendarIcon, Filter } from "lucide-react";
import { useSEOStore } from "@/stores/seoStore";
import { SEOProject, TaskStatus, SEOCategory, CATEGORIES } from "@/types/seo";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface ExportReportDialogProps {
    project: SEOProject;
}

type PeriodType = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "allTime" | "custom";

export function ExportReportDialog({ project }: ExportReportDialogProps) {
    const [open, setOpen] = useState(false);
    const [period, setPeriod] = useState<PeriodType>("today");
    const [date, setDate] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
    const [categoryFilter, setCategoryFilter] = useState<SEOCategory | "all">("all");

    const [groupByDate, setGroupByDate] = useState(false);

    const { getProjectHistory, tasks } = useSEOStore();

    const handlePeriodChange = (value: PeriodType) => {
        setPeriod(value);
        const today = new Date();

        switch (value) {
            case "today":
                setDate({ from: today, to: today });
                break;
            case "yesterday":
                const yest = subDays(today, 1);
                setDate({ from: yest, to: yest });
                break;
            case "last7":
                setDate({ from: subDays(today, 6), to: today });
                break;
            case "last30":
                setDate({ from: subDays(today, 29), to: today });
                break;
            case "thisMonth":
                setDate({ from: startOfMonth(today), to: endOfMonth(today) });
                break;
            case "allTime":
                setDate(undefined);
                break;
            case "custom":
                // Keep existing selection or default to today
                if (!date?.from) setDate({ from: today, to: today });
                break;
        }
    };

    const handleExport = () => {
        const history = getProjectHistory(project.id);

        let filteredHistory = history.filter((h) => {
            // Date Filter
            if (period !== "allTime") {
                if (!date?.from) return false;
                const changeDate = new Date(h.changeDate);
                const from = startOfDay(date.from);
                const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
                if (!isWithinInterval(changeDate, { start: from, end: to })) return false;
            }

            // Status Filter
            if (statusFilter !== "all" && h.newStatus !== statusFilter) {
                return false;
            }

            // Category Filter
            if (categoryFilter !== "all" && h.category !== categoryFilter) {
                return false;
            }

            return true;
        });

        // Sort by date descending
        filteredHistory.sort((a, b) => new Date(b.changeDate).getTime() - new Date(a.changeDate).getTime());

        // Generate CSV
        const headers = [
            "Date",
            "Task ID",
            "Task Title",
            "Category",
            "Action",
            "Old Status",
            "New Status",
            "User",
            "Notes"
        ];

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
                // Add separator row
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

        let filename = `${project.name.replace(/\s+/g, "_")}_report`;
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
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export Report</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Export Project Report</DialogTitle>
                    <DialogDescription>
                        Generate a custom CSV report of project activity.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Date Range Selection */}
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
                                            id="date"
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {date?.from ? (
                                                date.to ? (
                                                    <>
                                                        {format(date.from, "LLL dd, y")} -{" "}
                                                        {format(date.to, "LLL dd, y")}
                                                    </>
                                                ) : (
                                                    format(date.from, "LLL dd, y")
                                                )
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={date?.from}
                                            selected={date}
                                            onSelect={setDate}
                                            numberOfMonths={2}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center space-x-2 pb-2">
                        <Checkbox
                            id="groupByDate"
                            checked={groupByDate}
                            onCheckedChange={(checked) => setGroupByDate(checked === true)}
                        />
                        <Label htmlFor="groupByDate">Group export by date</Label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Status Filter</Label>
                            <Select
                                value={statusFilter}
                                onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}
                            >
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
                            <Select
                                value={categoryFilter}
                                onValueChange={(v) => setCategoryFilter(v as SEOCategory | "all")}
                            >
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
                </div>

                <DialogFooter>
                    <Button onClick={handleExport} className="w-full sm:w-auto">
                        <Download className="mr-2 h-4 w-4" />
                        Download Report
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
