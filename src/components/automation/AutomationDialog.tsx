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
import { Checkbox } from "@/components/ui/checkbox";
import { triggerOptions, scheduleOptions, platformOptions } from "./automationData";
import { Automation, TriggerType } from "@/hooks/useAutomations";

interface AutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation?: Automation | null;
  onSave: (data: Omit<Automation, "id" | "createdAt" | "lastRun" | "runs">) => void;
}

export function AutomationDialog({
  open,
  onOpenChange,
  automation,
  onSave,
}: AutomationDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("scheduled");
  const [schedule, setSchedule] = useState("daily");
  const [threshold, setThreshold] = useState("1000");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    if (automation) {
      setName(automation.name);
      setDescription(automation.description);
      setTrigger(automation.trigger);
      setSchedule(automation.triggerConfig.schedule || "daily");
      setThreshold(String(automation.triggerConfig.threshold || 1000));
      setSelectedPlatforms(automation.platforms);
    } else {
      setName("");
      setDescription("");
      setTrigger("scheduled");
      setSchedule("daily");
      setThreshold("1000");
      setSelectedPlatforms([]);
    }
  }, [automation, open]);

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description,
      trigger,
      triggerConfig: {
        schedule: trigger === "scheduled" ? schedule : undefined,
        threshold: trigger === "engagement" ? Number(threshold) : undefined,
      },
      platforms: selectedPlatforms,
      status: automation?.status || "active",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {automation && automation.id ? "Edit Automation" : "Create Automation"}
            </DialogTitle>
            <DialogDescription>
              {automation && automation.id
                ? "Update your automation workflow"
                : "Set up a new automated workflow"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter automation name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this automation does"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={trigger} onValueChange={(v) => setTrigger(v as TriggerType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {trigger === "scheduled" && (
              <div className="space-y-2">
                <Label>Schedule</Label>
                <Select value={schedule} onValueChange={setSchedule}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {trigger === "engagement" && (
              <div className="space-y-2">
                <Label htmlFor="threshold">Engagement Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="e.g., 1000"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="grid grid-cols-3 gap-2">
                {platformOptions.map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedPlatforms.includes(platform)}
                      onCheckedChange={() => handlePlatformToggle(platform)}
                    />
                    {platform}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name || selectedPlatforms.length === 0}>
              {automation && automation.id ? "Save Changes" : "Create Automation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
