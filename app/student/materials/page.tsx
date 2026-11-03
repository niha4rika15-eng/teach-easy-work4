'use client';

import { useEffect, useState } from 'react';
import { AppNav } from '@/components/app-nav';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import { SharedMaterial } from '@/lib/types';
import { BookOpen, FileText, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';

const SHARED_MATERIALS_BUCKET = 'shared-materials'

function isStorageObjectPath(value: string) {
  return !/^https?:\/\//i.test(value)
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<SharedMaterial[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('shared_materials').select('*').order('created_at', { ascending: false });
      if (error) {
        toast.error(`Could not load shared materials: ${error.message}`)
        return
      }
      const rows = (data as SharedMaterial[]) || []
      const withLinks = await Promise.all(rows.map(async (material) => {
        if (!material.file_url || !isStorageObjectPath(material.file_url)) return material
        const { data: signed, error: signedError } = await supabase.storage
          .from(SHARED_MATERIALS_BUCKET)
          .createSignedUrl(material.file_url, 3600)
        if (signedError) {
          toast.error(`Could not open ${material.title}: ${signedError.message}`)
          return { ...material, file_url: undefined }
        }
        return { ...material, file_url: signed.signedUrl }
      }))
      setMaterials(withLinks)
    })();
  }, []);

  const filtered = (materials || []).filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.subject?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppNav>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subject Materials</h1>
          <p className="mt-1 text-muted-foreground">Files and resources shared by your professors</p>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search materials..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">{search ? 'No materials match your search' : 'No materials available yet'}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(filtered || []).map((m) => (
              <Card key={m.id} className="group border-border/60 transition-all hover:border-primary/30 hover:shadow-lg">
                <CardContent className="p-5">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <FileText className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold">{m.title}</h3>
                  {m.subject && <p className="text-sm text-muted-foreground">{m.subject}</p>}
                  {m.description && <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>}
                  {m.file_url && (
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      Open file <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppNav>
  );
}
