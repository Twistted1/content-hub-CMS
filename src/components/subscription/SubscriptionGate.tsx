import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Zap, Crown, CheckCircle2 } from "lucide-react";
import { useSubscription, SubscriptionTier } from "@/hooks/useSubscription";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";

interface SubscriptionGateProps {
  requiredTier: "pro" | "enterprise";
  feature: string;
  benefits: string[];
  children: ReactNode;
}

const tierRank: Record<SubscriptionTier, number> = { free: 0, pro: 1, enterprise: 2 };

export function SubscriptionGate({ requiredTier, feature, benefits, children }: SubscriptionGateProps) {
  const { tier, isLoading, createCheckout } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (tierRank[tier] >= tierRank[requiredTier]) {
    return <>{children}</>;
  }

  const isPro = requiredTier === "pro";
  const price = isPro ? "$29/mo" : "$99/mo";
  const PlanIcon = isPro ? Zap : Crown;

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-xl shadow-primary/5">
              <Lock className="w-10 h-10 text-primary" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-4">
              <PlanIcon className="w-3 h-3" />
              {requiredTier} Plan Required
            </div>
            <h2 className="text-3xl font-black tracking-tight">{feature}</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Upgrade to unlock this feature and supercharge your content workflow.
            </p>
          </div>

          <ul className="space-y-3 text-left">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{b}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            <Button
              className="w-full h-12 font-black uppercase tracking-widest text-xs"
              onClick={() => createCheckout(requiredTier)}
            >
              <PlanIcon className="w-4 h-4 mr-2" />
              Upgrade to {requiredTier} — {price}
            </Button>
            <Button
              variant="outline"
              className="w-full h-10"
              onClick={() => navigate("/pricing")}
            >
              View All Plans
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
