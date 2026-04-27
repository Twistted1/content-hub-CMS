import { User, Bell, Shield, Palette, CreditCard, ChevronLeft, Link2, Database } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { BillingSettings } from "@/components/settings/BillingSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { DataSettings } from "@/components/settings/DataSettings";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "profile";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-6 mb-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0 h-12 w-12 rounded-2xl bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08] text-white transition-all"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase head-neon mb-2">Settings</h1>
            <p className="text-sm text-muted-foreground font-medium opacity-60">
              Configure your neural parameters and system preferences.
            </p>
          </div>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
          <TabsList className="bg-white/[0.03] border border-white/[0.08] p-1.5 rounded-2xl h-auto flex flex-wrap max-w-fit">
            <TabsTrigger value="profile" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <User className="h-3.5 w-3.5" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Bell className="h-3.5 w-3.5" />
              <span>Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Shield className="h-3.5 w-3.5" />
              <span>Security</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <CreditCard className="h-3.5 w-3.5" />
              <span>Billing</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Link2 className="h-3.5 w-3.5" />
              <span>Links</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Database className="h-3.5 w-3.5" />
              <span>Data</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Palette className="h-3.5 w-3.5" />
              <span>Theme</span>
            </TabsTrigger>
          </TabsList>

          <div className="max-w-5xl">
            <TabsContent value="profile" className="mt-0">
              <ProfileSettings />
            </TabsContent>
            <TabsContent value="notifications" className="mt-0">
              <NotificationSettings />
            </TabsContent>
            <TabsContent value="security" className="mt-0">
              <SecuritySettings />
            </TabsContent>
            <TabsContent value="billing" className="mt-0">
              <BillingSettings />
            </TabsContent>
            <TabsContent value="integrations" className="mt-0">
              <IntegrationsSettings />
            </TabsContent>
            <TabsContent value="data" className="mt-0">
              <DataSettings />
            </TabsContent>
            <TabsContent value="appearance" className="mt-0">
              <AppearanceSettings />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
