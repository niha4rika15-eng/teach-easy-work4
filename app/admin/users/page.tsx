'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type ManagedProfile = Profile & { requested_role?: string | null };
const ROLES = ['student', 'professor', 'admin'] as const;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedProfile[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data, error: loadError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (loadError) throw new Error(loadError.message);
        setUsers((data as ManagedProfile[]) ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load users.');
      }
    })();
  }, []);

  async function changeRole(user: ManagedProfile, role: string) {
    setSavingId(user.id);
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_role', { target_user: user.id, new_role: role });
      if (rpcError) throw new Error(rpcError.message);
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, role: role as Profile['role'], requested_role: null } : item)));
      toast.success(`${user.full_name || user.email} is now ${role}.`);
    } catch (rpcError) {
      toast.error(rpcError instanceof Error ? rpcError.message : 'Could not change role.');
    } finally {
      setSavingId(null);
    }
  }

  const term = search.toLowerCase();
  const filtered = users.filter((user) => `${user.full_name} ${user.email} ${user.role}`.toLowerCase().includes(term));

  return (
    <AppNav>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-muted-foreground">All accounts and their roles. Roles are assigned in the database by an administrator, never by signup.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Accounts ({filtered.length})</CardTitle>
            <CardDescription>Approve requested access or change a role. Only administrators can do this.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input data-testid="admin-users-search" placeholder="Search by name, email, or role" value={search} onChange={(event) => setSearch(event.target.value)} className="max-w-sm" />
            {error && <p data-testid="admin-users-error" className="text-sm text-destructive">Could not load users: {error}</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Change role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} data-testid={`admin-user-row-${user.id}`}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="capitalize">{user.role}</Badge>
                      {user.requested_role && <Badge variant="outline" className="capitalize">requested {user.requested_role}</Badge>}
                    </TableCell>
                    <TableCell>{user.institution || '—'}</TableCell>
                    <TableCell>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {ROLES.filter((role) => role !== user.role).map((role) => (
                        <Button key={role} size="sm" variant={role === user.requested_role ? 'default' : 'outline'} disabled={savingId === user.id} data-testid={`set-role-${role}-${user.id}`} onClick={() => changeRole(user, role)} className="capitalize">
                          {role === user.requested_role ? `Approve ${role}` : role}
                        </Button>
                      ))}
                    </TableCell>
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
