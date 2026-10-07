import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SifterLogo } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  FileSearch, LogOut, MessageSquareText, RefreshCw, Search, Shield, ShieldCheck,
  ShieldMinus, Users, Loader2,
} from "lucide-react";

type PlatformStats = { users: number; searches: number; papers: number; feedback: number };
type AdminUser = {
  id: string; email: string | null; display_name: string | null;
  created_at: string; last_sign_in_at: string | null;
  searches: number; papers: number; roles: string[];
};
type RecentSearch = {
  id: string; query: string; domain: string | null; created_at: string;
  email: string | null; papers: number;
};

const isPlatformStats = (value: unknown): value is PlatformStats => {
  if (!value || typeof value !== "object") return false;
  const stats = value as Record<string, unknown>;
  return ["users", "searches", "papers", "feedback"].every(key => typeof stats[key] === "number");
};

const statCards = [
  { key: "users", label: "Users", icon: Users },
  { key: "searches", label: "Searches", icon: Search },
  { key: "papers", label: "Papers screened", icon: FileSearch },
  { key: "feedback", label: "Feedback decisions", icon: MessageSquareText },
] as const;

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : "Never");

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [searches, setSearches] = useState<RecentSearch[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);

  const verifyAndLoad = useCallback(async () => {
    setError("");
    setRefreshing(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { navigate("/login", { replace: true }); return; }
    setSelfId(session.user.id);

    const { data: adminRole, error: roleError } = await supabase
      .from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
    if (roleError || !adminRole) { navigate("/app", { replace: true }); return; }

    const [statsRes, usersRes, searchRes] = await Promise.all([
      supabase.rpc("get_sifter_admin_stats"),
      supabase.rpc("get_sifter_users"),
      supabase.rpc("get_sifter_recent_searches"),
    ]);
    setRefreshing(false);

    if (statsRes.error) { setError(statsRes.error.message); return; }
    if (!isPlatformStats(statsRes.data)) { setError("The platform statistics response was invalid."); return; }
    setStats(statsRes.data);
    setUsers((usersRes.data as unknown as AdminUser[]) ?? []);
    setSearches((searchRes.data as unknown as RecentSearch[]) ?? []);
  }, [navigate]);

  useEffect(() => {
    verifyAndLoad();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) navigate("/login", { replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate, verifyAndLoad]);

  const toggleAdmin = async (target: AdminUser) => {
    const isAdmin = target.roles.includes("admin");
    if (target.id === selfId && isAdmin) {
      toast({ title: "Not allowed", description: "You cannot remove your own administrator access.", variant: "destructive" });
      return;
    }
    setBusyId(target.id);
    const res = isAdmin
      ? await supabase.from("user_roles").delete().eq("user_id", target.id).eq("role", "admin")
      : await supabase.from("user_roles").insert({ user_id: target.id, role: "admin" });
    setBusyId(null);
    if (res.error) {
      toast({ title: "Role update failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setUsers(prev => (prev || []).map(u => u.id === target.id
      ? { ...u, roles: isAdmin ? u.roles.filter(r => r !== "admin") : [...u.roles, "admin"] }
      : u));
    toast({ title: isAdmin ? "Administrator access revoked" : "Administrator access granted", description: target.email ?? target.id });
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return users || [];
    return (users || []).filter(u => `${u.email} ${u.display_name}`.toLowerCase().includes(q));
  }, [users, filter]);

  const signOut = async () => { await supabase.auth.signOut(); navigate("/login", { replace: true }); };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
          <SifterLogo className="h-16 w-auto max-w-[300px]" />
          <Shield className="ml-2 h-5 w-5 text-primary" />
          <div>
            <h1 className="font-semibold">Sifter administration</h1>
            <p className="text-xs text-muted-foreground">Live platform activity</p>
          </div>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => navigate("/app")}>Open workspace</Button>
          <Button variant="ghost" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Platform overview</h2>
            <p className="text-sm text-muted-foreground">Usage totals across Sifter accounts and scientific workflows.</p>
          </div>
          <Button variant="outline" onClick={verifyAndLoad} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {error && <Alert variant="destructive" className="mb-6"><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ key, label, icon: Icon }) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {stats ? <div className="text-3xl font-semibold">{stats[key].toLocaleString()}</div> : <Skeleton className="h-9 w-20" />}
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="users" className="mt-8">
          <TabsList>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" />Users</TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5"><Search className="h-3.5 w-3.5" />Recent activity</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <CardTitle className="text-base">Accounts &amp; access</CardTitle>
                <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by email or name" className="max-w-xs" />
              </CardHeader>
              <CardContent className="space-y-2">
                {!users && <Skeleton className="h-24 w-full" />}
                {users && filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No accounts match this filter.</p>}
                {filtered.map(u => {
                  const isAdmin = u.roles.includes("admin");
                  return (
                    <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{u.display_name || u.email || u.id}</span>
                          {isAdmin && <Badge variant="secondary" className="gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" />Admin</Badge>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Joined {fmt(u.created_at)} · Last sign in {fmt(u.last_sign_in_at)}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{u.searches} searches</div>
                        <div>{u.papers} papers</div>
                      </div>
                      <Button
                        size="sm"
                        variant={isAdmin ? "outline" : "default"}
                        disabled={busyId === u.id}
                        onClick={() => toggleAdmin(u)}
                      >
                        {busyId === u.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : isAdmin
                            ? <><ShieldMinus className="mr-1.5 h-3.5 w-3.5" />Revoke admin</>
                            : <><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Make admin</>}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Latest searches across the platform</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {!searches && <Skeleton className="h-24 w-full" />}
                {searches && searches.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No searches recorded yet.</p>}
                {(searches || []).map(s => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.query}</p>
                      <p className="text-xs text-muted-foreground">{s.email || "Unknown user"} · {fmt(s.created_at)}{s.domain ? ` · ${s.domain}` : ""}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{s.papers} papers</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
