'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { Profile, UsageLog, Generation } from '@/lib/types';
import { Users, FileText, TrendingUp, Clock, Activity, Brain, Globe, BarChart3 } from 'lucide-react';

interface Metrics {
  totalUsers: number;
  totalGenerations: number;
  totalTimeSaved: number;
  avgNepScore: number;
  featureUsage: Record<string, number>;
  languageDistribution: Record<string, number>;
  roleDistribution: Record<string, number>;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalUsers: 0, totalGenerations: 0, totalTimeSaved: 0, avgNepScore: 0,
    featureUsage: {}, languageDistribution: {}, roleDistribution: {},
  });

  useEffect(() => {
    (async () => {
      const [profilesResult, logsResult, generationsResult, generationCountResult] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('usage_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('generations').select('nep_confidence, target_language'),
        supabase.from('generations').select('*', { count: 'exact', head: true }),
      ]);
      const profiles = profilesResult.data;
      const genLogs = logsResult.data;
      const gens = generationsResult.data;
      const safeProfiles = (profiles as Profile[]) || [];
      const safeGenLogs = (genLogs as UsageLog[]) || [];
      const safeGenerations = (gens as Pick<Generation, 'nep_confidence' | 'target_language'>[]) || [];
      setUsers(safeProfiles);
      setLogs(safeGenLogs);

      {
        const totalTimeSaved = safeGenLogs.reduce((sum: number, l: UsageLog) => sum + (l.time_saved_minutes || 0), 0);
        const nepScores = safeGenerations.filter((g) => g.nep_confidence != null);
        const avgNep = nepScores.length > 0 ? nepScores.reduce((a, g) => a + (g.nep_confidence ?? 0), 0) / nepScores.length : 0;
        const featureUsage: Record<string, number> = {};
        safeGenLogs.forEach((l: UsageLog) => { featureUsage[l.event_type] = (featureUsage[l.event_type] || 0) + 1; });
        const languageDistribution: Record<string, number> = {};
        safeGenerations.forEach((g) => { languageDistribution[g.target_language] = (languageDistribution[g.target_language] || 0) + 1; });
        const roleDistribution: Record<string, number> = {};
        safeProfiles.forEach((p: Profile) => { roleDistribution[p.role] = (roleDistribution[p.role] || 0) + 1; });

        setMetrics({
          totalUsers: safeProfiles.length,
          totalGenerations: generationCountResult.count ?? 0,
          totalTimeSaved,
          avgNepScore: avgNep,
          featureUsage,
          languageDistribution,
          roleDistribution,
        });
      }
    })();
  }, []);

  const maxFeatureUsage = Math.max(...Object.values(metrics.featureUsage), 1);

  return (
    <AppNav>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Platform telemetry, usage metrics, and user management</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{metrics.totalUsers}</div></CardContent>
          </Card>
          <Card className="border-accent/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Generations</CardTitle>
              <FileText className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{metrics.totalGenerations}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Time Saved (hrs)</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{(metrics.totalTimeSaved / 60).toFixed(1)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated NEP Alignment</CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-accent">{metrics.avgNepScore.toFixed(1)}%</div><p className="text-xs text-muted-foreground">AI rubric estimate, not certification</p></CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Feature Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Feature Usage</CardTitle>
              <CardDescription>Event frequency across the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(metrics.featureUsage).length === 0 ? (
                <p className="text-sm text-muted-foreground">No usage data yet</p>
              ) : (
                (Object.entries(metrics.featureUsage) || []).map(([feature, count]) => (
                  <div key={feature}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / maxFeatureUsage) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Language Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Language Distribution</CardTitle>
              <CardDescription>Generations by target language</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.entries(metrics.languageDistribution).length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {(Object.entries(metrics.languageDistribution) || []).map(([lang, count]) => {
                    const total = Object.values(metrics.languageDistribution).reduce((a, b) => a + b, 0);
                    const pct = (count / total) * 100;
                    return (
                      <div key={lang} className="flex flex-col items-center">
                        <div className="relative h-24 w-24">
                          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeDasharray={`${(pct / 100) * 251.2} 251.2`} strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-lg font-bold">{count}</span>
                            <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <span className="mt-1 text-sm font-medium">{lang}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Role Distribution + Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> User Roles</CardTitle>
              <CardDescription>Distribution of user roles on the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.entries(metrics.roleDistribution) || []).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {role === 'admin' ? <BarChart3 className="h-5 w-5" /> : role === 'professor' ? <Brain className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <span className="font-medium capitalize">{role}s</span>
                  </div>
                  <Badge>{count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-accent" /> Recent Activity</CardTitle>
              <CardDescription>Latest platform events</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet</p>
              ) : (
                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {(logs || []).slice(0, 20).map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-lg border border-border/40 p-2.5 text-sm">
                      <div>
                        <span className="font-medium capitalize">{log.event_type.replace(/_/g, ' ')}</span>
                        {log.time_saved_minutes > 0 && <span className="ml-2 text-xs text-accent">+{log.time_saved_minutes}m saved</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registered Users</CardTitle>
            <CardDescription>All users on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users || []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No users found</TableCell></TableRow>
                ) : (users || []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge className="bg-primary/10 text-primary">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{u.institution ?? '—'}</TableCell>
                    <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppNav>
  );
}
