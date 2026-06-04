import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Target,
  Plus,
  TrendingUp,
  Users,
  Calendar,
  CheckCircle2,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Copy,
  Search,
  Play,
  Pause,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStrategies, Strategy, StrategyStatus } from "@/hooks/useStrategies";
import { statusConfig } from "@/components/strategies/strategiesData";
import { StrategyDialog } from "@/components/strategies/StrategyDialog";
import { StrategyDetailDialog } from "@/components/strategies/StrategyDetailDialog";
import { DragDropImport } from "@/components/common/DragDropImport";
import { useUJT } from "@/hooks/useUJT";
import { toast } from "sonner";

const Strategies = () => {
  const {
    strategies,
    isLoading,
    addStrategy,
    updateStrategy,
    deleteStrategy,
    deleteStrategies,
    duplicateStrategy,
    changeStrategiesStatus,
  } = useStrategies();
  const { processUJT } = useUJT();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [viewingStrategy, setViewingStrategy] = useState<Strategy | null>(null);

  const filteredStrategies = useMemo(() => {
    return strategies.filter((strategy) => {
      const matchesSearch =
        strategy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (strategy.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || strategy.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [strategies, searchQuery, statusFilter]);

  const activeStrategies = strategies.filter((s) => s.status === "active").length;
  const totalGoals = strategies.reduce((acc, s) => acc + s.goalItems.length, 0);
  const completedGoals = strategies.reduce((acc, s) => acc + s.goalItems.filter(g => g.completed).length, 0);
  const avgProgress = strategies.length
    ? Math.round(strategies.reduce((acc, s) => acc + s.progress, 0) / strategies.length)
    : 0;
  const uniqueAssignees = new Set(strategies.flatMap((s) => s.assignees)).size;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStrategies(filteredStrategies.map((s) => s.id));
    } else {
      setSelectedStrategies([]);
    }
  };

  const handleSelectStrategy = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedStrategies((prev) => [...prev, id]);
    } else {
      setSelectedStrategies((prev) => prev.filter((sid) => sid !== id));
    }
  };

  const handleSaveStrategy = async (data: Omit<Strategy, "id" | "created_at" | "updated_at">) => {
    try {
      if (editingStrategy) {
        await updateStrategy(editingStrategy.id, data);
        toast.success("Strategy updated successfully");
      } else {
        await addStrategy(data);
        toast.success("Strategy created successfully");
      }
      setEditingStrategy(null);
    } catch {
      // Error handled by hook
    }
  };

  const handleDelete = async (id: string) => {
    await deleteStrategy(id);
    toast.success("Strategy deleted");
  };

  const handleBulkDelete = async () => {
    await deleteStrategies(selectedStrategies);
    toast.success(`Deleted ${selectedStrategies.length} strategies`);
    setSelectedStrategies([]);
  };

  const handleBulkStatusChange = async (status: StrategyStatus) => {
    await changeStrategiesStatus(selectedStrategies, status);
    toast.success(`Updated ${selectedStrategies.length} strategies to ${status}`);
    setSelectedStrategies([]);
  };

  const handleDuplicate = async (id: string) => {
    await duplicateStrategy(id);
    toast.success("Strategy duplicated");
  };

  const handleView = (strategy: Strategy) => {
    setViewingStrategy(strategy);
    setDetailDialogOpen(true);
  };

  const handleEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setDialogOpen(true);
  };

  // Convert DB strategy to dialog format
  const toDialogStrategy = (s: Strategy | null) => {
    if (!s) return null;
    return {
      ...s,
      startDate: s.start_date || '',
      endDate: s.end_date || '',
      createdAt: s.created_at,
    };
  };

  const handleImport = (data: any) => {
    if (data.version === "1.0" && Array.isArray(data.items)) {
      processUJT(data);
      return;
    }

    const items = Array.isArray(data) ? data : [data];
    items.forEach((item: any) => {
      if (item.name) {
        addStrategy({
          name: item.name,
          description: item.description || "",
          status: (item.status || "planning") as any,
          progress: item.progress || 0,
          start_date: item.startDate || item.start_date || null,
          end_date: item.endDate || item.end_date || null,
          assignees: item.assignees || [],
          platforms: item.platforms || [],
          goalItems: item.goalItems || [],
        });
      }
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DragDropImport onImport={handleImport} entityName="Strategy">
      <DashboardLayout>
        <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Strategies</h1>
            <p className="text-muted-foreground">
              Plan and track your content marketing strategies
            </p>
          </div>
          <Button onClick={() => { setEditingStrategy(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Strategy
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Strategies</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{strategies.length}</div>
              <p className="text-xs text-muted-foreground">
                {activeStrategies} currently active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Goals Progress</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {completedGoals}/{totalGoals}
              </div>
              <p className="text-xs text-muted-foreground">
                {totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0}% completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgProgress}%</div>
              <Progress value={avgProgress} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueAssignees}</div>
              <p className="text-xs text-muted-foreground">
                Across all strategies
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Bulk Actions */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>All Strategies</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search strategies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedStrategies.length > 0 && (
              <div className="flex items-center gap-2 pt-4 border-t mt-4">
                <span className="text-sm text-muted-foreground">
                  {selectedStrategies.length} selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusChange("active")}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Activate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusChange("paused")}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        filteredStrategies.length > 0 &&
                        selectedStrategies.length === filteredStrategies.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead>Goals</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStrategies.map((strategy) => {
                  const StatusIcon = statusConfig[strategy.status].icon;
                  return (
                    <TableRow key={strategy.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedStrategies.includes(strategy.id)}
                          onCheckedChange={(checked) =>
                            handleSelectStrategy(strategy.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{strategy.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {strategy.description}
                          </p>
                          <div className="flex gap-1 flex-wrap">
                            {strategy.platforms.map((platform) => (
                              <Badge
                                key={platform}
                                variant="outline"
                                className="text-xs"
                              >
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[strategy.status].variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[strategy.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 w-24">
                          <div className="text-sm font-medium">
                            {strategy.progress}%
                          </div>
                          <Progress value={strategy.progress} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {strategy.start_date || 'N/A'} - {strategy.end_date || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {strategy.goalItems.filter(g => g.completed).length}/{strategy.goalItems.length} completed
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex -space-x-2">
                          {strategy.assignees.slice(0, 3).map((assignee, idx) => (
                            <div
                              key={idx}
                              className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground border-2 border-background"
                            >
                              {assignee}
                            </div>
                          ))}
                          {strategy.assignees.length > 3 && (
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground border-2 border-background">
                              +{strategy.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(strategy)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(strategy)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Strategy
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(strategy.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(strategy.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredStrategies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No strategies found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <StrategyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        strategy={editingStrategy}
        onSave={handleSaveStrategy}
      />

      <StrategyDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        strategy={viewingStrategy}
      />
    </DashboardLayout>
  </DragDropImport>
  );
};

export default Strategies;