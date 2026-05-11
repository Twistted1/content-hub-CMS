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

export function SecuritySettings() {
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
      toast.error("Passwords do not match");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setIsChangingPassword(true);
    try {
      // Re-authenticate with current password — Supabase updateUser does not verify it
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) {
        toast.error("You must be signed in to change your password");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordForm.currentPassword,
      });
      if (signInError) {
        toast.error("Current password is incorrect");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated successfully");
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
        toast.success("Two-factor authentication disabled");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to disable 2FA");
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
      toast.error(e?.message ?? "Failed to start 2FA enrollment");
    } finally {
      setMfaBusy(false);
    }
  };

  const verify2FA = async () => {
    if (!mfaFactorId) return;
    if (!/^\d{6}$/.test(mfaCode)) {
      toast.error("Enter the 6-digit code from your authenticator app");
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
      toast.success("Two-factor authentication enabled");
      setShow2FADialog(false);
      setMfaFactorId(null);
      setMfaQrSvg(null);
      setMfaSecret(null);
      setMfaCode("");
    } catch (e: any) {
      toast.error(e?.message ?? "Verification failed");
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
      toast.success("All other sessions have been signed out");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to sign out other sessions");
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
            Password
          </CardTitle>
          <CardDescription>
            Manage your password and authentication settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Password</Label>
              <p className="text-sm text-muted-foreground">
                Last changed 30 days ago
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex items-center gap-3">
              <div>
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Require a verification code when signing in
                </p>
              </div>
              {mfaEnrolled && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                  Enabled
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
            Security Preferences
          </CardTitle>
          <CardDescription>
            Configure security preferences for your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Session Timeout</Label>
              <p className="text-sm text-muted-foreground">
                Automatically log out after inactivity
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
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="0">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Login Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified of new sign-ins to your account
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
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Sign out of every other device where this account is logged in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sign out other sessions</Label>
              <p className="text-sm text-muted-foreground">
                Revokes refresh tokens on every other device. This session stays signed in.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={signOutOtherSessions}
              disabled={revokingSessions}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {revokingSessions ? "Signing out..." : "Sign out others"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Delete Account</Label>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => toast.error("Account deletion requires confirmation")}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
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
              <Label htmlFor="new-password">New Password</Label>
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
              <Label htmlFor="confirm-password">Confirm New Password</Label>
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
              Cancel
            </Button>
            <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
              {isChangingPassword ? "Updating..." : "Update Password"}
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
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app to enable 2FA.
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
                  Loading…
                </div>
              )}
            </div>
            {mfaSecret && (
              <p className="text-xs text-muted-foreground text-center break-all">
                Or enter this secret manually: <span className="font-mono">{mfaSecret}</span>
              </p>
            )}
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input
                placeholder="Enter 6-digit code"
                maxLength={6}
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancel2FA} disabled={mfaBusy}>
              Cancel
            </Button>
            <Button onClick={verify2FA} disabled={mfaBusy || mfaCode.length !== 6}>
              {mfaBusy ? "Verifying..." : "Enable 2FA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
