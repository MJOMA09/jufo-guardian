import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SifterLogo } from "@/components/Header";
import { Loader2, Shield } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const checkIsAdmin = async (userId: string) => {
    const { data, error: roleError } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (roleError) throw roleError;
    return !!data;
  };

  const routeSignedInUser = async (userId: string) => {
    const isAdmin = await checkIsAdmin(userId);
    navigate(isAdmin ? "/admin" : "/app", { replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try { await routeSignedInUser(session.user.id); }
        catch { setError("Unable to verify your account permissions."); }
      }
      setLoading(false);
    });
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setError(signInError?.message || "Sign in failed.");
      setLoading(false);
      return;
    }
    try {
      const isAdmin = await checkIsAdmin(data.user.id);
      if (!isAdmin) {
        setError("This account does not have administrator access.");
        setLoading(false);
        return;
      }
      navigate("/admin", { replace: true });
    } catch {
      setError("Unable to verify administrator access.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-3 flex justify-center"><SifterLogo className="h-12 w-auto max-w-[200px]" /></div>
          <CardTitle className="flex items-center justify-center gap-2"><Shield className="h-5 w-5 text-primary" />Administrator sign in</CardTitle>
          <CardDescription>Use your Sifter account. Access is verified from your assigned role.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={signIn} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-2"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="admin-password">Password</Label><Input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}</Button>
            <Button type="button" variant="ghost" className="w-full" asChild><Link to="/auth">Use the standard sign-in page</Link></Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}