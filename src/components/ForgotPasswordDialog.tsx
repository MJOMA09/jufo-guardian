import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { KeyRound, Loader2, MailCheck } from "lucide-react";

type Props = {
  /** Extra classes for the "Forgot password?" trigger. */
  className?: string;
  /** Where the reset link should land once the user clicks it. */
  redirectTo?: string;
};

export function ForgotPasswordDialog({ className, redirectTo }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const target = redirectTo ?? `${window.location.origin}/reset-password`;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // The dialog can be mounted inside a sign-in form, so keep this submit from
    // bubbling up and triggering that form's handler with empty credentials.
    event.stopPropagation();
    setSending(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: target },
    );
    setSending(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          className={cn("h-auto p-0 text-xs font-normal text-muted-foreground", className)}
        >
          Forgot password?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Reset your password
          </DialogTitle>
          <DialogDescription>
            Enter the email on your Sifter account and we'll send a link to choose a new password.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
              <MailCheck className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="text-sm font-medium">Check your email</p>
              <p className="mt-1 text-sm text-muted-foreground">
                If there's an account for {email.trim().toLowerCase()}, a reset link is on its way.
                It expires in an hour — open it and follow the prompt.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Back to sign in
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
              <Label htmlFor="recover-email">Email</Label>
              <Input
                id="recover-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
