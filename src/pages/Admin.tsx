import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSearch, LogOut, MessageSquareText, Search, Shield, Users } from "lucide-react";

type PlatformStats = { users: number; searches: number; papers: number; feedback: number };

const statCards = [
  { key: "users", label: "Users", icon: Users },
  { key: "searches", label: "Searches", icon: Search },
  { key: "papers", label: "Papers screened", icon: FileSearch },
  { key: "feedback", label: "Feedback decisions", icon: MessageSquareText },
] as const;

export default function Admin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState("");

  const verifyAndLoad = useCallback(async () => {
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { navigate("/login", { replace: true }); return; }

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    if (roleError || !isAdmin) { navigate("/app", { replace: true }); return; }

    const [users, searches, papers, feedback] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("scifilter_searches").select("id", { count: "exact", head: true }),
      supabase.from("scifilter_papers").select("id", { count: "exact", head: true }),
      supabase.from("scifilter_papers").select("id", { count: "exact", head: true }).not("feedback", "is", null),
    ]);
    const firstError = [users.error, searches.error, papers.error, feedback.error].find(Boolean);
    if (firstError) { setError(firstError.message); return; }
    setStats({ users: users.count || 0, searches: searches.count || 0, papers: papers.count || 0, feedback: feedback.count || 0 });
  }, [navigate]);

  useEffect(() => {
    verifyAndLoad();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) navigate("/login", { replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate, verifyAndLoad]);

  const signOut = async () => { await supabase.auth.signOut(); navigate("/login", { replace: true }); };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4"><Shield className="h-5 w-5 text-primary" /><div><h1 className="font-semibold">Sifter administration</h1><p className="text-xs text-muted-foreground">Live platform activity</p></div><div className="flex-1" /><Button variant="outline" onClick={() => navigate("/app")}>Open workspace</Button><Button variant="ghost" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div></header>
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6"><h2 className="text-2xl font-semibold">Platform overview</h2><p className="text-sm text-muted-foreground">Usage totals across Sifter accounts and scientific workflows.</p></div>
        {error && <Alert variant="destructive" className="mb-6"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ key, label, icon: Icon }) => <Card key={key}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent>{stats ? <div className="text-3xl font-semibold">{stats[key].toLocaleString()}</div> : <Skeleton className="h-9 w-20" />}</CardContent></Card>)}
        </div>
        <div className="mt-6 flex justify-end"><Button variant="outline" onClick={verifyAndLoad}>Refresh statistics</Button></div>
      </section>
    </main>
  );
}