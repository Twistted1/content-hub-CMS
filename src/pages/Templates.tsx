import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePosts } from "@/hooks/usePosts";
import { useTemplates, type Template } from "@/hooks/useTemplates";
import { getNextOptimalDate } from "@/utils/scheduling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Search,
  Star,
  Copy,
  MoreVertical,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  Mail,
  Megaphone,
  Calendar,
  Heart,
  TrendingUp,
  Users,
  Edit,
  Trash2,
  Upload,
} from "lucide-react";
import { DragDropImport } from "@/components/common/DragDropImport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";

const CATEGORY_KEYS: Record<string, string> = {
  "All Templates": "templates.catAllTemplates",
  "Marketing": "templates.catMarketing",
  "Email": "templates.catEmail",
  "Engagement": "templates.catEngagement",
  "Content": "templates.catContent",
  "Social Proof": "templates.catSocialProof",
};

const categories = [
  { name: "All Templates", icon: FileText },
  { name: "Marketing", icon: Megaphone },
  { name: "Email", icon: Mail },
  { name: "Engagement", icon: Heart },
  { name: "Content", icon: Calendar },
  { name: "Social Proof", icon: TrendingUp },
];

const platformIcons: Record<string, React.ElementType> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  email: Mail,
};

const allPlatforms = ["instagram", "twitter", "linkedin", "facebook", "email"];

function TemplateCard({ 
  template, 
  onEdit, 
  onDuplicate, 
  onToggleFavorite, 
  onDelete,
  onUse,
}: { 
  template: Template;
  onEdit: (template: Template) => void;
  onDuplicate: (template: Template) => void;
  onToggleFavorite: (template: Template) => void;
  onDelete: (template: Template) => void;
  onUse: (template: Template) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="group hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{template.name}</CardTitle>
              {template.isFavorite && (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              )}
            </div>
            <CardDescription className="mt-1">{template.description}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(template)}>
                <Edit className="mr-2 h-4 w-4" />
                {t("templates.editTemplate")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(template)}>
                <Copy className="mr-2 h-4 w-4" />
                {t("templates.duplicate")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleFavorite(template)}>
                <Star className="mr-2 h-4 w-4" />
                {template.isFavorite ? t("templates.removeFromFavorites") : t("templates.addToFavorites")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(template)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("templates.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{t(CATEGORY_KEYS[template.category] || template.category)}</Badge>
            <div className="flex items-center gap-1">
              {template.platforms.map((platform) => {
                const Icon = platformIcons[platform];
                return Icon ? (
                  <div
                    key={platform}
                    className="h-6 w-6 rounded-full bg-muted flex items-center justify-center"
                  >
                    <Icon className="h-3 w-3 text-muted-foreground" />
                  </div>
                ) : null;
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {t("templates.uses", { count: template.uses })}
            </span>
            <Button size="sm" onClick={() => onUse(template)}>{t("templates.useTemplate")}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Templates() {
  const { t } = useTranslation();
  const { addPost } = usePosts();
  const { templates, addTemplate, updateTemplate, deleteTemplate: removeTemplate, duplicateTemplate } = useTemplates();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Templates");
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Marketing");
  const [formContent, setFormContent] = useState("");
  const [formPlatforms, setFormPlatforms] = useState<string[]>([]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === "All Templates" || template.category === activeCategory;
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "favorites" && template.isFavorite) ||
        (activeTab === "recent" && new Date(template.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      return matchesSearch && matchesCategory && matchesTab;
    });
  }, [templates, searchQuery, activeCategory, activeTab]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { "All Templates": templates.length };
    templates.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [templates]);

  const createdThisMonthCount = templates.filter(tpl => {
    const created = new Date(tpl.createdAt);
    const now = new Date();
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }).length;

  const recentlyAddedCount = templates.filter(
    tpl => new Date(tpl.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  const topCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    templates.forEach(tpl => { counts[tpl.category] = (counts[tpl.category] || 0) + 1; });
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [templates]);

  const stats = [
    {
      label: t("templates.totalTemplates"),
      value: templates.length.toString(),
      icon: FileText,
      trend: createdThisMonthCount > 0 ? t("templates.createdThisMonth", { count: createdThisMonthCount }) : "",
    },
    {
      label: t("templates.timesUsed"),
      value: templates.reduce((sum, tpl) => sum + tpl.uses, 0).toLocaleString(),
      icon: Copy,
      trend: "",
    },
    {
      label: t("templates.favorites"),
      value: templates.filter(tpl => tpl.isFavorite).length.toString(),
      icon: Star,
      trend: topCategory ? t("templates.topCategory", { category: t(CATEGORY_KEYS[topCategory] || topCategory) }) : "",
    },
    {
      label: t("templates.recentlyAdded"),
      value: recentlyAddedCount.toString(),
      icon: Users,
      trend: recentlyAddedCount > 0 ? t("templates.newThisWeek", { count: recentlyAddedCount }) : "",
    },
  ];

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormCategory("Marketing");
    setFormContent("");
    setFormPlatforms([]);
    setEditingTemplate(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description);
    setFormCategory(template.category);
    setFormContent(template.content || "");
    setFormPlatforms(template.platforms);
    setDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!formName.trim()) {
      toast.error(t("templates.nameRequired"));
      return;
    }

    if (editingTemplate) {
      updateTemplate(editingTemplate.id, {
        name: formName,
        description: formDescription,
        category: formCategory,
        content: formContent,
        platforms: formPlatforms,
      });
      toast.success(t("templates.templateUpdated"));
    } else {
      addTemplate.mutate({
        name: formName,
        description: formDescription,
        category: formCategory,
        platforms: formPlatforms,
        content: formContent,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDuplicate = (template: Template) => {
    duplicateTemplate.mutate(template);
  };

  const handleToggleFavorite = (template: Template) => {
    updateTemplate(template.id, { isFavorite: !template.isFavorite });
    toast.success(template.isFavorite ? t("templates.removedFromFavorites") : t("templates.addedToFavorites"));
  };

  const handleDeleteConfirm = () => {
    if (!deleteTemplate) return;
    removeTemplate(deleteTemplate.id);
    setDeleteTemplate(null);
  };

  const handleUseTemplate = (template: Template) => {
    updateTemplate(template.id, { uses: template.uses + 1 });
    if (template.content) {
      navigator.clipboard.writeText(template.content);
      toast.success(t("templates.contentCopied"));
    } else {
      toast.success(t("templates.templateApplied"));
    }
  };

  const togglePlatform = (platform: string) => {
    setFormPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleImport = (data: any) => {
    // Detect Universal JSON Template (UJT)
    if (data.version === "1.0" && Array.isArray(data.items)) {
      let scheduledCount = 0;
      data.items.forEach((item: any) => {
        if (item.type === "POST" || item.type === "ARTICLE") {
          const platforms = item.metadata?.platforms || [];
          let scheduledAt = item.metadata?.scheduled_at;
          
          if (!scheduledAt && platforms.length > 0) {
            // AI distributes payload to the optimal calendar slot automatically
            scheduledAt = getNextOptimalDate(platforms[0]).toISOString();
          }

          addPost.mutate({
            post: {
              title: item.data?.title || "AI Generated Content",
              content: item.data?.content || "",
              type: item.type.toLowerCase() as any,
              status: scheduledAt ? "scheduled" : "draft",
              scheduled_at: scheduledAt || null,
            },
            platforms: platforms
          });
          scheduledCount++;
        }
      });
      toast.success(t("templates.processedUjt", { count: scheduledCount }));
      return;
    }

    const items = Array.isArray(data) ? data : [data];
    items.forEach((item: any) => {
      addTemplate.mutate({
        name: item.name || item.title || "Untitled Template",
        description: item.description || "",
        category: item.category || "Content",
        content: item.content || "",
        platforms: item.platforms || [],
      });
    });
  };

  return (
    <DragDropImport onImport={handleImport} entityName={t("templates.entityName")}>
      <DashboardLayout>
        <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title mb-2">{t("templates.title")}</h1>
            <p className="text-muted-foreground">
              {t("templates.subtitle")}
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("templates.createTemplate")}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    {stat.trend && <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Categories Sidebar */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="text-base">{t("templates.categories")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {categories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => setActiveCategory(category.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm ${
                    activeCategory === category.name
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <category.icon className="h-4 w-4" />
                    <span>{t(CATEGORY_KEYS[category.name] || category.name)}</span>
                  </div>
                  <Badge 
                    variant={activeCategory === category.name ? "secondary" : "outline"} 
                    className="text-xs"
                  >
                    {categoryCounts[category.name] || 0}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Templates List */}
          <div className="lg:col-span-3 space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("templates.searchPlaceholder")}
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList>
                  <TabsTrigger value="all">{t("templates.all")}</TabsTrigger>
                  <TabsTrigger value="favorites">{t("templates.favorites")}</TabsTrigger>
                  <TabsTrigger value="recent">{t("templates.recent")}</TabsTrigger>
                  <TabsTrigger value="import" className="hidden">{t("templates.import")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {activeTab === "import" && (
              <Card className="border-dashed border-2 bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t("templates.importTemplatesTitle")}</h3>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    {t("templates.importTemplatesDesc")}
                  </p>
                  <Button variant="outline" className="cursor-default">
                    {t("templates.dropJsonHere")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Templates Grid */}
            {activeTab !== "import" && (filteredTemplates.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredTemplates.map((template) => (
                  <TemplateCard 
                    key={template.id} 
                    template={template}
                    onEdit={openEditDialog}
                    onDuplicate={handleDuplicate}
                    onToggleFavorite={handleToggleFavorite}
                    onDelete={setDeleteTemplate}
                    onUse={handleUseTemplate}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={FileText}
                    title={t("templates.noTemplatesFound")}
                    description={
                      searchQuery || activeCategory !== "All Templates"
                        ? t("templates.adjustFilters")
                        : t("templates.createFirstTemplate")
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Create/Edit Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? t("templates.editTemplate") : t("templates.createTemplate")}</DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? t("templates.updateDialogDesc")
                : t("templates.createDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("templates.name")}</Label>
              <Input
                id="name"
                placeholder={t("templates.namePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("templates.description")}</Label>
              <Input
                id="description"
                placeholder={t("templates.descriptionPlaceholder")}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{t("templates.category")}</Label>
              <select
                id="category"
                title={t("templates.category")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {categories.filter(c => c.name !== "All Templates").map((cat) => (
                  <option key={cat.name} value={cat.name}>{t(CATEGORY_KEYS[cat.name] || cat.name)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("templates.platforms")}</Label>
              <div className="flex flex-wrap gap-3">
                {allPlatforms.map((platform) => {
                  const Icon = platformIcons[platform];
                  return (
                    <label key={platform} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={formPlatforms.includes(platform)}
                        onCheckedChange={() => togglePlatform(platform)}
                      />
                      <Icon className="h-4 w-4" />
                      <span className="text-sm capitalize">{platform}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">{t("templates.templateContent")}</Label>
              <Textarea
                id="content"
                placeholder={t("templates.templateContentPlaceholder")}
                rows={5}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveTemplate}>
              {editingTemplate ? t("templates.saveChanges") : t("templates.createTemplate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={(open) => !open && setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("templates.deleteTemplate")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("templates.deleteConfirm", { name: deleteTemplate?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("templates.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
    </DragDropImport>
  );
}
