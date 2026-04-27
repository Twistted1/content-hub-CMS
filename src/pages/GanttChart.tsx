import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Filter,
  ZoomIn,
  ZoomOut,
  ListTodo
} from "lucide-react";
import { useProjects, useTasks } from "@/hooks/useProjects";
import { type Task } from "@/types";

const dayWidth = 40;

const getStatusColor = (status: string) => {
  switch (status) {
    case "done": return "bg-green-500";
    case "in-progress": return "bg-primary";
    case "review": return "bg-chart-4";
    case "todo": return "bg-muted-foreground";
    case "blocked": return "bg-destructive";
    default: return "bg-muted";
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "done": return "bg-green-500/10 text-green-500";
    case "in-progress": return "bg-primary/10 text-primary";
    case "review": return "bg-chart-4/10 text-chart-4";
    case "todo": return "bg-muted text-muted-foreground";
    case "blocked": return "bg-destructive/10 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function GanttChart() {
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks, isLoading: tasksLoading } = useTasks();
  const [selectedProject, setSelectedProject] = useState("all");
  const [zoom, setZoom] = useState(1);

  const isLoading = projectsLoading || tasksLoading;

  const filteredTasks = useMemo(() => {
    if (selectedProject === "all") return tasks;
    return tasks.filter(t => t.projectId === selectedProject);
  }, [tasks, selectedProject]);

  // Compute timeline range
  const totalDays = useMemo(() => {
    if (filteredTasks.length === 0) return 30;
    const maxEnd = Math.max(...filteredTasks.map(t => (t.startDate || 0) + (t.duration || 1)));
    return Math.max(30, maxEnd + 5);
  }, [filteredTasks]);

  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  const cellWidth = dayWidth * zoom;

  const projectMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach(p => { map[p.id] = (p as any).name || p.title; });
    return map;
  }, [projects]);

  const stats = useMemo(() => ({
    total: filteredTasks.length,
    done: filteredTasks.filter(t => t.status === "done").length,
    inProgress: filteredTasks.filter(t => t.status === "in-progress").length,
    blocked: filteredTasks.filter(t => t.status === "blocked").length,
  }), [filteredTasks]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading Gantt chart..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tighter text-foreground uppercase italic px-4 bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary inline-block">Gantt Chart</h1>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mt-2 opacity-60 ml-2">
              Visualize project timelines and dependencies
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Timeline View</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>{(project as any).name || project.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.min(2, z + 0.25))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Gantt Chart */}
        {filteredTasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks found"
            description={selectedProject === "all" ? "Create tasks in your projects to see them here." : "This project has no tasks yet."}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="flex">
                {/* Task List */}
                <div className="w-[280px] shrink-0 border-r border-border">
                  <div className="h-12 border-b border-border px-4 flex items-center bg-muted/50">
                    <span className="font-medium text-sm">Tasks ({filteredTasks.length})</span>
                  </div>
                  <div className="divide-y divide-border">
                    {filteredTasks.map((task) => (
                      <div key={task.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{task.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {projectMap[task.projectId] || "Unknown Project"}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="secondary" className={`text-xs ${getStatusBadge(task.status)}`}>
                              {task.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{task.progress}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <ScrollArea className="flex-1">
                  <div className="min-w-max">
                    {/* Days Header */}
                    <div className="h-12 border-b border-border flex bg-muted/50">
                      {days.map((day) => (
                        <div
                          key={day}
                          className="flex items-center justify-center border-r border-border text-sm text-muted-foreground dynamic-fill-bar"
                          ref={(el) => { if (el) el.style.width = `${cellWidth}px`; }}
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Task Bars */}
                    <div className="divide-y divide-border">
                      {filteredTasks.map((task) => (
                        <div
                          key={task.id}
                          className="relative h-[57px] hover:bg-muted/30 transition-colors dynamic-fill-bar"
                          ref={(el) => { if (el) el.style.width = `${days.length * cellWidth}px`; }}
                        >
                            <div className="absolute inset-0 flex">
                              {days.map((day) => (
                                <div key={day} className="border-r border-border/50 dynamic-fill-bar" ref={(el) => { if (el) el.style.width = `${cellWidth}px`; }} />
                              ))}
                            </div>

                          {/* Task Bar */}
                          {(task.startDate != null && task.duration) && (
                            <div
                              className="absolute top-3 h-8 rounded-md flex items-center overflow-hidden cursor-pointer group dynamic-width-bar dynamic-left-pos"
                              ref={(el) => {
                                if (el) {
                                  el.style.left = `${task.startDate * cellWidth + 4}px`;
                                  el.style.width = `${Math.max(task.duration * cellWidth - 8, 20)}px`;
                                }
                              }}
                            >
                              <div className={`absolute inset-0 ${getStatusColor(task.status)} opacity-20`} />
                              <div
                                className={`absolute inset-y-0 left-0 ${getStatusColor(task.status)} dynamic-fill-bar`}
                                ref={(el) => { if (el) el.style.width = `${task.progress}%`; }}
                              />
                              <div className={`absolute inset-0 border-2 rounded-md ${getStatusColor(task.status).replace('bg-', 'border-')}`} />
                              <span className="relative z-10 px-2 text-xs font-medium truncate text-foreground">
                                {task.name}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.done}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Blocked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.blocked}</div>
            </CardContent>
          </Card>
        </div>

        {/* Status Legend */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6">
              <span className="text-sm font-medium">Legend:</span>
              <div className="flex items-center gap-2">
                <div className="h-3 w-8 rounded bg-green-500" />
                <span className="text-sm text-muted-foreground">Done</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-8 rounded bg-primary" />
                <span className="text-sm text-muted-foreground">In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-8 rounded bg-muted-foreground" />
                <span className="text-sm text-muted-foreground">Todo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-8 rounded bg-destructive" />
                <span className="text-sm text-muted-foreground">Blocked</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
