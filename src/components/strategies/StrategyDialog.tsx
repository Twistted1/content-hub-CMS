import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Trash2 } from "lucide-react";
import { platformOptions, teamMemberOptions } from "./strategiesData";
import type { Strategy, StrategyStatus, StrategyGoal, StrategyInsert } from "@/hooks/useStrategies";
import { useTranslation } from "react-i18next";

interface StrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy?: Strategy | null;
  onSave: (data: StrategyInsert) => void;
}

interface FormGoal {
  id: string;
  title: string;
  completed: boolean;
}

export function StrategyDialog({ open, onOpenChange, strategy, onSave }: StrategyDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "planning" as StrategyStatus,
    progress: 0,
    start_date: "",
    end_date: "",
    goalItems: [] as FormGoal[],
    assignees: [] as string[],
    platforms: [] as string[],
  });
  const [newGoalTitle, setNewGoalTitle] = useState("");

  useEffect(() => {
    if (strategy) {
      setFormData({
        name: strategy.name,
        description: strategy.description || "",
        status: strategy.status,
        progress: strategy.progress,
        start_date: strategy.start_date || "",
        end_date: strategy.end_date || "",
        goalItems: strategy.goalItems.map(g => ({
          id: g.id,
          title: g.title,
          completed: g.completed,
        })),
        assignees: strategy.assignees,
        platforms: strategy.platforms,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        status: "planning",
        progress: 0,
        start_date: "",
        end_date: "",
        goalItems: [],
        assignees: [],
        platforms: [],
      });
    }
    setNewGoalTitle("");
  }, [strategy, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const completedCount = formData.goalItems.filter((g) => g.completed).length;
    const progress = formData.goalItems.length > 0
      ? Math.round((completedCount / formData.goalItems.length) * 100)
      : 0;
    
    onSave({
      name: formData.name,
      description: formData.description,
      status: formData.status,
      progress,
      start_date: formData.start_date || undefined,
      end_date: formData.end_date || undefined,
      platforms: formData.platforms,
      assignees: formData.assignees,
      goalItems: formData.goalItems.map(g => ({
        title: g.title,
        completed: g.completed,
        sort_order: 0,
      })),
    });
    onOpenChange(false);
  };

  const toggleAssignee = (initials: string) => {
    setFormData((prev) => ({
      ...prev,
      assignees: prev.assignees.includes(initials)
        ? prev.assignees.filter((a) => a !== initials)
        : [...prev.assignees, initials],
    }));
  };

  const togglePlatform = (platform: string) => {
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const addGoal = () => {
    if (!newGoalTitle.trim()) return;
    const newGoal: FormGoal = {
      id: Date.now().toString(),
      title: newGoalTitle.trim(),
      completed: false,
    };
    setFormData((prev) => ({
      ...prev,
      goalItems: [...prev.goalItems, newGoal],
    }));
    setNewGoalTitle("");
  };

  const removeGoal = (goalId: string) => {
    setFormData((prev) => ({
      ...prev,
      goalItems: prev.goalItems.filter((g) => g.id !== goalId),
    }));
  };

  const handleGoalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addGoal();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{strategy ? t("strategies.editStrategyTitle") : t("strategies.newStrategyTitle")}</DialogTitle>
          <DialogDescription>
            {strategy ? t("strategies.updateDetails") : t("strategies.createNew")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("strategies.strategyName")}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("strategies.strategyNamePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("strategies.description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("strategies.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">{t("strategies.status")}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: StrategyStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("strategies.selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">{t("strategies.planning")}</SelectItem>
                    <SelectItem value="active">{t("strategies.active")}</SelectItem>
                    <SelectItem value="paused">{t("strategies.paused")}</SelectItem>
                    <SelectItem value="completed">{t("strategies.completed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("strategies.progress")}</Label>
                <div className="h-10 flex items-center text-sm text-muted-foreground">
                  {t("strategies.calculatedFromGoals", { done: formData.goalItems.filter(g => g.completed).length, total: formData.goalItems.length })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">{t("strategies.startDate")}</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">{t("strategies.endDate")}</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("strategies.goals")}</Label>
              <div className="space-y-2">
                {formData.goalItems.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
                  >
                    <span className="flex-1 text-sm">{goal.title}</span>
                    <Badge variant={goal.completed ? "default" : "outline"} className="text-xs">
                      {goal.completed ? t("strategies.done") : t("strategies.pending")}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeGoal(goal.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    onKeyDown={handleGoalKeyDown}
                    placeholder={t("strategies.addGoalPlaceholder")}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addGoal}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("strategies.platforms")}</Label>
              <div className="flex flex-wrap gap-2">
                {platformOptions.map((platform) => (
                  <Badge
                    key={platform}
                    variant={formData.platforms.includes(platform) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => togglePlatform(platform)}
                  >
                    {platform}
                    {formData.platforms.includes(platform) && (
                      <X className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("strategies.teamMembersLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {teamMemberOptions.map((member) => (
                  <Badge
                    key={member.initials}
                    variant={formData.assignees.includes(member.initials) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleAssignee(member.initials)}
                  >
                    {member.initials} - {member.name}
                    {formData.assignees.includes(member.initials) && (
                      <X className="h-3 w-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">
              {strategy ? t("strategies.saveChanges") : t("strategies.createStrategy")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
