import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DragDropImport } from "@/components/common/DragDropImport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  Trash2,
  Edit,
  Clock,
  Tag,
  MoreHorizontal,
  Grid,
  List,
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNotes } from "@/hooks/useNotes";
import { useUJT } from "@/hooks/useUJT";
import { Note } from "@/types";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Calendar as CalendarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Notes() {
  const { t } = useTranslation();
  const { notes, addNote, updateNote, deleteNote } = useNotes();
  const { processUJT } = useUJT();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (location.state?.createNote) {
      setIsCreateDialogOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, []);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newNote, setNewNote] = useState({ 
    title: "", 
    content: "", 
    tags: [] as string[], 
    color: "bg-card", 
    isPinned: false,
    startDate: "",
    dueDate: "" 
  });
  const [tagInput, setTagInput] = useState("");

  const colorOptions = [
    { name: t("notes.colorDefault"), value: "bg-card" },
    { name: t("notes.colorBlue"), value: "bg-blue-500/10" },
    { name: t("notes.colorGreen"), value: "bg-green-500/10" },
    { name: t("notes.colorYellow"), value: "bg-yellow-500/10" },
    { name: t("notes.colorRed"), value: "bg-red-500/10" },
    { name: t("notes.colorPurple"), value: "bg-purple-500/10" },
  ];

  const addTag = (tag: string, isEditing: boolean) => {
    const t = tag.trim();
    if (!t) return;
    if (isEditing && editingNote) {
      if (!editingNote.tags.includes(t)) {
        setEditingNote({ ...editingNote, tags: [...editingNote.tags, t] });
      }
    } else {
      if (!newNote.tags.includes(t)) {
        setNewNote({ ...newNote, tags: [...newNote.tags, t] });
      }
    }
    setTagInput("");
  };

  const removeTag = (tag: string, isEditing: boolean) => {
    if (isEditing && editingNote) {
      setEditingNote({ ...editingNote, tags: editingNote.tags.filter(t => t !== tag) });
    } else {
      setNewNote({ ...newNote, tags: newNote.tags.filter(t => t !== tag) });
    }
  };

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pinnedNotes = filteredNotes.filter((note) => note.isPinned);
  const otherNotes = filteredNotes.filter((note) => !note.isPinned);

  const togglePin = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (note) {
      updateNote(id, { isPinned: !note.isPinned });
    }
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(id);
  };

  const handleCreateNote = () => {
    if (!newNote.title.trim()) {
      toast.error(t("notes.titleRequired"));
      return;
    }
    
    addNote.mutate({
      title: newNote.title,
      content: newNote.content,
      tags: newNote.tags,
      isPinned: newNote.isPinned,
      color: newNote.color,
      startDate: newNote.startDate,
      dueDate: newNote.dueDate,
    }, {
      onSuccess: () => {
        setNewNote({ 
          title: "", 
          content: "", 
          tags: [], 
          color: "bg-card", 
          isPinned: false,
          startDate: "",
          dueDate: ""
        });
        setIsCreateDialogOpen(false);
      }
    });
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
  };

  const handleSaveEdit = () => {
    if (!editingNote) return;
    updateNote(editingNote.id, {
      title: editingNote.title,
      content: editingNote.content,
      tags: editingNote.tags,
      color: editingNote.color,
      isPinned: editingNote.isPinned,
      startDate: editingNote.startDate,
      dueDate: editingNote.dueDate,
    });
    setEditingNote(null);
  };

  const handleImport = (data: any) => {
    if (data.version === "1.0" && Array.isArray(data.items)) {
      processUJT(data);
      return;
    }

    const items = Array.isArray(data) ? data : [data];
    items.forEach(item => {
      if (item.title) {
        addNote.mutate({
          title: item.title,
          content: item.content || "",
          tags: Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []),
          isPinned: item.isPinned || false,
          color: item.color || "bg-muted",
        });
      }
    });
  };

  const NoteCard = ({ note }: { note: Note }) => (
    <Card className={cn("group transition-all hover:shadow-md", note.color)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-semibold line-clamp-1">
            {note.title}
          </CardTitle>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => togglePin(note.id)}
            >
              <Pin className={cn("h-4 w-4", note.isPinned && "fill-current")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEditNote(note)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("notes.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteNote(note.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("notes.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-4">
          {note.content.replace(/<[^>]*>?/gm, '')}
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1">
            {note.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] py-0 h-4">
                <Tag className="h-2.5 w-2.5 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              {note.startDate && (
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-2.5 w-2.5" />
                  <span>{t("notes.startLabel", { date: note.startDate })}</span>
                </div>
              )}
              {note.dueDate && (
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-2.5 w-2.5 text-destructive" />
                  <span>{t("notes.dueLabel", { date: note.dueDate })}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground opacity-50">
              <Clock className="h-2.5 w-2.5" />
              <span>{note.updatedAt}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DragDropImport onImport={handleImport} entityName="Note">
      <DashboardLayout>
        <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title mb-2">{t("notes.title")}</h1>
            <p className="text-muted-foreground">
              {t("notes.subtitle")}
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t("notes.newNote")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("notes.createNewNote")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="space-y-2">
                    <Label>{t("notes.noteTitle")}</Label>
                    <Input
                      placeholder={t("notes.noteTitlePlaceholder")}
                      value={newNote.title}
                      onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notes.contentRichText")}</Label>
                    <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
                      <RichTextEditor
                        content={newNote.content}
                        onChange={(content) => setNewNote({ ...newNote, content })}
                        placeholder={t("notes.startTyping")}
                        className="min-h-[160px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("notes.startDate")}</Label>
                      <Input
                        type="date"
                        value={newNote.startDate}
                        onChange={(e) => setNewNote({ ...newNote, startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("notes.dueDate")}</Label>
                      <Input
                        type="date"
                        value={newNote.dueDate}
                        onChange={(e) => setNewNote({ ...newNote, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notes.tags")}</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("notes.addTagPlaceholder")}
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(tagInput, false))}
                      />
                      <Button variant="outline" size="sm" onClick={() => addTag(tagInput, false)}>{t("notes.add")}</Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newNote.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button onClick={() => removeTag(tag, false)} className="hover:text-destructive">×</button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notes.color")}</Label>
                    <div className="flex gap-2">
                      {colorOptions.map((opt) => (
                        <button
                          key={opt.value}
                          className={cn(
                            "h-8 w-8 rounded-full border border-border transition-all",
                            opt.value,
                            newNote.color === opt.value && "ring-2 ring-primary ring-offset-2"
                          )}
                          onClick={() => setNewNote({ ...newNote, color: opt.value })}
                          title={opt.name}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>{t("notes.pinToTop")}</Label>
                    <Button
                      variant={newNote.isPinned ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewNote({ ...newNote, isPinned: !newNote.isPinned })}
                    >
                      <Pin className={cn("h-4 w-4 mr-2", newNote.isPinned && "fill-current")} />
                      {newNote.isPinned ? t("notes.pinned") : t("notes.pinNote")}
                    </Button>
                  </div>
                  <Button onClick={handleCreateNote} className="w-full">
                    {t("notes.createNote")}
                  </Button>
                </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and View Toggle */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("notes.searchPlaceholder")}
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <Card className="flex-1">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <StickyNote className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{notes.length}</p>
                <p className="text-xs text-muted-foreground">{t("notes.totalNotes")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                <Pin className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pinnedNotes.length}</p>
                <p className="text-xs text-muted-foreground">{t("notes.pinned")}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                <Tag className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {[...new Set(notes.flatMap((n) => n.tags))].length}
                </p>
                <p className="text-xs text-muted-foreground">{t("notes.tagsCount")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pinned Notes */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Pin className="h-4 w-4" />
              {t("notes.pinned")}
            </h2>
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  : "space-y-3"
              )}
            >
              {pinnedNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </div>
        )}

        {/* Other Notes */}
        {otherNotes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("notes.allNotes")}
            </h2>
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  : "space-y-3"
              )}
            >
              {otherNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </div>
        )}

        {filteredNotes.length === 0 && (
          <div className="text-center py-12">
            <StickyNote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{t("notes.noNotesFound")}</h3>
            <p className="text-muted-foreground">
              {t("notes.tryDifferentSearch")}
            </p>
          </div>
        )}

        {/* Edit Note Dialog */}
        <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("notes.editNote")}</DialogTitle>
            </DialogHeader>
            {editingNote && (
              <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="space-y-2">
                   <Label>{t("notes.noteTitle")}</Label>
                  <Input
                    placeholder={t("notes.noteTitlePlaceholder")}
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("notes.contentRichText")}</Label>
                  <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
                    <RichTextEditor
                      content={editingNote.content}
                      onChange={(content) => setEditingNote({ ...editingNote, content })}
                      placeholder={t("notes.editYourNote")}
                      className="min-h-[160px]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("notes.startDate")}</Label>
                    <Input
                      type="date"
                      value={editingNote.startDate || ""}
                      onChange={(e) => setEditingNote({ ...editingNote, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notes.dueDate")}</Label>
                    <Input
                      type="date"
                      value={editingNote.dueDate || ""}
                      onChange={(e) => setEditingNote({ ...editingNote, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("notes.tags")}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("notes.addTagPlaceholder")}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(tagInput, true))}
                    />
                    <Button variant="outline" size="sm" onClick={() => addTag(tagInput, true)}>{t("notes.add")}</Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editingNote.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag, true)} className="hover:text-destructive">×</button>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("notes.color")}</Label>
                  <div className="flex gap-2">
                    {colorOptions.map((opt) => (
                      <button
                        key={opt.value}
                        className={cn(
                          "h-8 w-8 rounded-full border border-border transition-all",
                          opt.value,
                          editingNote.color === opt.value && "ring-2 ring-primary ring-offset-2"
                        )}
                        onClick={() => setEditingNote({ ...editingNote, color: opt.value })}
                        title={opt.name}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>{t("notes.pinToTop")}</Label>
                  <Button
                    variant={editingNote.isPinned ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditingNote({ ...editingNote, isPinned: !editingNote.isPinned })}
                  >
                    <Pin className={cn("h-4 w-4 mr-2", editingNote.isPinned && "fill-current")} />
                    {editingNote.isPinned ? t("notes.pinned") : t("notes.pinNote")}
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingNote(null)}>
                {t("notes.cancel")}
              </Button>
              <Button onClick={handleSaveEdit}>{t("notes.saveChanges")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  </DragDropImport>
  );
}

