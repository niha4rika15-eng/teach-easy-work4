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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data, error: loadError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (loadError) throw new Error(loadError.message);
        setUsers((data as Profile[]) ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load users.');
      }
    })();
  }, []);

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
            <CardDescription>To change a role, run in the Supabase SQL editor: update public.profiles set role = &apos;professor&apos; where email = &apos;name@example.com&apos;;</CardDescription>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} data-testid={`admin-user-row-${user.id}`}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="capitalize">{user.role}</Badge></TableCell>
                    <TableCell>{user.institution || '—'}</TableCell>
                    <TableCell>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</TableCell>
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
