'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { UsageLog, Generation, TEMPLATE_TYPE_LABELS } from '@/lib/types';
import { BarChart3, TrendingUp, Activity, Star } from 'lucide-react';
import { averageScore, formatEvidenceRisk, formatNepScore, formatQualityScore, NOT_EVALUATED, toScore } from '@/lib/scores';

const PAGE_SIZE = 20;

export default function MetricsPage() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalGenerations, setTotalGenerations] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [generationsPage, setGenerationsPage] = useState(1);
  const [avgNep, setAvgNep] = useState<number | null>(null);
  const [returningUsers, setReturningUsers] = useState<number | null>(null);
  const [avgQuality, setAvgQuality] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [logsAggregateResult, generationsAggregateResult, logsCountResult, generationsCountResult] = await Promise.all([
        supabase.from('usage_logs').select('user_id'),
        supabase.from('generations').select('status, nep_confidence, quality_rating'),
        supabase.from('usage_logs').select('*', { count: 'exact', head: true }),
        supabase.from('generations').select('*', { count: 'exact', head: true }),
      ]);
      const logUsers = (logsAggregateResult.data ?? []) as { user_id: string | null }[];
      const generationMetrics = (generationsAggregateResult.data ?? []) as {
        status: string;
        nep_confidence: number | null;
        quality_rating: number | null;
      }[];
      setTotalLogs(logsCountResult.count ?? 0);
      setTotalGenerations(generationsCountResult.count ?? 0);

      setAvgNep(averageScore(generationMetrics.map((generation) => generation.nep_confidence)));

      const userEventCounts: Record<string, number> = logUsers.reduce((acc: Record<string, number>, log) => {
        if (!log.user_id) return acc;
        const userId = log.user_id;
        acc[userId] = (acc[userId] || 0) + 1;
        return acc;
      }, {});
      const returningUsers = Object.values(userEventCounts).filter((count) => count > 1).length;
      const distinctUsers = Object.keys(userEventCounts).length;
      setReturningUsers(distinctUsers ? (returningUsers / distinctUsers) * 100 : null);
      setAvgQuality(averageScore(generationMetrics.map((generation) => generation.quality_rating)));
    })();
  }, []);

  useEffect(() => {
    const from = (logsPage - 1) * PAGE_SIZE;
    (async () => {
      const logsResult = await supabase.from('usage_logs').select('*').order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      setLogs((logsResult.data as UsageLog[]) || []);
    })();
  }, [logsPage]);

  useEffect(() => {
    const from = (generationsPage - 1) * PAGE_SIZE;
    (async () => {
      const generationsResult = await supabase.from('generations').select('*').order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      setGenerations((generationsResult.data as Generation[]) || []);
    })();
  }, [generationsPage]);

  return (
    <AppNav>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Telemetry & Metrics</h1>
          <p className="mt-1 text-muted-foreground">Detailed analytics on platform usage and educational outcomes</p>
        </div>

        {/* Rubric estimates and returning users */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated NEP Alignment</CardTitle>
              <Star className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgNep == null ? NOT_EVALUATED : formatNepScore(avgNep, 1)}</div>
              <p className="text-xs text-muted-foreground">Model-estimated (0–100), not an official certification</p>
            </CardContent>
          </Card>
          <Card className="border-accent/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Returning Users</CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{returningUsers == null ? '—' : `${returningUsers.toFixed(0)}%`}</div>
              <p className="text-xs text-muted-foreground">Among users in the usage log sample</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Quality Estimate</CardTitle>
              <Star className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgQuality == null ? NOT_EVALUATED : formatQualityScore(avgQuality, 1)}</div>
              <p className="text-xs text-muted-foreground">Model-estimated (0–10)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalLogs}</div></CardContent>
          </Card>
        </div>

        {/* Generations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> All Generations</CardTitle>
            <CardDescription>Every content generation with model-estimated rubric scores (not certifications or fact-checks)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              {totalGenerations === 0
                ? 'No generations'
                : `Showing ${(generationsPage - 1) * PAGE_SIZE + 1}-${Math.min(generationsPage * PAGE_SIZE, totalGenerations)} of ${totalGenerations}`}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>NEP Alignment Est. (0–100)</TableHead>
                  <TableHead>Evidence Risk Est. (0–100)</TableHead>
                  <TableHead>Quality Est. (0–10)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(generations || []).map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{TEMPLATE_TYPE_LABELS[g.template_type] ?? g.template_type}</TableCell>
                    <TableCell>{g.target_language}</TableCell>
                    <TableCell>
                      {toScore(g.nep_confidence) != null ? (
                        <span className={(toScore(g.nep_confidence) ?? 0) >= 70 ? 'text-accent font-medium' : 'text-destructive'}>
                          {formatNepScore(g.nep_confidence, 1)}
                        </span>
                      ) : NOT_EVALUATED}
                    </TableCell>
                    <TableCell>{formatEvidenceRisk(g.hallucination_index)}</TableCell>
                    <TableCell>{formatQualityScore(g.quality_rating, 1)}</TableCell>
                    <TableCell><Badge variant={g.status === 'completed' ? 'default' : 'secondary'}>{g.status}</Badge></TableCell>
                    <TableCell>{new Date(g.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenerationsPage((page) => Math.max(1, page - 1))}
                disabled={generationsPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {generationsPage} of {Math.max(1, Math.ceil(totalGenerations / PAGE_SIZE))}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenerationsPage((page) => page + 1)}
                disabled={generationsPage >= Math.ceil(totalGenerations / PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Logs</CardTitle>
            <CardDescription>Raw telemetry events</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              {totalLogs === 0
                ? 'No usage logs'
                : `Showing ${(logsPage - 1) * PAGE_SIZE + 1}-${Math.min(logsPage * PAGE_SIZE, totalLogs)} of ${totalLogs}`}
            </p>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Time Saved</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logs || []).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium capitalize">{log.event_type.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{log.time_saved_minutes > 0 ? `${log.time_saved_minutes}m` : '—'}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{JSON.stringify(log.event_data)}</TableCell>
                      <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogsPage((page) => Math.max(1, page - 1))}
                disabled={logsPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {logsPage} of {Math.max(1, Math.ceil(totalLogs / PAGE_SIZE))}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogsPage((page) => page + 1)}
                disabled={logsPage >= Math.ceil(totalLogs / PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppNav>
  );
}
