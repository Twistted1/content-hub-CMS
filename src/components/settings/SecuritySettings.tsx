import { useEffect, useState } from "react";
import { Shield, Key, Smartphone, AlertTriangle, Eye, EyeOff, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserPreferencesStore } from "@/stores/useUserPreferencesStore";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

export function SecuritySettings() {
  const { t } = useTranslation();
  const { security, updateSecurity } = useUserPreferencesStore();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaQrSvg, setMfaQrSvg] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load real MFA enrollment status from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled || error) return;
      const verified = (data?.totp ?? []).some((f) => f.status === "verified");
      setMfaEnrolled(verified);
      if (verified !== security.twoFactorEnabled) {
        updateSecurity({ twoFactorEnabled: verified });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t("settings.security.toastPasswordMismatch"));
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error(t("settings.security.toastPasswordTooShort"));
      return;
    }
    setIsChangingPassword(true);
    try {
      // Re-authenticate with current password — Supabase updateUser does not verify it
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) {
        toast.error(t("settings.security.toastMustBeSignedIn"));
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordForm.currentPassword,
      });
      if (signInError) {
        toast.error(t("settings.security.toastCurrentPasswordIncorrect"));
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("settings.security.toastPasswordUpdated"));
      setShowPasswordDialog(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handle2FAToggle = async () => {
    if (mfaEnrolled) {
      // Real disable: unenroll all TOTP factors
      setMfaBusy(true);
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        for (const f of data?.totp ?? []) {
          const { error: unErr } = await supabase.auth.mfa.unenroll({ factorId: f.id });
          if (unErr) throw unErr;
        }
        setMfaEnrolled(false);
        updateSecurity({ twoFactorEnabled: false });
        toast.success(t("settings.security.toast2FADisabled"));
      } catch (e: any) {
        toast.error(e?.message ?? t("settings.security.toast2FADisableFailed"));
      } finally {
        setMfaBusy(false);
      }
      return;
    }
    // Begin enrollment
    setMfaBusy(true);
    try {
      // Clean any unverified factors first
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.totp ?? []) {
        if (f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setMfaFactorId(data.id);
      setMfaQrSvg(data.totp?.qr_code ?? null);
      setMfaSecret(data.totp?.secret ?? null);
      setMfaCode("");
      setShow2FADialog(true);
    } catch (e: any) {
      toast.error(e?.message ?? t("settings.security.toast2FAEnrollFailed"));
    } finally {
      setMfaBusy(false);
    }
  };

  const verify2FA = async () => {
    if (!mfaFactorId) return;
    if (!/^\d{6}$/.test(mfaCode)) {
      toast.error(t("settings.security.toastEnterCode"));
      return;
    }
    setMfaBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode,
      });
      if (error) throw error;
      setMfaEnrolled(true);
      updateSecurity({ twoFactorEnabled: true });
      toast.success(t("settings.security.toast2FAEnabled"));
      setShow2FADialog(false);
      setMfaFactorId(null);
      setMfaQrSvg(null);
      setMfaSecret(null);
      setMfaCode("");
    } catch (e: any) {
      toast.error(e?.message ?? t("settings.security.toastVerificationFailed"));
    } finally {
      setMfaBusy(false);
    }
  };

  const cancel2FA = async () => {
    if (mfaFactorId) {
      try {
        await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      } catch {
        /* ignore */
      }
    }
    setShow2FADialog(false);
    setMfaFactorId(null);
    setMfaQrSvg(null);
    setMfaSecret(null);
    setMfaCode("");
  };

  const signOutOtherSessions = async () => {
    setRevokingSessions(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast.success(t("settings.security.toastSignedOutOthers"));
    } catch (e: any) {
      toast.error(e?.message ?? t("settings.security.toastSignOutOthersFailed"));
    } finally {
      setRevokingSessions(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t("settings.security.passwordTitle")}
          </CardTitle>
          <CardDescription>
            {t("settings.security.passwordCardDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.security.password")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.security.lastChanged")}
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
              {t("settings.security.changePassword")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t("settings.security.twoFactorTitle")}
          </CardTitle>
          <CardDescription>
            {t("settings.security.twoFactorCardDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex items-center gap-3">
              <div>
                <Label>{t("settings.security.twoFactor")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.security.twoFactorDesc")}
                </p>
              </div>
              {mfaEnrolled && (
                <Badge variant="secondary" className="bg-success/10 text-success">
                  {t("settings.security.enabled")}
                </Badge>
              )}
            </div>
            <Switch
              checked={mfaEnrolled}
              onCheckedChange={handle2FAToggle}
              disabled={mfaBusy}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("settings.security.preferencesTitle")}
          </CardTitle>
          <CardDescription>
            {t("settings.security.preferencesDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.security.sessionTimeout")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.security.sessionTimeoutDesc")}
              </p>
            </div>
            <Select
              value={security.sessionTimeout.toString()}
              onValueChange={(value) =>
                updateSecurity({ sessionTimeout: parseInt(value) })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">{t("settings.security.min15")}</SelectItem>
                <SelectItem value="30">{t("settings.security.min30")}</SelectItem>
                <SelectItem value="60">{t("settings.security.hour1")}</SelectItem>
                <SelectItem value="120">{t("settings.security.hour2")}</SelectItem>
                <SelectItem value="0">{t("settings.security.never")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.security.loginAlerts")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.security.loginAlertsDesc")}
              </p>
            </div>
            <Switch
              checked={security.loginAlerts}
              onCheckedChange={(checked) =>
                updateSecurity({ loginAlerts: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.security.sessionsTitle")}</CardTitle>
          <CardDescription>
            {t("settings.security.sessionsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.security.signOutOthers")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.security.signOutOthersDesc")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={signOutOtherSessions}
              disabled={revokingSessions}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {revokingSessions ? t("settings.security.signingOut") : t("settings.security.signOutOthersButton")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t("settings.security.dangerZone")}
          </CardTitle>
          <CardDescription>
            {t("settings.security.dangerZoneDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.security.deleteAccount")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.security.deleteAccountDesc")}
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => toast.error(t("settings.security.toastDeleteRequiresConfirm"))}
            >
              {t("settings.security.deleteAccount")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.security.changePasswordDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.security.changePasswordDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t("settings.security.currentPassword")}</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("settings.security.newPassword")}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      newPassword: e.target.value,
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("settings.security.confirmNewPassword")}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              {t("settings.security.cancel")}
            </Button>
            <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
              {isChangingPassword ? t("settings.security.updating") : t("settings.security.updatePassword")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <Dialog
        open={show2FADialog}
        onOpenChange={(open) => {
          if (!open) cancel2FA();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.security.enable2FATitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.security.enable2FADesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted p-8 rounded-lg flex items-center justify-center">
              {mfaQrSvg ? (
                <div
                  className="w-40 h-40 [&>svg]:w-full [&>svg]:h-full bg-white rounded p-2"
                  dangerouslySetInnerHTML={{ __html: mfaQrSvg }}
                />
              ) : (
                <div className="w-40 h-40 bg-foreground/10 rounded flex items-center justify-center text-muted-foreground">
                  {t("settings.security.qrLoading")}
                </div>
              )}
            </div>
            {mfaSecret && (
              <p className="text-xs text-muted-foreground text-center break-all">
                {t("settings.security.enterSecretManually")} <span className="font-mono">{mfaSecret}</span>
              </p>
            )}
            <div className="space-y-2">
              <Label>{t("settings.security.verificationCode")}</Label>
              <Input
                placeholder={t("settings.security.enterCodePlaceholder")}
                maxLength={6}
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancel2FA} disabled={mfaBusy}>
              {t("settings.security.cancel")}
            </Button>
            <Button onClick={verify2FA} disabled={mfaBusy || mfaCode.length !== 6}>
              {mfaBusy ? t("settings.security.verifying") : t("settings.security.enable2FA")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
