'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { Notification } from '@/lib/types';
import { Bell, Clock, Calendar, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [title, setTitle] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data, error } = await supabase.from('student_alarms')
        .select('id, student_id, title, alarm_time, is_completed, created_at')
        .eq('student_id', profile.id)
        .order('alarm_time', { ascending: true });
      setLoadError(error?.message ?? null);
      setNotifications((data ?? []).map((alarm) => ({
        id: alarm.id,
        user_id: alarm.student_id ?? profile.id,
        title: alarm.title,
        scheduled_for: alarm.alarm_time,
        notification_type: 'Reminder',
        is_sent: alarm.is_completed ?? false,
        created_at: alarm.created_at ?? '',
      })));
      setIsLoading(false);
    })();
  }, [profile]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const alarmTime = new Date(scheduledFor);
    if (!title.trim() || !scheduledFor || Number.isNaN(alarmTime.getTime()) || alarmTime <= new Date()) {
      toast.error('Enter a title and a future reminder time.');
      return;
    }
    const { data, error } = await supabase.from('student_alarms').insert({
      student_id: profile.id,
      title: title.trim(),
      alarm_time: alarmTime.toISOString(),
      is_completed: false,
    }).select().single();

    if (error) {
      setLoadError(error.message);
      toast.error(`Failed to save reminder: ${error.message}`);
    } else {
      const alarm: Notification = {
        id: data.id,
        user_id: data.student_id ?? profile.id,
        title: data.title,
        scheduled_for: data.alarm_time,
        notification_type: 'Reminder',
        is_sent: data.is_completed ?? false,
        created_at: data.created_at ?? '',
      };
      setNotifications((current) => [...current, alarm].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
      setLoadError(null);
      setTitle(''); setScheduledFor('');
      toast.success('In-app reminder saved. The app does not send push or email notifications.');
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('student_alarms').delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete reminder: ${error.message}`);
    } else {
      setNotifications(notifications.filter(n => n.id !== id));
      toast.success('Notification removed');
    }
  }

  return (
    <AppNav>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Reminders</h1>
          <p className="mt-1 text-muted-foreground">Save an in-app reminder. Push and email delivery are not configured.</p>
        </div>
        {loadError && <Card className="border-destructive/40 bg-destructive/5"><CardContent className="py-4 text-sm text-destructive">Reminders could not be loaded or saved: {loadError}</CardContent></Card>}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Schedule Reminder</CardTitle>
              <CardDescription>Save a reminder to your student dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 5 Review" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledFor">Schedule For</Label>
                  <Input id="scheduledFor" type="datetime-local" min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full gap-2"><Bell className="h-4 w-4" /> Save Reminder</Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Scheduled ({notifications.length})</h2>
            {isLoading ? <Card><CardContent className="py-8 text-center text-muted-foreground">Loading reminders...</CardContent></Card> : loadError ? null : notifications.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No notifications scheduled</p>
                </CardContent>
              </Card>
            ) : (
              (notifications || []).map((n) => (
                <Card key={n.id} className="border-border/60">
                  <CardContent className="flex items-start justify-between p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{n.title}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {new Date(n.scheduled_for).toLocaleString()}
                        </p>
                        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">In-app reminder</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </AppNav>
  );
}
