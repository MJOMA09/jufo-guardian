import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SifterLogo } from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  // The reset link carries its token in the URL hash, so capture it before
  // Supabase strips the hash out of the address bar.
  const [recoveryRequested] = useState(() =>
    window.location.hash.includes("type=recovery") ||
    window.location.search.includes("type=recovery"),
  );
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setReady(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && recoveryRequested) {
        setReady(true);
        setChecking(false);
      }
    });

    const timer = setTimeout(() => setChecking(false), 2500);
    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [recoveryRequested]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setSubmitting(true);
    // Recovery sessions are exempt from the current-password requirement.
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }

    toast({
      title: "Password updated",
      description: "You're signed in with your new password.",
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle();
        navigate(adminRole ? "/admin" : "/app", { replace: true });
        return;
      }
    } catch {
      // Role lookup is a convenience only; the workspace page re-checks access.
    }
    navigate("/auth", { replace: true });
  };

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <SifterLogo className="h-24 w-auto max-w-[400px]" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Choose a new password
          </CardTitle>
          <CardDescription>
            Pick a password you haven't used on this account before.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checking && !ready ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying your reset link…
            </div>
          ) : !ready ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  This reset link is missing or has expired. Request a new one and open the link
                  from your email.
                </AlertDescription>
              </Alert>
              <Button className="w-full" asChild>
                <Link to="/auth">Request a new link</Link>
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={cn("pr-10", show && "pr-20")}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((value) => !value)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center gap-1 px-3 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {show ? (
                      <>
                        <span className="hidden sm:inline">Hide</span>
                        <EyeOff className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Show</span>
                        <Eye className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Update password
                  </span>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
