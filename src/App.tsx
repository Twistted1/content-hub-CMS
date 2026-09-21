import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { lazy, Suspense, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RouteFallback } from "@/components/ui/RouteFallback";
import { useUserPreferencesStore } from "@/stores/useUserPreferencesStore";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Route-level code splitting: every page but Landing and Auth becomes its own
// chunk, so the entry bundle carries only the shell (providers, router, auth).
// Landing and Auth stay eager because they are what an unauthenticated first
// visit renders.
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";

const Pricing = lazy(() => import("./pages/Pricing"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const Index = lazy(() => import("./pages/Index"));
const Automation = lazy(() => import("./pages/Automation"));
const Platforms = lazy(() => import("./pages/Platforms"));
const ContentCalendar = lazy(() => import("./pages/Calendar"));
const Projects = lazy(() => import("./pages/Projects"));
const Strategies = lazy(() => import("./pages/Strategies"));
const Notes = lazy(() => import("./pages/Notes"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Reports = lazy(() => import("./pages/Reports"));
const GanttChart = lazy(() => import("./pages/GanttChart"));
const Templates = lazy(() => import("./pages/Templates"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
const UsersPage = lazy(() => import("./pages/Users"));
const ImportData = lazy(() => import("./pages/ImportData"));
const Settings = lazy(() => import("./pages/Settings"));
const Articles = lazy(() => import("./pages/Articles"));
const ContentModel = lazy(() => import("./pages/ContentModel"));
const ContentPipeline = lazy(() => import("./pages/ContentPipeline"));
const WorkflowTest = lazy(() => import("./pages/WorkflowTest"));
const Review = lazy(() => import("./pages/Review"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const isPreviewHost = () =>
  typeof window !== "undefined" &&
  /(^|\.)lovable(project)?\.com$|(^|\.)lovable\.app$/.test(window.location.hostname);

const HomeRoute = () => (
  isPreviewHost() ? <ProtectedRoute><Index /></ProtectedRoute> : <Landing />
);

/**
 * Bridges the Zustand AppStore theme value to next-themes.
 * Must be rendered inside <ThemeProvider>.
 */
function ThemeSync() {
  const { appearance } = useUserPreferencesStore();
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(appearance.theme);
  }, [appearance.theme, setTheme]);
  return null;
}

/**
 * Syncs the real logged-in identity into the profile store on login. Without this,
 * the header/sidebar/everywhere-else profile display stays on the hardcoded
 * "Admin User" / "admin@company.com" placeholder until the user manually visits
 * Settings > Profile and clicks Save at least once -- email is always authoritative
 * from auth, never something to fake here.
 */
function ProfileSync() {
  const { user } = useAuth();
  const { updateProfile } = useUserPreferencesStore();

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, company_name, bio")
        .eq("user_id", user.id)
        .single();

      const name = data?.display_name || user.email!.split("@")[0];
      const initials = name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      updateProfile({
        id: user.id,
        name,
        email: user.email!,
        initials,
        avatar: data?.avatar_url ?? undefined,
        company: data?.company_name ?? "",
        bio: data?.bio ?? "",
      });
    })();
  }, [user, updateProfile]);

  return null;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark">
    <ThemeSync />
    <ProfileSync />
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public pages */}
                <Route path="/" element={<HomeRoute />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/cookies" element={<Cookies />} />
                <Route path="/auth" element={<Auth />} />
              
                {/* Protected dashboard routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/automation" element={<ProtectedRoute><Automation /></ProtectedRoute>} />
                <Route path="/platforms" element={<ProtectedRoute><Platforms /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><ContentCalendar /></ProtectedRoute>} />
                <Route path="/articles" element={<ProtectedRoute><Articles /></ProtectedRoute>} />
                <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
                <Route path="/strategies" element={<ProtectedRoute><Strategies /></ProtectedRoute>} />
                <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/gantt" element={<ProtectedRoute><GanttChart /></ProtectedRoute>} />
                <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
                <Route path="/ai" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
                <Route path="/import" element={<ProtectedRoute><ImportData /></ProtectedRoute>} />
                <Route path="/pipeline" element={<ProtectedRoute><ContentPipeline /></ProtectedRoute>} />
                <Route path="/models" element={<ProtectedRoute><ContentModel /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/workflow" element={<ProtectedRoute><WorkflowTest /></ProtectedRoute>} />
                <Route path="/review" element={<ProtectedRoute><Review /></ProtectedRoute>} />
              
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </ThemeProvider>
);

export default App;
