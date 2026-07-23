import { useState } from "react";
import { CreditCard, Check, Crown, Zap, Rocket, Plus, Trash2, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Plan {
  id: string;
  name: string;
  price: number;
  period: "monthly" | "yearly";
  description: string;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
}

interface PaymentMethod {
  id: string;
  type: "card" | "paypal";
  last4?: string;
  brand?: string;
  email?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  description: string;
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "monthly",
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
    period: "monthly",
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
    period: "monthly",
    description: "For growing teams and businesses",
    icon: <Crown className="h-5 w-5" />,
    popular: true,
    features: [
      "Unlimited platforms",
      "Unlimited scheduled posts",
      "Advanced analytics & reports",
      "Unlimited Novee AI",
      "Full automation workflows",
      "API access",
      "Priority support",
    ],
  },
];

const initialPaymentMethods: PaymentMethod[] = [
  {
    id: "1",
    type: "card",
    last4: "4242",
    brand: "Visa",
    expiryMonth: 12,
    expiryYear: 2026,
    isDefault: true,
  },
  {
    id: "2",
    type: "card",
    last4: "5555",
    brand: "Mastercard",
    expiryMonth: 8,
    expiryYear: 2025,
    isDefault: false,
  },
];

const initialInvoices: Invoice[] = [
  { id: "INV-001", date: "2026-01-01", amount: 29, status: "paid", description: "Professional Plan - January 2026" },
  { id: "INV-002", date: "2025-12-01", amount: 29, status: "paid", description: "Professional Plan - December 2025" },
  { id: "INV-003", date: "2025-11-01", amount: 29, status: "paid", description: "Professional Plan - November 2025" },
];

export function BillingSettings() {
  const { t } = useTranslation();
  const [currentPlan, setCurrentPlan] = useState("pro");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods);
  const [invoices] = useState<Invoice[]>(initialInvoices);
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [newCard, setNewCard] = useState({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
  });

  const handleUpgrade = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowUpgradeDialog(true);
  };

  const confirmUpgrade = () => {
    if (selectedPlan) {
      setCurrentPlan(selectedPlan.id);
      setShowUpgradeDialog(false);
      toast.success(t("settings.billing.toastUpgraded", { plan: t(`settings.billing.plansData.${selectedPlan.id}.name`) }));
    }
  };

  const handleAddCard = () => {
    if (!newCard.number || !newCard.expiry || !newCard.cvc || !newCard.name) {
      toast.error(t("settings.billing.toastFillCardDetails"));
      return;
    }

    const newPaymentMethod: PaymentMethod = {
      id: Date.now().toString(),
      type: "card",
      last4: newCard.number.slice(-4),
      brand: newCard.number.startsWith("4") ? "Visa" : "Mastercard",
      expiryMonth: parseInt(newCard.expiry.split("/")[0]),
      expiryYear: 2000 + parseInt(newCard.expiry.split("/")[1]),
      isDefault: paymentMethods.length === 0,
    };

    setPaymentMethods([...paymentMethods, newPaymentMethod]);
    setNewCard({ number: "", expiry: "", cvc: "", name: "" });
    setShowAddCardDialog(false);
    toast.success(t("settings.billing.toastPaymentMethodAdded"));
  };

  const handleSetDefault = (id: string) => {
    setPaymentMethods(
      paymentMethods.map((pm) => ({
        ...pm,
        isDefault: pm.id === id,
      }))
    );
    toast.success(t("settings.billing.toastDefaultUpdated"));
  };

  const handleRemoveCard = (id: string) => {
    const method = paymentMethods.find((pm) => pm.id === id);
    if (method?.isDefault) {
      toast.error(t("settings.billing.toastCannotRemoveDefault"));
      return;
    }
    setPaymentMethods(paymentMethods.filter((pm) => pm.id !== id));
    toast.success(t("settings.billing.toastPaymentMethodRemoved"));
  };

  const getYearlyPrice = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 12 * 0.8); // 20% discount
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
              {t(`settings.billing.plansData.${currentPlan}.name`)}
            </span>{" "}
            {t("settings.billing.currentPlanDescSuffix")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                ${billingPeriod === "monthly"
                  ? plans.find((p) => p.id === currentPlan)?.price
                  : getYearlyPrice(plans.find((p) => p.id === currentPlan)?.price || 0)}
                <span className="text-sm font-normal text-muted-foreground">
                  /{billingPeriod === "monthly" ? t("settings.billing.month") : t("settings.billing.year")}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {t("settings.billing.nextBillingDate")}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.billing.compareTitle")}</CardTitle>
          <CardDescription>{t("settings.billing.compareDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.id === currentPlan
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
                {plan.id === currentPlan && (
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
                    variant={plan.id === currentPlan ? "outline" : "default"}
                    disabled={plan.id === currentPlan}
                    onClick={() => handleUpgrade(plan)}
                  >
                    {plan.id === currentPlan
                      ? t("settings.billing.currentPlanButton")
                      : plan.price > (plans.find((p) => p.id === currentPlan)?.price || 0)
                      ? t("settings.billing.upgrade")
                      : t("settings.billing.downgrade")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t("settings.billing.paymentMethodsTitle")}
              </CardTitle>
              <CardDescription>{t("settings.billing.paymentMethodsDesc")}</CardDescription>
            </div>
            <Button onClick={() => setShowAddCardDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("settings.billing.addCard")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-14 items-center justify-center rounded bg-muted">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {method.brand} •••• {method.last4}
                      {method.isDefault && (
                        <Badge variant="secondary" className="ml-2">{t("settings.billing.default")}</Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.billing.expires")} {method.expiryMonth}/{method.expiryYear}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(method.id)}
                    >
                      {t("settings.billing.setDefault")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCard(method.id)}
                    disabled={method.isDefault}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.billing.historyTitle")}</CardTitle>
          <CardDescription>{t("settings.billing.historyDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("settings.billing.invoice")}</TableHead>
                <TableHead>{t("settings.billing.date")}</TableHead>
                <TableHead>{t("settings.billing.description")}</TableHead>
                <TableHead>{t("settings.billing.amount")}</TableHead>
                <TableHead>{t("settings.billing.status")}</TableHead>
                <TableHead className="text-right">{t("settings.billing.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                  <TableCell>{invoice.description}</TableCell>
                  <TableCell>${invoice.amount}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        invoice.status === "paid"
                          ? "default"
                          : invoice.status === "pending"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {invoice.status === "paid"
                        ? t("settings.billing.statusPaid")
                        : invoice.status === "pending"
                        ? t("settings.billing.statusPending")
                        : t("settings.billing.statusFailed")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      {t("settings.billing.download")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cancel Subscription */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">{t("settings.billing.cancelSubTitle")}</CardTitle>
          <CardDescription>
            {t("settings.billing.cancelSubDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => toast.info(t("settings.billing.toastCancelFlow"))}>
            {t("settings.billing.cancelSubscription")}
          </Button>
        </CardContent>
      </Card>

      {/* Add Card Dialog */}
      <Dialog open={showAddCardDialog} onOpenChange={setShowAddCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.billing.addPaymentMethodTitle")}</DialogTitle>
            <DialogDescription>{t("settings.billing.addPaymentMethodDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-name">{t("settings.billing.cardholderName")}</Label>
              <Input
                id="card-name"
                placeholder="John Doe"
                value={newCard.name}
                onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-number">{t("settings.billing.cardNumber")}</Label>
              <Input
                id="card-number"
                placeholder="4242 4242 4242 4242"
                value={newCard.number}
                onChange={(e) => setNewCard({ ...newCard, number: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="card-expiry">{t("settings.billing.expiryDate")}</Label>
                <Input
                  id="card-expiry"
                  placeholder="MM/YY"
                  value={newCard.expiry}
                  onChange={(e) => setNewCard({ ...newCard, expiry: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card-cvc">{t("settings.billing.cvc")}</Label>
                <Input
                  id="card-cvc"
                  placeholder="123"
                  value={newCard.cvc}
                  onChange={(e) => setNewCard({ ...newCard, cvc: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCardDialog(false)}>
              {t("settings.billing.cancel")}
            </Button>
            <Button onClick={handleAddCard}>{t("settings.billing.addCardButton")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlan && selectedPlan.price > (plans.find((p) => p.id === currentPlan)?.price || 0)
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
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              {t("settings.billing.cancel")}
            </Button>
            <Button onClick={confirmUpgrade}>{t("settings.billing.confirmChange")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
