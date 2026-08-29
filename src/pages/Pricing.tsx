import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, ArrowLeft, Zap, Rocket, Sparkles, Loader2 } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { useSubscription, type BillingInterval } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

type PlanKey = 'free' | 'starter' | 'pro';

interface PlanDef {
  key: PlanKey;
  monthly: number;
  yearly: number;
  icon: typeof Rocket;
  popular: boolean;
}

const plans: PlanDef[] = [
  { key: 'free', monthly: 0, yearly: 0, icon: Rocket, popular: false },
  { key: 'starter', monthly: 10, yearly: 96, icon: Zap, popular: false },
  { key: 'pro', monthly: 20, yearly: 192, icon: Sparkles, popular: true },
];

interface PlanTranslation {
  name: string;
  description: string;
  features: string[];
  cta: string;
}

interface Faq {
  question: string;
  answer: string;
}

export default function Pricing() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { tier, createCheckout, isLoading: subLoading } = useSubscription();
  const [billing, setBilling] = useState<BillingInterval>('monthly');
  const faqs = t('pricing.faqs', { returnObjects: true }) as Faq[];
  useDocumentMeta(t('pricing.heroTitle'), t('pricing.metaDescription'));

  useEffect(() => {
    if (searchParams.get('checkout') === 'canceled') {
      toast.info(t('pricing.toastCheckoutCanceled'));
    }
  }, [searchParams]);

  const handleSubscribe = async (planKey: 'starter' | 'pro') => {
    if (!user) {
      toast.error(t('pricing.toastSignInToSubscribe'));
      return;
    }
    try {
      await createCheckout(planKey, billing);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('pricing.toastCheckoutFailed'));
    }
  };

  const formatPrice = (plan: PlanDef) => {
    if (plan.key === 'free') return { amount: '$0', suffix: t('pricing.forever') };
    const value = billing === 'monthly' ? plan.monthly : plan.yearly;
    return { amount: `$${value}`, suffix: billing === 'monthly' ? t('pricing.perMonth') : t('pricing.perYear') };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">CH</span>
            </div>
            <span className="font-bold text-xl text-foreground">{t('pricing.navBrand')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">{t('pricing.signIn')}</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">{t('pricing.getStarted')}</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-12 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link to="/landing">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('pricing.backToHome')}
            </Link>
          </Button>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t('pricing.heroTitle')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('pricing.heroSubtitle')}
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-center gap-3 mb-10">
            <Label htmlFor="billing-toggle" className={billing === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}>
              {t('pricing.monthly')}
            </Label>
            <Switch
              id="billing-toggle"
              checked={billing === 'yearly'}
              onCheckedChange={(c) => setBilling(c ? 'yearly' : 'monthly')}
            />
            <Label htmlFor="billing-toggle" className={billing === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}>
              {t('pricing.yearly')} <Badge variant="secondary" className="ml-1">{t('pricing.save20')}</Badge>
            </Label>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const { amount, suffix } = formatPrice(plan);
              const isCurrent = tier === plan.key;
              const planT = t(`pricing.plans.${plan.key}`, { returnObjects: true }) as PlanTranslation;
              return (
              <Card
                key={plan.key}
                className={`relative flex flex-col ${
                  plan.popular
                    ? 'border-primary shadow-lg shadow-primary/10'
                    : 'border-border'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    {t('pricing.mostPopular')}
                  </Badge>
                )}
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <plan.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{planT.name}</CardTitle>
                  <CardDescription>{planT.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">{amount}</span>
                    <span className="text-muted-foreground"> {suffix}</span>
                  </div>
                  <ul className="space-y-3">
                    {planT.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {plan.key === 'free' ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={tier === 'free'}
                      asChild={tier !== 'free'}
                    >
                      {tier === 'free' ? (
                        <span>{t('pricing.currentPlan')}</span>
                      ) : (
                        <Link to="/dashboard">{planT.cta}</Link>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      disabled={subLoading || isCurrent}
                      onClick={() => handleSubscribe(plan.key as 'starter' | 'pro')}
                    >
                      {subLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {isCurrent ? t('pricing.currentPlan') : planT.cta}
                    </Button>
                  )}
                </CardFooter>
              </Card>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            {t('pricing.needCustomPrefix')} <a href="mailto:support@contenthub.io" className="text-primary hover:underline">{t('pricing.getInTouch')}</a>.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-card/50 border-t border-border">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
            {t('pricing.faqTitle')}
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question} className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-2">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            {t('pricing.stillHaveQuestions')}
          </h2>
          <p className="text-muted-foreground mb-6">
            {t('pricing.stillHaveQuestionsDesc')}
          </p>
          <Button variant="outline" asChild>
            <a href="mailto:support@contenthub.io">{t('pricing.contactSupport')}</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
