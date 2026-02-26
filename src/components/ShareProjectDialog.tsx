import { useState } from 'react';
import { SEOProject } from '@/types/seo';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Share2, Copy, Check, Loader2, Trash2, Link, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareProjectDialogProps {
    project: SEOProject;
}

export function ShareProjectDialog({ project }: ShareProjectDialogProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [shareToken, setShareToken] = useState<string | null>(null);
    const [accessLevel, setAccessLevel] = useState<'viewer' | 'editor'>('viewer');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchOrCreateShareLink = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Check if a share link already exists for this project
            const { data: existing } = await supabase
                .from('share_links')
                .select('token, access_level')
                .eq('project_id', project.id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (existing?.token) {
                const url = `${window.location.origin}/share/${existing.token}`;
                setShareUrl(url);
                setShareToken(existing.token);
                setAccessLevel(existing.access_level as 'viewer' | 'editor' || 'viewer');
            } else {
                // Create a new share link
                const { data: created, error } = await supabase
                    .from('share_links')
                    .insert({ project_id: project.id, user_id: user.id, access_level: 'viewer' })
                    .select('token')
                    .single();

                if (error || !created) {
                    toast.error('Failed to create share link.');
                    return;
                }
                const url = `${window.location.origin}/share/${created.token}`;
                setShareUrl(url);
                setShareToken(created.token);
                setAccessLevel('viewer');
            }
        } catch (err) {
            console.error(err);
            toast.error('Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAccessLevel = async (level: 'viewer' | 'editor') => {
        if (!shareToken || !user) return;
        setAccessLevel(level);
        try {
            const { error } = await supabase
                .from('share_links')
                .update({ access_level: level })
                .eq('project_id', project.id)
                .eq('user_id', user.id);

            if (error) throw error;
            toast.success(`Access level updated to ${level}`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to update access level.');
            // Revert on error
            setAccessLevel(level === 'viewer' ? 'editor' : 'viewer');
        }
    };

    const handleOpen = () => {
        setOpen(true);
        fetchOrCreateShareLink();
    };

    const handleCopy = async () => {
        if (!shareUrl) return;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRevoke = async () => {
        if (!shareToken || !user) return;
        setLoading(true);
        try {
            await supabase
                .from('share_links')
                .delete()
                .eq('project_id', project.id)
                .eq('user_id', user.id);

            setShareUrl(null);
            setShareToken(null);
            toast.success('Share link revoked. The project is now private.');
        } catch {
            toast.error('Failed to revoke share link.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={handleOpen}
                className="gap-2 text-muted-foreground hover:text-foreground"
                title="Share project"
            >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Share</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md bg-card border border-border/70">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Share2 className="h-4 w-4 text-primary" />
                            </div>
                            Share Project
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm mt-1">
                            Anyone with this link can {accessLevel === 'editor' ? 'modify tasks and view' : 'view'} <strong className="text-foreground">{project.name}</strong> without logging in.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-2">
                        {/* Info badges */}
                        <div className="flex flex-wrap gap-2">
                            {[(accessLevel === 'editor' ? 'Edit tasks' : 'View only'), 'No login needed', 'Real-time progress'].map(label => (
                                <span
                                    key={label}
                                    className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium"
                                >
                                    ✓ {label}
                                </span>
                            ))}
                        </div>

                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center justify-center py-6"
                                >
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </motion.div>
                            ) : shareUrl ? (
                                <motion.div
                                    key="link"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-3"
                                >
                                    {/* Link preview */}
                                    <div className="flex items-center gap-2 p-1 rounded-xl bg-muted/50 border border-border/50">
                                        <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                                            <Link className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <Input
                                            readOnly
                                            value={shareUrl}
                                            className="border-0 bg-transparent text-xs text-muted-foreground focus-visible:ring-0 px-0 h-auto font-mono"
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={handleCopy}
                                            className="flex-shrink-0 gap-1.5 h-8 px-3"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check className="h-3.5 w-3.5" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="h-3.5 w-3.5" />
                                                    Copy
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {/* Link settings */}
                                    <div className="flex items-center justify-between py-1">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">Access Level</span>
                                        </div>
                                        <Select value={accessLevel} onValueChange={handleUpdateAccessLevel}>
                                            <SelectTrigger className="w-[120px] h-8 text-xs">
                                                <SelectValue placeholder="Access Level" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="viewer">Viewer</SelectItem>
                                                <SelectItem value="editor">Editor</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Revoke */}
                                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                        <p className="text-xs text-muted-foreground">
                                            🔗 This link is currently <span className="text-success font-medium">active</span>
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleRevoke}
                                            className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Revoke Link
                                        </Button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="revoked"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center py-6 space-y-3"
                                >
                                    <p className="text-sm text-muted-foreground">
                                        Share link has been revoked. This project is now private.
                                    </p>
                                    <Button onClick={fetchOrCreateShareLink} className="gap-2">
                                        <Share2 className="h-4 w-4" />
                                        Create New Link
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
