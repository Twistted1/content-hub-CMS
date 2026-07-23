import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  Image as ImageIcon,
  Quote,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  onImageUpload?: (file: File) => Promise<string>;
}

export function RichTextEditor({ content, onChange, placeholder, className, onImageUpload }: RichTextEditorProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || t('editor.writeYourStory'),
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm xl:prose-lg 2xl:prose-xl mx-auto focus:outline-none min-h-[300px] p-4 sm:p-8',
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/') && onImageUpload) {
            event.preventDefault();
            onImageUpload(file).then(url => {
              const { schema } = view.state;
              const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (coordinates) {
                  view.dispatch(view.state.tr.insert(coordinates.pos, schema.nodes.image.create({ src: url })));
              }
            }).catch(error => {
                toast.error(t('editor.toastImageUploadFailed'));
                console.error(error);
            });
            return true;
          }
        }
        return false;
      }
    },
  });

  if (!editor) {
    return null;
  }

  const handleImageClick = () => {
      fileInputRef.current?.click();
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && onImageUpload) {
          try {
              const url = await onImageUpload(file);
              editor.chain().focus().setImage({ src: url }).run();
          } catch (error) {
              toast.error(t('editor.toastImageUploadFailed'));
          }
      } else if (file) {
           // Fallback if no uploader provided
           const url = URL.createObjectURL(file);
           editor.chain().focus().setImage({ src: url }).run();
      }
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt(t('editor.urlPrompt'), previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // update
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden"
        accept="image/*"
        title={t('editor.uploadImage')}
        aria-label={t('editor.uploadImage')}
      />
      
      {/* 
        The toolbar is rendered as a sticky element spanning the full width of the container. 
        It has a solid background with a blur effect to cleanly overlay the scrolling content.
      */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-card text-card-foreground sticky top-0 z-20 w-full shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={cn(editor.isActive('bold') ? 'bg-muted' : '')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={cn(editor.isActive('italic') ? 'bg-muted' : '')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={cn(editor.isActive('underline') ? 'bg-muted' : '')}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        
        <div className="w-px h-6 bg-border mx-1" />

         <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn(editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : '')}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn(editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : '')}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn(editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : '')}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(editor.isActive('heading', { level: 1 }) ? 'bg-muted' : '')}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(editor.isActive('heading', { level: 2 }) ? 'bg-muted' : '')}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(editor.isActive('bulletList') ? 'bg-muted' : '')}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(editor.isActive('orderedList') ? 'bg-muted' : '')}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(editor.isActive('blockquote') ? 'bg-muted' : '')}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={cn(editor.isActive('codeBlock') ? 'bg-muted' : '')}
        >
          <Code className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button variant="ghost" size="sm" onClick={setLink} className={cn(editor.isActive('link') ? 'bg-muted' : '')}>
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleImageClick}>
          <ImageIcon className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      
      {/* 
        EditorContent no longer has bounded heights or scrollbars. 
        It relies on the parent container (Articles.tsx) to provide the scroll context.
      */}
      <div className="flex-1 w-full max-w-4xl mx-auto">
        <EditorContent editor={editor} className="min-h-full pb-32" />
      </div>
    </div>
  );
}
