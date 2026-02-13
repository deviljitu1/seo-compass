
import { useState } from "react";
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Download, Calendar as CalendarIcon } from "lucide-react";
import { useSEOStore } from "@/stores/seoStore";
import { SEOProject } from "@/types/seo";
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
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface ExportReportDialogProps {
    project: SEOProject;
}

export function ExportReportDialog({ project }: ExportReportDialogProps) {
    const [open, setOpen] = useState(false);
    const [exportType, setExportType] = useState<"today" | "custom">("today");
    const [date, setDate] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const { getProjectHistory } = useSEOStore();

    const handleExport = () => {
        const history = getProjectHistory(project.id);
        const today = new Date();

        const filteredHistory = history.filter((h) => {
            const changeDate = new Date(h.changeDate);

            if (exportType === "today") {
                return isSameDay(changeDate, today);
            } else if (date?.from) {
                const from = startOfDay(date.from);
                const to = date.to ? endOfDay(date.to) : endOfDay(date.from);
                return isWithinInterval(changeDate, { start: from, end: to });
            }
            return false;
        });

        if (filteredHistory.length === 0) {
            // Still export headers if empty, or maybe show a toast
            // Usually users prefer getting an empty file over nothing if they clicked download.
        }

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

        const rows = filteredHistory.map((h) => [
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

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(",") + "\r\n";
        rows.forEach((row) => {
            csvContent += row.map((e) => escapeCsv(e)).join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);

        let filename = `${project.name.replace(/\s+/g, "_")}_report`;
        if (exportType === "today") {
            filename += `_${format(today, "yyyy-MM-dd")}`;
        } else if (date?.from) {
            filename += `_${format(date.from, "yyyy-MM-dd")}`;
            if (date.to) filename += `_to_${format(date.to, "yyyy-MM-dd")}`;
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Export Project Report</DialogTitle>
                    <DialogDescription>
                        Download a CSV report of project activity and status changes.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <RadioGroup
                        value={exportType}
                        onValueChange={(v) => setExportType(v as "today" | "custom")}
                        className="flex flex-col space-y-3"
                    >
                        <div className="flex items-center space-x-3 space-y-0">
                            <RadioGroupItem value="today" id="today" />
                            <Label htmlFor="today" className="font-normal cursor-pointer">
                                Today's Report
                            </Label>
                        </div>
                        <div className="flex items-center space-x-3 space-y-0">
                            <RadioGroupItem value="custom" id="custom" />
                            <Label htmlFor="custom" className="font-normal cursor-pointer">
                                Date Range Report
                            </Label>
                        </div>
                    </RadioGroup>

                    {exportType === "custom" && (
                        <div className="grid gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <Label>Select Date Range</Label>
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
                <DialogFooter>
                    <Button onClick={handleExport} className="w-full sm:w-auto">
                        Download CSV
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
