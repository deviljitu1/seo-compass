
import * as React from "react"
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    LayoutDashboard,
    Plus,
    Search,
    FileText
} from "lucide-react"

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import { useSEOStore } from "@/stores/seoStore"
import { SEOProject } from "@/types/seo"

interface CommandMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectProject: (project: SEOProject | null) => void;
    onOpenCreateDialog: () => void;
}

export function CommandMenu({ open, onOpenChange, onSelectProject, onOpenCreateDialog }: CommandMenuProps) {
    const { projects } = useSEOStore()

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                onOpenChange(!open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [open, onOpenChange])

    const runCommand = React.useCallback((command: () => unknown) => {
        onOpenChange(false)
        command()
    }, [onOpenChange])

    return (
        <>
            <p className="fixed bottom-4 right-4 z-50 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded border border-border pointer-events-none hidden md:block">
                Press <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"><span className="text-xs">⌘</span>K</kbd>
            </p>
            <CommandDialog open={open} onOpenChange={onOpenChange}>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Suggestions">
                        <CommandItem onSelect={() => runCommand(() => onSelectProject(null))}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Dashboard / Projects</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(onOpenCreateDialog)}>
                            <Plus className="mr-2 h-4 w-4" />
                            <span>Create New Project</span>
                        </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                    {projects.length > 0 && (
                        <>
                            <CommandGroup heading="Projects">
                                {projects.map(project => (
                                    <CommandItem key={project.id} onSelect={() => runCommand(() => onSelectProject(project))}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        <span>{project.name}</span>
                                        <span className="ml-2 text-muted-foreground text-xs hidden sm:inline-block">- {project.domain}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandSeparator />
                        </>
                    )}
                    <CommandGroup heading="Settings">
                        <CommandItem disabled>
                            <User className="mr-2 h-4 w-4" />
                            <span>Profile (Coming Soon)</span>
                        </CommandItem>
                        <CommandItem disabled>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings (Coming Soon)</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    )
}
