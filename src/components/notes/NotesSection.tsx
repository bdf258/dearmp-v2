import { useState, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useSupabase } from '@/lib/SupabaseContext';
import type { Note, NoteReply, Profile } from '@/lib/database.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Bold,
  Italic,
  List,
  MessageSquare,
  Plus,
  Reply,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotesSectionProps {
  caseId?: string;
  campaignId?: string;
  threadId?: string;
  maxHeight?: string;
}

interface NoteEditorProps {
  placeholder: string;
  onSubmit: (html: string, plainText: string) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  submitLabel?: string;
  isSubmitting?: boolean;
}

function NoteEditor({
  placeholder,
  onSubmit,
  onCancel,
  showCancel = false,
  submitLabel = 'Add Note',
  isSubmitting = false,
}: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[80px] p-3',
      },
    },
  });

  const handleSubmit = () => {
    if (!editor || isSubmitting) return;

    const html = editor.getHTML();
    const plainText = editor.getText();

    if (plainText.trim() === '') return;

    onSubmit(html, plainText);
    editor.commands.clearContent();
  };

  if (!editor) return null;

  return (
    <div className="border rounded-lg bg-background">
      <div className="border-b bg-muted/50 p-2 flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-accent' : ''}
                disabled={isSubmitting}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bg-accent' : ''}
                disabled={isSubmitting}
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'bg-accent' : ''}
                disabled={isSubmitting}
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <EditorContent editor={editor} />

      <div className="border-t p-2 flex justify-end gap-2">
        {showCancel && onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {submitLabel}
        </Button>
      </div>

      <style>{`
        .ProseMirror {
          min-height: 80px;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror ul {
          padding-left: 1.5rem;
          list-style-type: disc;
        }
      `}</style>
    </div>
  );
}

// Extended Note type with replies for display
interface NoteWithReplies extends Note {
  replies: NoteReply[];
}

interface NoteItemProps {
  note: NoteWithReplies;
  profiles: Profile[];
  onAddReply: (noteId: string, html: string, plainText: string) => Promise<void>;
}

function NoteItem({ note, profiles, onAddReply }: NoteItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showReplyEditor, setShowReplyEditor] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserName = (userId: string) => {
    const profile = profiles.find((p) => p.id === userId);
    return profile?.full_name || 'Unknown User';
  };

  const handleReplySubmit = async (html: string, plainText: string) => {
    setIsSubmittingReply(true);
    try {
      await onAddReply(note.id, html, plainText);
      setShowReplyEditor(false);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {getUserName(note.created_by)}
            </span>
            <span className="text-muted-foreground">
              {formatDate(note.created_at)}
            </span>
          </div>
          <div
            className="mt-2 text-sm prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: note.body }}
          />
        </div>
      </div>

      {/* Replies section */}
      {note.replies.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <MessageSquare className="h-4 w-4" />
            <span>
              {note.replies.length} {note.replies.length === 1 ? 'reply' : 'replies'}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 ml-4 pl-4 border-l-2 border-muted space-y-3">
              {note.replies.map((reply) => (
                <ReplyItem key={reply.id} reply={reply} profiles={profiles} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Reply button and editor */}
      <div className="pt-2">
        {showReplyEditor ? (
          <NoteEditor
            placeholder="Write a reply..."
            onSubmit={handleReplySubmit}
            onCancel={() => setShowReplyEditor(false)}
            showCancel
            submitLabel="Reply"
            isSubmitting={isSubmittingReply}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setShowReplyEditor(true)}
          >
            <Reply className="h-4 w-4 mr-1" />
            Reply
          </Button>
        )}
      </div>
    </div>
  );
}

interface ReplyItemProps {
  reply: NoteReply;
  profiles: Profile[];
}

function ReplyItem({ reply, profiles }: ReplyItemProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserName = (userId: string) => {
    const profile = profiles.find((p) => p.id === userId);
    return profile?.full_name || 'Unknown User';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{getUserName(reply.created_by)}</span>
        <span className="text-muted-foreground">{formatDate(reply.created_at)}</span>
      </div>
      <div
        className="text-sm prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: reply.body }}
      />
    </div>
  );
}

export function NotesSection({
  caseId,
  campaignId,
  threadId,
  maxHeight = '500px',
}: NotesSectionProps) {
  const { notes, noteReplies, profiles, createNote, createNoteReply } = useSupabase();
  const [showNewNoteEditor, setShowNewNoteEditor] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Filter notes based on the context and combine with replies
  const notesWithReplies = useMemo(() => {
    const filtered = notes.filter((note) => {
      if (caseId) return note.case_id === caseId;
      if (campaignId) return note.campaign_id === campaignId;
      if (threadId) return note.thread_id === threadId;
      return false;
    });

    // Add replies to each note
    return filtered.map((note) => ({
      ...note,
      replies: noteReplies
        .filter((reply) => reply.note_id === note.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    }));
  }, [notes, noteReplies, caseId, campaignId, threadId]);

  const handleAddNote = async (html: string, _plainText: string) => {
    setIsSubmittingNote(true);
    try {
      const newNote = await createNote({
        body: html,
        caseId,
        campaignId,
        threadId,
      });

      if (newNote) {
        setShowNewNoteEditor(false);
        toast.success('Note added');
      } else {
        toast.error('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleAddReply = async (noteId: string, html: string, _plainText: string) => {
    const newReply = await createNoteReply(noteId, html);
    if (newReply) {
      toast.success('Reply added');
    } else {
      toast.error('Failed to add reply');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes ({notesWithReplies.length})
          </CardTitle>
          {!showNewNoteEditor && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNewNoteEditor(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {showNewNoteEditor && (
            <>
              <NoteEditor
                placeholder="Add a note visible to all team members..."
                onSubmit={handleAddNote}
                onCancel={() => setShowNewNoteEditor(false)}
                showCancel
                submitLabel="Add Note"
                isSubmitting={isSubmittingNote}
              />
              <Separator />
            </>
          )}

          {notesWithReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-medium">No notes yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Add a note to share information with your team
              </p>
            </div>
          ) : (
            <ScrollArea style={{ maxHeight }}>
              <div className="space-y-4 pr-4">
                {notesWithReplies.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    profiles={profiles}
                    onAddReply={handleAddReply}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
