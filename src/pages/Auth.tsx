import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Chrome, PlayCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authSchema } from '@/utils/authValidation';

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithDemo } = useAuth();
  const { toast } = useToast();
  const fromLocation = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  const fromPath = fromLocation
    ? `${fromLocation.pathname || '/dashboard'}${fromLocation.search || ''}${fromLocation.hash || ''}`
    : '/dashboard';
  const isPreviewHost = /(^|\.)lovable(project)?\.com$|(^|\.)lovable\.app$/.test(window.location.hostname);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Support ?tab=signup or ?tab=signin to deep-link to a specific tab
  const defaultTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';

  useEffect(() => {
    if (!loading && user) {
      navigate(fromPath, { replace: true });
    }
  }, [user, loading, navigate, fromPath]);

  useEffect(() => {
    if (loading || user || isSubmitting || !isPreviewHost) return;

    let cancelled = false;
    setIsSubmitting(true);
    signInWithDemo().then(({ error }) => {
      if (cancelled) return;
      setIsSubmitting(false);
      if (error) {
        toast({
          title: t("auth.demoSignInFailed"),
          description: error.message,
          variant: "destructive",
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loading, user, isSubmitting, isPreviewHost, signInWithDemo, toast]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        title: t("auth.validationError"),
        description: validation.error.errors[0]?.message,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await signInWithEmail(email, password);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: t("auth.signInFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = authSchema.safeParse({ email, password, fullName });
    if (!validation.success) {
      toast({
        title: t("auth.validationError"),
        description: validation.error.errors[0]?.message,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await signUpWithEmail(email, password, fullName || undefined);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: t("auth.signUpFailed"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: t("auth.checkEmail"),
        description: t("auth.checkEmailDesc"),
      });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    setIsSubmitting(false);

    if (error) {
      toast({
        title: t("auth.googleSignInFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDemoSignIn = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithDemo();
    setIsSubmitting(false);

    if (error) {
      toast({
        title: t("auth.demoSignInFailed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">CH</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t("auth.welcomeTitle")}</CardTitle>
          <CardDescription>
            {t("auth.welcomeSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">{t("auth.signIn")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.signUp")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t("auth.email")}</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">{t("auth.password")}</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("auth.signIn")
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t("auth.fullName")}</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t("auth.email")}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t("auth.password")}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("auth.createAccount")
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t("auth.orContinueWith")}</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <Chrome className="mr-2 h-4 w-4" />
            {t("auth.google")}
          </Button>

          {isPreviewHost && (
            <>
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={handleDemoSignIn}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                {t("auth.enterDemo")}
              </Button>

              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>{t("auth.googleInfoTitle")}</strong>{' '}
                  {t("auth.googleInfoPrefix")}{' '}
                  <a
                    href="https://supabase.com/dashboard/project/jvbucspwcjahqpoxskvr/auth/providers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-primary"
                  >
                    {t("auth.supabaseDashboard")}
                  </a>
                  {t("auth.googleInfoSuffix")}
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
