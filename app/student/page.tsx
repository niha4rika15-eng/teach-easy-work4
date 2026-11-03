'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { SharedMaterial, Notification } from '@/lib/types';
import { BookOpen, Bell, FileText, ExternalLink, Clock, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const [materials, setMaterials] = useState<SharedMaterial[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<{ materials: string | null; notifications: string | null }>({
    materials: null,
    notifications: null,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!profile) return;
    const studentId = profile.id;
    let isMounted = true;

    async function fetchDashboardData() {
      setIsLoading(true);
      setErrors({ materials: null, notifications: null });

      try {
        const [materialsResult, notificationsResult] = await Promise.all([
          supabase.from('shared_materials').select('*').order('created_at', { ascending: false }).limit(5),
          supabase.from('notifications').select('*').eq('user_id', studentId).order('scheduled_for', { ascending: false }).limit(5),
        ]);

        if (!isMounted) return;

        setMaterials((materialsResult.data as SharedMaterial[]) || []);
        setNotifications((notificationsResult.data as Notification[]) || []);
        setErrors({
          materials: materialsResult.error?.message ?? null,
          notifications: notificationsResult.error?.message ?? null,
        });
      } catch (error) {
        if (!isMounted) return;

        const message = error instanceof Error ? error.message : 'Failed to load dashboard data.';
        setErrors({ materials: message, notifications: message });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [authLoading, profile]);

  return (
    <AppNav>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {profile?.full_name}</h1>
          <p className="mt-1 text-muted-foreground">Access your shared materials and stay on track with notifications.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available Materials</CardTitle>
              <BookOpen className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{(materials || []).length}</div></CardContent>
          </Card>
          <Card className="border-accent/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Notifications</CardTitle>
              <Bell className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{(notifications || []).filter(n => !n.is_sent).length}</div></CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Materials</h2>
              <Link href="/student/materials"><Button variant="ghost" size="sm" className="gap-1">View All</Button></Link>
            </div>
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Loading materials...</CardContent></Card>
            ) : errors.materials ? (
              <Card><CardContent role="alert" className="py-8 text-center text-destructive">Failed to load materials: {errors.materials}</CardContent></Card>
            ) : (materials || []).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No materials available yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(materials || []).map((m) => (
                  <Card key={m.id} className="border-border/60">
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{m.title}</p>
                        {m.subject && <p className="text-sm text-muted-foreground">{m.subject}</p>}
                        {m.file_url && (
                          <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                            Open file <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Upcoming Notifications</h2>
              <Link href="/student/notifications"><Button variant="ghost" size="sm">View All</Button></Link>
            </div>
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Loading notifications...</CardContent></Card>
            ) : errors.notifications ? (
              <Card><CardContent role="alert" className="py-8 text-center text-destructive">Failed to load notifications: {errors.notifications}</CardContent></Card>
            ) : (notifications || []).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No notifications scheduled</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(notifications || []).map((n) => (
                  <Card key={n.id} className="border-border/60">
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{n.title}</p>
                        {n.message && <p className="text-sm text-muted-foreground">{n.message}</p>}
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {new Date(n.scheduled_for).toLocaleString()}
                        </p>
                      </div>
                      {!n.is_sent && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Scheduled</span>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppNav>
  );
}
