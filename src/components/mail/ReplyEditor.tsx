import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bold,
  Italic,
  List,
  Quote,
  User,
} from 'lucide-react';

interface ReplyEditorProps {
  initialContent: string;
  onSend: (html: string, plainText: string) => void;
  mode: 'casework' | 'campaign';
}

export function ReplyEditor({ initialContent, onSend, mode }: ReplyEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // Disable headings for email context
      }),
      Placeholder.configure({
        placeholder: mode === 'campaign'
          ? 'Compose your bulk response. Use {{full_name}} for personalization...'
          : 'Type your reply...',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  const handleSend = () => {
    if (!editor) return;

    const html = editor.getHTML();
    const plainText = editor.getText();

    // Don't send empty messages
    if (plainText.trim() === '') return;

    onSend(html, plainText);
  };

  const insertNameVariable = () => {
    if (!editor) return;
    editor.chain().focus().insertContent('{{full_name}}').run();
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg bg-background">
      {/* Toolbar */}
      <div className="border-b bg-muted/50 p-2 flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-accent' : ''}
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
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive('blockquote') ? 'bg-accent' : ''}
              >
                <Quote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quote</TooltipContent>
          </Tooltip>

          {mode === 'campaign' && (
            <>
              <Separator orientation="vertical" className="mx-2 h-6" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={insertNameVariable}
                    className="flex items-center gap-1"
                  >
                    <User className="h-4 w-4" />
                    <span className="text-xs">Name</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert Name Variable</TooltipContent>
              </Tooltip>
            </>
          )}
        </TooltipProvider>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Actions */}
      <div className="border-t p-3 flex justify-end">
        <Button onClick={handleSend}>
          {mode === 'campaign' ? 'Queue Bulk Response' : 'Send Reply'}
        </Button>
      </div>

      <style>{`
        .ProseMirror {
          min-height: 200px;
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

        .ProseMirror blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 1rem;
          color: #6b7280;
        }

        .ProseMirror ul {
          padding-left: 1.5rem;
          list-style-type: disc;
        }

        .ProseMirror ol {
          padding-left: 1.5rem;
          list-style-type: decimal;
        }
      `}</style>
    </div>
  );
}
