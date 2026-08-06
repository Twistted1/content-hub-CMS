import { useState } from "react";
import { CreditCard, Check, Crown, Zap, Rocket, Star, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useSubscription, type SubscriptionTier } from "@/hooks/useSubscription";

interface Plan {
  id: SubscriptionTier;
  name: string;
  price: number;
  description: string;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
}

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, starter: 1, pro: 2 };

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Perfect for individuals getting started",
    icon: <Rocket className="h-5 w-5" />,
    features: [
      "3 connected platforms",
      "50 scheduled posts/month",
      "Basic analytics",
      "Community support",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 10,
    description: "For solo creators ready to scale",
    icon: <Zap className="h-5 w-5" />,
    features: [
      "6 connected platforms",
      "300 scheduled posts/month",
      "Standard analytics",
      "Up to 2 team members",
      "Email support",
      "Basic automation workflows",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 20,
    description: "For growing teams and businesses",
    icon: <Crown className="h-5 w-5" />,
    popular: true,
    features: [
      "Unlimited platforms",
      "Unlimited scheduled posts",
      "Advanced analytics & reports",
      "Unlimited AI Assistant",
      "Full automation workflows",
      "API access",
      "Priority support",
    ],
  },
];

export function BillingSettings() {
  const { t } = useTranslation();
  const { tier, subscribed, billingInterval, subscriptionEnd, createCheckout, openCustomerPortal } = useSubscription();

  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const currentPlan = plans.find((p) => p.id === tier) || plans[0];
  const getYearlyPrice = (monthlyPrice: number) => Math.round(monthlyPrice * 12 * 0.8); // 20% discount

  const handleManageBilling = async () => {
    setIsRedirecting(true);
    try {
      await openCustomerPortal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.billing.toastPortalError"));
    } finally {
      setIsRedirecting(false);
    }
  };

  const handlePlanAction = (plan: Plan) => {
    // Downgrading (including cancelling to Free) happens inside Stripe's own portal.
    if (TIER_RANK[plan.id] < TIER_RANK[tier]) {
      handleManageBilling();
      return;
    }
    setSelectedPlan(plan);
    setShowUpgradeDialog(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan || selectedPlan.id === "free") return;
    setIsRedirecting(true);
    try {
      await createCheckout(selectedPlan.id, billingPeriod);
      toast.success(t("settings.billing.toastRedirectingCheckout"));
      setShowUpgradeDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.billing.toastCheckoutError"));
    } finally {
      setIsRedirecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            {t("settings.billing.currentPlanTitle")}
          </CardTitle>
          <CardDescription>
            {t("settings.billing.currentPlanDescPrefix")}{" "}
            <span className="font-medium text-foreground">
              {t(`settings.billing.plansData.${currentPlan.id}.name`)}
            </span>{" "}
            {t("settings.billing.currentPlanDescSuffix")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <p className="text-2xl font-bold">
              ${subscribed && billingInterval === "yearly" ? getYearlyPrice(currentPlan.price) : currentPlan.price}
              <span className="text-sm font-normal text-muted-foreground">
                /{subscribed && billingInterval === "yearly" ? t("settings.billing.year") : t("settings.billing.month")}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {subscribed && subscriptionEnd
                ? t("settings.billing.renewsOn", { date: new Date(subscriptionEnd).toLocaleDateString() })
                : t("settings.billing.onFreePlan")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>{t("settings.billing.compareTitle")}</CardTitle>
              <CardDescription>{t("settings.billing.compareDesc")}</CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Label htmlFor="billing-period" className="text-sm">{t("settings.billing.monthly")}</Label>
              <Switch
                id="billing-period"
                checked={billingPeriod === "yearly"}
                onCheckedChange={(checked) => setBillingPeriod(checked ? "yearly" : "monthly")}
              />
              <Label htmlFor="billing-period" className="text-sm">
                {t("settings.billing.yearly")} <Badge variant="secondary" className="ml-1">{t("settings.billing.save20")}</Badge>
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.id === currentPlan.id
                    ? "border-primary"
                    : plan.popular
                    ? "border-primary/50"
                    : ""
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <Star className="h-3 w-3 mr-1" />
                    {t("settings.billing.mostPopular")}
                  </Badge>
                )}
                {plan.id === currentPlan.id && (
                  <Badge variant="secondary" className="absolute -top-2 right-4">
                    {t("settings.billing.current")}
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {plan.icon}
                  </div>
                  <CardTitle className="text-lg">{t(`settings.billing.plansData.${plan.id}.name`)}</CardTitle>
                  <CardDescription className="text-xs">{t(`settings.billing.plansData.${plan.id}.description`)}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-4">
                    <span className="text-3xl font-bold">
                      ${billingPeriod === "monthly" ? plan.price : getYearlyPrice(plan.price)}
                    </span>
                    <span className="text-muted-foreground">
                      /{billingPeriod === "monthly" ? t("settings.billing.mo") : t("settings.billing.yr")}
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm text-left mb-4">
                    {(t(`settings.billing.plansData.${plan.id}.features`, { returnObjects: true }) as string[]).map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.id === currentPlan.id ? "outline" : "default"}
                    disabled={plan.id === currentPlan.id || isRedirecting}
                    onClick={() => handlePlanAction(plan)}
                  >
                    {plan.id === currentPlan.id
                      ? t("settings.billing.currentPlanButton")
                      : TIER_RANK[plan.id] > TIER_RANK[currentPlan.id]
                      ? t("settings.billing.upgrade")
                      : t("settings.billing.downgrade")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Manage Billing — payment methods, invoices, and cancellation all live in Stripe's portal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("settings.billing.manageBillingTitle")}
          </CardTitle>
          <CardDescription>{t("settings.billing.manageBillingDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {subscribed ? (
            <Button onClick={handleManageBilling} disabled={isRedirecting}>
              {isRedirecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              {t("settings.billing.openBillingPortal")}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("settings.billing.noBillingYet")}</p>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlan && TIER_RANK[selectedPlan.id] > TIER_RANK[currentPlan.id]
                ? t("settings.billing.upgrade")
                : t("common.change")}{" "}
              {t("settings.billing.upgradeDialogTo")} {selectedPlan && t(`settings.billing.plansData.${selectedPlan.id}.name`)}
            </DialogTitle>
            <DialogDescription>
              {t("settings.billing.upgradeDialogChargeNotice")} ${billingPeriod === "monthly"
                ? selectedPlan?.price
                : getYearlyPrice(selectedPlan?.price || 0)}/{billingPeriod === "monthly" ? t("settings.billing.month") : t("settings.billing.year")} {t("settings.billing.startingToday")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {t("settings.billing.newPlanIncludes")}
            </p>
            <ul className="mt-2 space-y-1">
              {selectedPlan && (t(`settings.billing.plansData.${selectedPlan.id}.features`, { returnObjects: true }) as string[]).map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)} disabled={isRedirecting}>
              {t("settings.billing.cancel")}
            </Button>
            <Button onClick={confirmUpgrade} disabled={isRedirecting}>
              {isRedirecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("settings.billing.confirmChange")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
