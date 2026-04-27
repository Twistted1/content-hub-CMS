import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  Clock,
  Send,
  Eye,
  Calendar as CalendarIcon,
  Globe,
  CheckCircle2,
  XCircle,
  Save,
  Upload
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePosts, useMedia } from "@/hooks/usePosts";
import { Post, PostStatus } from "@/types";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { format } from "date-fns";
import { toast } from "sonner";
import { DragDropImport } from "@/components/common/DragDropImport";
import { useUJT } from "@/hooks/useUJT";

export default function Articles() {
  const { posts, addPost, updatePost, deletePost, publishPost } = usePosts();
  const { uploadMedia } = useMedia();
  const { processUJT } = useUJT();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PostStatus>("all");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Partial<Post>>({
    title: "",
    content: "",
    status: "draft",
    type: "article",
    platforms: [],
  });
  const [isNew, setIsNew] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Filter only articles
  const articles = posts.filter(
    (post) => 
      post.type === "article" &&
      (statusFilter === "all" || post.status === statusFilter) &&
      (post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
       (post.content && post.content.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const handleCreateArticle = () => {
    setCurrentArticle({
      title: "",
      content: "",
      status: "draft",
      type: "article",
      platforms: [],
    });
    setIsNew(true);
    setIsEditorOpen(true);
  };

  const handleEditArticle = (article: Post) => {
    setCurrentArticle({ ...article });
    setIsNew(false);
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    if (!currentArticle.title) {
      toast.error("Please enter a title");
      return;
    }

    if (isNew) {
      addPost.mutate({
        post: {
          title: currentArticle.title,
          content: currentArticle.content || "",
          type: "article",
          status: "draft",
        },
        platforms: [], // Can be selected later or in a separate step
      }, {
        onSuccess: () => {
          setIsEditorOpen(false);
          toast.success("Article draft saved");
        }
      });
    } else if (currentArticle.id) {
      updatePost.mutate({
        id: currentArticle.id,
        title: currentArticle.title,
        content: currentArticle.content,
        // Preserve other fields
        type: currentArticle.type || "article",
        status: currentArticle.status || "draft",
      }, {
        onSuccess: () => {
          setIsEditorOpen(false);
          toast.success("Article updated");
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this article?")) {
      deletePost.mutate(id);
    }
  };

  const handlePublish = (id: string) => {
    publishPost.mutate(id);
  };
  
  const handleImageUpload = async (file: File): Promise<string> => {
      try {
          const result = await uploadMedia.mutateAsync({ file });
          return result.url;
      } catch (error) {
          console.error("Upload failed", error);
          throw error;
      }
  };
  
  const handleImportClick = () => {
      importInputRef.current?.click();
  };

  const handleImport = (data: any) => {
    if (data.version === "1.0" && Array.isArray(data.items)) {
      processUJT(data);
      return;
    }
    
    // Fallback for simple content import
    if (data.content) {
      setCurrentArticle(prev => ({ ...prev, content: data.content }));
      toast.success("Content imported successfully");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "draft": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "scheduled": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <DragDropImport onImport={handleImport} entityName="Article">
      <DashboardLayout>
        <div className="space-y-6 h-full flex flex-col">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-white uppercase head-neon mb-2">Articles</h1>
              <p className="text-sm text-muted-foreground font-medium max-w-xl opacity-60">
                Compose high-impact, long-form content. Orchestrate your brand's narrative across Novus Exchange with precision.
              </p>
            </div>
            <Button onClick={handleCreateArticle} className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[11px] tracking-[0.2em] gap-3 px-8 py-7 rounded-2xl shadow-2xl shadow-primary/30 active:scale-95 transition-all">
              <Plus className="h-5 w-5" />
              NEW ARTICLE
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
            <div className="relative flex-1 w-full max-w-xl group">
              <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-[20px] opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search global archives..."
                className="pl-12 bg-white/[0.03] border-white/[0.08] rounded-2xl py-6 text-sm placeholder:text-muted-foreground/40 focus:border-primary/40 focus:bg-white/[0.05] transition-all relative z-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-[220px] bg-white/[0.03] border-white/[0.08] rounded-2xl py-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-all">
                <SelectValue placeholder="STATUS FILTER" />
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur-xl border-white/[0.08] rounded-2xl">
                <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest py-3">ALL TRANSMISSIONS</SelectItem>
                <SelectItem value="draft" className="text-[10px] font-black uppercase tracking-widest py-3 text-amber-400">DRAFTS</SelectItem>
                <SelectItem value="scheduled" className="text-[10px] font-black uppercase tracking-widest py-3 text-blue-400">SCHEDULED</SelectItem>
                <SelectItem value="published" className="text-[10px] font-black uppercase tracking-widest py-3 text-emerald-400">PUBLISHED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Articles List */}
          {articles.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/[0.08] rounded-[2.5rem] p-24 bg-white/[0.02] animate-in fade-in zoom-in-95 duration-500">
              <div className="w-24 h-24 rounded-[2rem] bg-white/[0.03] flex items-center justify-center mb-8 border border-white/[0.08]">
                <FileText className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight uppercase mb-4">No content found</h3>
              <p className="text-muted-foreground mb-10 text-center max-w-sm font-medium opacity-60">
                Your archive is currently empty. Initialize your first long-form strategy to begin the sequence.
              </p>
              <Button onClick={handleCreateArticle} className="bg-primary px-10 py-7 rounded-2xl font-black uppercase tracking-widest">Create Sequence</Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {articles.map((article) => (
                <div 
                  key={article.id} 
                  className="glass-card p-6 group cursor-pointer hover:border-primary/40 transition-all duration-500 flex flex-col h-full relative overflow-hidden"
                  onClick={() => handleEditArticle(article)}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-all" />
                  
                  <div className="flex justify-between items-center mb-6 relative z-10">
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg border-white/[0.08]", getStatusColor(article.status))}>
                      {article.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-white/[0.05] text-muted-foreground hover:text-white transition-all">
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-white/[0.08] rounded-2xl p-2 min-w-[180px]">
                        <DropdownMenuItem className="rounded-xl py-3 text-[10px] font-black uppercase tracking-widest gap-3" onClick={(e) => { e.stopPropagation(); handleEditArticle(article); }}>
                          <Edit className="h-4 w-4" /> Edit Sequence
                        </DropdownMenuItem>
                        {article.status !== "published" && (
                          <DropdownMenuItem className="rounded-xl py-3 text-[10px] font-black uppercase tracking-widest gap-3 text-primary" onClick={(e) => { e.stopPropagation(); handlePublish(article.id); }}>
                            <Send className="h-4 w-4" /> Deploy Now
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="rounded-xl py-3 text-[10px] font-black uppercase tracking-widest gap-3 text-rose-400" onClick={(e) => { e.stopPropagation(); handleDelete(article.id); }}>
                          <Trash2 className="h-4 w-4" /> Purge Record
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="relative z-10 flex-1">
                    <h3 className="text-xl font-black text-white leading-tight tracking-tight mb-4 group-hover:text-primary transition-colors line-clamp-2 uppercase">
                      {article.title}
                    </h3>
                    <div className="text-sm text-muted-foreground/60 line-clamp-3 mb-8 font-medium leading-relaxed">
                      <div dangerouslySetInnerHTML={{ __html: article.content || "No content" }} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-auto pt-6 border-t border-white/[0.05] relative z-10">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <Clock className="h-3 w-3 text-muted-foreground/40" />
                      <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                        {format(new Date(article.updatedAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    {article.status === "published" && (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Live Node</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Editor Dialog (Full Screen) */}
          <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0">
              <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0">
                <DialogTitle>{isNew ? "New Article" : "Edit Article"}</DialogTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleImportClick} className="gap-2">
                        <Upload className="h-4 w-4" />
                        Import
                    </Button>
                    <Badge variant="outline" className="mr-4">
                        {isNew ? "Draft" : currentArticle.status}
                    </Badge>
                  </div>
              </DialogHeader>
              
              <input 
                  type="file" 
                  ref={importInputRef} 
                  title="Import article file"
                  aria-label="Import article file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target?.result as string;
                      try {
                        // Attempt to parse as JSON first (for UJT payloads)
                        const jsonData = JSON.parse(content);
                        handleImport(jsonData);
                      } catch (err) {
                        // Fallback to plain text import
                        handleImport({ content });
                      }
                    };
                    reader.readAsText(file);
                    if (importInputRef.current) importInputRef.current.value = '';
                  }} 
                  className="hidden" 
                  accept=".md,.txt,.html"
              />

              <div className="flex-1 overflow-y-auto bg-background relative">
                {/* 
                  The Title is contained within the scrollable area so the sticky toolbar
                  in the RichTextEditor locks to the TOP of the viewport as the user scrolls down.
                  The content layout is centered and distraction-free.
                */}
                <div className="w-full h-full flex flex-col">
                  
                  {/* Title Area */}
                  <div className="w-full max-w-4xl mx-auto px-6 sm:px-12 pt-12 pb-6">
                    <Input
                      placeholder="Article Title"
                      className="text-4xl sm:text-5xl font-extrabold border-none shadow-none px-0 focus-visible:ring-0 h-auto placeholder:text-muted-foreground/30 bg-transparent tracking-tight text-foreground"
                      value={currentArticle.title}
                      onChange={(e) => setCurrentArticle({ ...currentArticle, title: e.target.value })}
                    />
                  </div>
                  
                  {/* Editor Area */}
                  <div className="flex-1 w-full bg-background border-t shadow-sm">
                    <RichTextEditor
                      content={currentArticle.content || ""}
                      onChange={(content) => setCurrentArticle({ ...currentArticle, content })}
                      className="w-full border-none shadow-none"
                      placeholder="Start writing your story..."
                      onImageUpload={handleImageUpload}
                    />
                  </div>
                </div>
              </div>

              {/* Premium Footer Layout */}
              <DialogFooter className="px-6 py-4 border-t bg-background shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.1)] z-20 sticky bottom-0">
                <div className="flex justify-between w-full items-center">
                  <Button variant="ghost" onClick={() => setIsEditorOpen(false)} className="text-muted-foreground hover:text-foreground h-11 px-6">
                    Cancel
                  </Button>
                  <div className="flex items-center gap-3">
                    {!isNew && currentArticle.status !== "published" && (
                        <Button 
                          variant="outline" 
                          className="bg-background border-primary/20 hover:border-primary/50 text-foreground shadow-sm transition-all"
                          onClick={() => handlePublish(currentArticle.id!)}
                        >
                          <Send className="h-4 w-4 mr-2 text-primary" />
                          Publish Now
                        </Button>
                    )}
                    <Button 
                      onClick={handleSave}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all px-8 rounded-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Article
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </DragDropImport>
  );
}
