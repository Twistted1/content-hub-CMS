import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Calendar,
  MessageSquare,
  Paperclip,
  LayoutGrid,
  List,
  Edit,
  Trash2,
  Copy,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { DragDropImport } from "@/components/common/DragDropImport";
import { useProjects } from "@/hooks/useProjects";
import { useUJT } from "@/hooks/useUJT";
import { Project, ProjectStatus } from "@/types";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

const columns: { id: ProjectStatus; title: string; color: string }[] = [
  { id: "planning", title: "Planning", color: "bg-muted" },
  { id: "in-progress", title: "In Progress", color: "bg-primary/20" },
  { id: "review", title: "In Review", color: "bg-warning/20" },
  { id: "completed", title: "Completed", color: "bg-success/20" },
  { id: "on-hold", title: "On Hold", color: "bg-destructive/10" },
];

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/20 text-warning-foreground",
  high: "bg-destructive/20 text-destructive",
};

interface ProjectCardProps {
  project: Project;
  index: number;
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onDuplicate: (project: Project) => void;
}

function ProjectCard({ project, index, onEdit, onDelete, onDuplicate }: ProjectCardProps) {
  return (
    <Draggable draggableId={project.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-3"
        >
          <Card className="hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex flex-wrap gap-1">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(project)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(project)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(project.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div>
                <h4 className="font-medium text-sm">{project.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {project.description}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-1.5" />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {project.dueDate || "No date"}
                  </span>
                  <Badge className={priorityColors[project.priority]} variant="secondary">
                    {project.priority}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {project.assignees.slice(0, 3).map((assignee, i) => (
                    <Avatar key={i} className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={assignee.avatar} />
                      <AvatarFallback className="text-xs">
                        {assignee.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {project.assignees.length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                      +{project.assignees.length - 3}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {project.comments}
                  </span>
                  <span className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {project.attachments}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}

const emptyProject: Project = {
  id: "",
  createdAt: "",
  title: "",
  description: "",
  status: "planning",
  priority: "medium",
  dueDate: "",
  startDate: "",
  progress: 0,
  comments: 0,
  attachments: 0,
  assignees: [],
  tags: [],
};

const ProjectForm = ({ 
  data, 
  onChange, 
  isNew, 
  newTag, 
  setNewTag, 
  addTag, 
  removeTag, 
  newAssignee, 
  setNewAssignee, 
  addAssignee, 
  removeAssignee 
}: { 
  data: Project; 
  onChange: (data: any) => void; 
  isNew: boolean;
  newTag: string;
  setNewTag: (v: string) => void;
  addTag: (isNew: boolean) => void;
  removeTag: (tag: string, isNew: boolean) => void;
  newAssignee: string;
  setNewAssignee: (v: string) => void;
  addAssignee: (isNew: boolean) => void;
  removeAssignee: (name: string, isNew: boolean) => void;
}) => (
  <div className="space-y-4 py-4">
    <div className="space-y-2">
      <Label htmlFor="title">Title</Label>
      <Input
        id="title"
        value={data.title}
        onChange={(e) => onChange({ ...data, title: e.target.value })}
        placeholder="Project title"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        value={data.description}
        onChange={(e) => onChange({ ...data, description: e.target.value })}
        placeholder="Project description"
        rows={8}
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={data.status}
          onValueChange={(value: ProjectStatus) => onChange({ ...data, status: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Priority</Label>
        <Select
          value={data.priority}
          onValueChange={(value: "low" | "medium" | "high") =>
            onChange({ ...data, priority: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="startDate">Start Date</Label>
        <Input
          id="startDate"
          type="date"
          value={data.startDate || ""}
          onChange={(e) => onChange({ ...data, startDate: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date</Label>
        <Input
          id="dueDate"
          type="date"
          value={data.dueDate}
          onChange={(e) => onChange({ ...data, dueDate: e.target.value })}
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor="progress">Progress (%)</Label>
      <Input
        id="progress"
        type="number"
        min="0"
        max="100"
        value={data.progress}
        onChange={(e) => onChange({ ...data, progress: parseInt(e.target.value) || 0 })}
      />
    </div>
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="flex gap-2">
        <Input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Add tag"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(isNew))}
        />
        <Button type="button" variant="outline" onClick={() => addTag(isNew)}>
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {data.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              onClick={() => removeTag(tag, isNew)}
              className="ml-1 hover:text-destructive"
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
    </div>
    <div className="space-y-2">
      <Label>Assignees</Label>
      <div className="flex gap-2">
        <Input
          value={newAssignee}
          onChange={(e) => setNewAssignee(e.target.value)}
          placeholder="Add assignee name"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAssignee(isNew))}
        />
        <Button type="button" variant="outline" onClick={() => addAssignee(isNew)}>
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {data.assignees.map((assignee) => (
          <Badge key={assignee.name} variant="outline" className="gap-1">
            {assignee.name}
            <button
              onClick={() => removeAssignee(assignee.name, isNew)}
              className="ml-1 hover:text-destructive"
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
    </div>
  </div>
);

export default function Projects() {
  const { projects, addProject, updateProject, deleteProject, moveProject } = useProjects();
  const { processUJT } = useUJT();
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProject, setNewProject] = useState(emptyProject);
  const [newTag, setNewTag] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStatus = destination.droppableId as ProjectStatus;
    moveProject(draggableId, newStatus);
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === "all" || project.priority === priorityFilter;
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesPriority && matchesStatus;
  });

  const getProjectsByStatus = (status: ProjectStatus) =>
    filteredProjects.filter((project) => project.status === status);

  const handleCreateProject = () => {
    if (!newProject.title) {
      toast.error("Please enter a project title");
      return;
    }

    addProject.mutate(newProject, {
      onSuccess: () => {
        setNewProject(emptyProject);
        setIsCreateDialogOpen(false);
      }
    });
  };

  const handleUpdateProject = () => {
    if (!editingProject) return;
    updateProject(editingProject.id, editingProject);
    setEditingProject(null);
  };

  const handleDeleteProject = (id: string) => {
    deleteProject(id);
  };

  const handleDuplicateProject = (project: Project) => {
    const { id, createdAt, ...rest } = project;
    addProject.mutate({ ...rest, title: `${project.title} (Copy)` });
  };

  const addTag = (isNew: boolean) => {
    if (!newTag.trim()) return;
    if (isNew) {
      setNewProject((prev) => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
    } else if (editingProject) {
      setEditingProject({ ...editingProject, tags: [...editingProject.tags, newTag.trim()] });
    }
    setNewTag("");
  };

  const removeTag = (tag: string, isNew: boolean) => {
    if (isNew) {
      setNewProject((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
    } else if (editingProject) {
      setEditingProject({ ...editingProject, tags: editingProject.tags.filter((t) => t !== tag) });
    }
  };

  const addAssignee = (isNew: boolean) => {
    if (!newAssignee.trim()) return;
    if (isNew) {
      setNewProject((prev) => ({
        ...prev,
        assignees: [...prev.assignees, { name: newAssignee.trim() }],
      }));
    } else if (editingProject) {
      setEditingProject({
        ...editingProject,
        assignees: [...editingProject.assignees, { name: newAssignee.trim() }],
      });
    }
    setNewAssignee("");
  };

  const removeAssignee = (name: string, isNew: boolean) => {
    if (isNew) {
      setNewProject((prev) => ({
        ...prev,
        assignees: prev.assignees.filter((a) => a.name !== name),
      }));
    } else if (editingProject) {
      setEditingProject({
        ...editingProject,
        assignees: editingProject.assignees.filter((a) => a.name !== name),
      });
    }
  };



  const handleImport = (data: any) => {
    if (data.version === "1.0" && Array.isArray(data.items)) {
      processUJT(data);
      return;
    }

    const items = Array.isArray(data) ? data : [data];
    items.forEach((item: any) => {
      if (item.title) {
        addProject.mutate({
          title: item.title,
          description: item.description || "",
          status: (item.status === "backlog" ? "planning" : item.status) || "planning",
          priority: item.priority || "medium",
          dueDate: item.dueDate || "",
          startDate: item.startDate || "",
          progress: item.progress || 0,
          comments: 0,
          attachments: 0,
          assignees: item.assignees || [],
          tags: item.tags || [],
        });
      }
    });
  };

  return (
    <DragDropImport onImport={handleImport} entityName="Project">
      <DashboardLayout>
        <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Projects</h1>
            <p className="text-muted-foreground">
              Manage and track your content projects
            </p>
          </div>
          <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="review">In Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center border border-border rounded-lg">
              <Button
                variant={viewMode === "board" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode("board")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        {viewMode === "board" && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {columns.map((column) => (
                <div key={column.id} className="space-y-3">
                  <div className={`rounded-lg p-3 ${column.color}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">{column.title}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {getProjectsByStatus(column.id).length}
                      </Badge>
                    </div>
                  </div>
                  <Droppable droppableId={column.id}>
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3 min-h-[200px]"
                      >
                        {getProjectsByStatus(column.id).map((project, index) => (
                          <ProjectCard
                            key={project.id}
                            index={index}
                            project={project}
                            onEdit={setEditingProject}
                            onDelete={handleDeleteProject}
                            onDuplicate={handleDuplicateProject}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <Card>
            <CardHeader>
              <CardTitle>All Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        {project.assignees.slice(0, 2).map((assignee, i) => (
                          <Avatar key={i} className="h-8 w-8 border-2 border-background">
                            <AvatarFallback className="text-xs">
                              {assignee.name.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-medium">{project.title}</h4>
                        <p className="text-sm text-muted-foreground">{project.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={priorityColors[project.priority]} variant="secondary">
                        {project.priority}
                      </Badge>
                      <div className="w-24">
                        <Progress value={project.progress} className="h-2" />
                      </div>
                      <span className="text-sm text-muted-foreground w-24">{project.dueDate}</span>
                      <Badge variant="outline">{project.status.replace("-", " ")}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingProject(project)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateProject(project)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteProject(project.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>Add a new project to track your content work.</DialogDescription>
            </DialogHeader>
            <ProjectForm 
              data={newProject} 
              onChange={setNewProject} 
              isNew={true}
              newTag={newTag}
              setNewTag={setNewTag}
              addTag={addTag}
              removeTag={removeTag}
              newAssignee={newAssignee}
              setNewAssignee={setNewAssignee}
              addAssignee={addAssignee}
              removeAssignee={removeAssignee}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProject}>Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update your project details.</DialogDescription>
            </DialogHeader>
            {editingProject && (
              <ProjectForm 
                data={editingProject} 
                onChange={setEditingProject} 
                isNew={false}
                newTag={newTag}
                setNewTag={setNewTag}
                addTag={addTag}
                removeTag={removeTag}
                newAssignee={newAssignee}
                setNewAssignee={setNewAssignee}
                addAssignee={addAssignee}
                removeAssignee={removeAssignee}
              />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProject(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateProject}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
    </DragDropImport>
  );
}
