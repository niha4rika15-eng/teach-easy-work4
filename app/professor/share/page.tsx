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
import { SharedMaterial } from '@/lib/types';
import { FileText, Trash2, Upload, BookOpen, Loader2, FileUp, CircleCheck } from 'lucide-react';
import { toast } from 'sonner';

const SHARED_MATERIALS_BUCKET = 'shared-materials'
const MAX_SHARED_MATERIAL_SIZE = 25 * 1024 * 1024

const SIGNED_LINK_SECONDS = 900

function isStorageObjectPath(value: string) {
  return !/^[a-z][a-z0-9+.-]*:/i.test(value)
}

function isSafeHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

type SourceDocument = {
  id: string
  title: string
  mime_type: string
  byte_size: number
  character_count: number
  chunk_count: number
  status: 'processing' | 'ready' | 'failed'
  error_message: string | null
  created_at: string
}

export default function SharePage() {
  const { profile } = useAuth();
  const [materials, setMaterials] = useState<SharedMaterial[]>([]);
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState('');
  const [selectedMaterialFile, setSelectedMaterialFile] = useState<File | null>(null);
  const [materialFileInputVersion, setMaterialFileInputVersion] = useState(0);
  const [signedMaterialUrls, setSignedMaterialUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data, error } = await supabase.from('shared_materials').select('*').eq('professor_id', profile.id).order('created_at', { ascending: false });
      if (error) {
        toast.error(`Could not load shared materials: ${error.message}`)
      } else {
        const rows = (data as SharedMaterial[]) || []
        setMaterials(rows)
        await refreshSignedUrls(rows)
      }
      await loadSourceDocuments().catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Could not load your source library.')
      });
    })();
  }, [profile]);

  async function refreshSignedUrls(rows: SharedMaterial[]) {
    const entries = await Promise.all(rows.map(async (material): Promise<[string, string] | null> => {
      if (!material.file_url || !isStorageObjectPath(material.file_url)) return null
      const { data, error } = await supabase.storage.from(SHARED_MATERIALS_BUCKET).createSignedUrl(material.file_url, SIGNED_LINK_SECONDS)
      if (error) {
        toast.error(`Could not create an access link for ${material.title}: ${error.message}`)
        return null
      }
      return [material.id, data.signedUrl]
    }))
    setSignedMaterialUrls((current) => ({
      ...current,
      ...Object.fromEntries(entries.filter((entry): entry is [string, string] => entry !== null)),
    }))
  }

  async function loadSourceDocuments() {
    const response = await fetch('/api/professor/documents', { cache: 'no-store' });
    const result: unknown = await response.json();
    if (!response.ok || typeof result !== 'object' || result === null || !('documents' in result) || !Array.isArray(result.documents)) {
      const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
        ? result.error
        : 'Could not load your source library.'
      throw new Error(message)
    }
    setSourceDocuments(result.documents as SourceDocument[]);
  }

  async function handleDocumentUpload() {
    if (!selectedFile) {
      toast.error('Choose a PDF, DOCX, TXT, or Markdown file first.')
      return
    }
    setUploadingDocument(true)
    try {
      const form = new FormData()
      form.set('file', selectedFile)
      form.set('title', documentTitle || selectedFile.name.replace(/\.[^.]+$/, ''))
      const response = await fetch('/api/professor/documents', { method: 'POST', body: form })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
          ? result.error
          : `Document upload failed (${response.status}).`
        throw new Error(message)
      }
      await loadSourceDocuments()
      setSelectedFile(null)
      setDocumentTitle('')
      setFileInputVersion((version) => version + 1)
      toast.success('Source document uploaded and indexed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Document upload failed.')
    } finally {
      setUploadingDocument(false)
    }
  }

  async function handleDeleteSourceDocument(id: string) {
    try {
      const response = await fetch('/api/professor/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
          ? result.error
          : `Could not delete the source document (${response.status}).`
        throw new Error(message)
      }
      setSourceDocuments((documents) => documents.filter((document) => document.id !== id))
      toast.success('Source document removed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the source document.')
    }
  }

  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (selectedMaterialFile && selectedMaterialFile.size > MAX_SHARED_MATERIAL_SIZE) {
      toast.error('Choose a file smaller than 25 MB.')
      return
    }
    if (selectedMaterialFile && fileUrl.trim()) {
      toast.error('Choose either a file from your device or an existing file URL, not both.')
      return
    }
    if (!selectedMaterialFile && fileUrl.trim() && !isSafeHttpsUrl(fileUrl.trim())) {
      toast.error('Existing file links must be full https:// URLs.')
      return
    }

    let uploadedPath: string | null = null
    try {
      if (selectedMaterialFile) {
        uploadedPath = `${profile.id}/${crypto.randomUUID()}`
        const { error: uploadError } = await supabase.storage
          .from(SHARED_MATERIALS_BUCKET)
          .upload(uploadedPath, selectedMaterialFile, {
            contentType: selectedMaterialFile.type || 'application/octet-stream',
            upsert: false,
          })
        if (uploadError) throw new Error(`Could not upload the file: ${uploadError.message}`)
      }

      const { data, error } = await supabase.from('shared_materials').insert({
        professor_id: profile.id,
        title,
        description,
        subject,
        file_url: uploadedPath ?? (fileUrl.trim() || null),
        file_type: selectedMaterialFile?.type || fileType || null,
      }).select().single()

      if (error) throw new Error(`Could not share the material: ${error.message}`)
      const sharedMaterial = data as SharedMaterial
      setMaterials((current) => [sharedMaterial, ...current])
      setTitle(''); setDescription(''); setSubject(''); setFileUrl(''); setFileType('');
      setSelectedMaterialFile(null)
      setMaterialFileInputVersion((version) => version + 1)
      if (uploadedPath) await refreshSignedUrls([sharedMaterial])
      toast.success('Material shared. Only signed-in students can open it, through a short-lived private link.')
    } catch (error) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(SHARED_MATERIALS_BUCKET).remove([uploadedPath])
        if (cleanupError) {
          toast.error(`The file upload could not be rolled back: ${cleanupError.message}`)
        }
      }
      toast.error(error instanceof Error ? error.message : 'Failed to share material')
    }
  }

  async function handleDelete(id: string) {
    const material = materials.find((item) => item.id === id)
    const { error } = await supabase.from('shared_materials').delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete material: ${error.message}`);
    } else {
      setMaterials((current) => current.filter((m) => m.id !== id));
      setSignedMaterialUrls((current) => Object.fromEntries(
        Object.entries(current).filter(([materialId]) => materialId !== id),
      ))
      if (material?.file_url && isStorageObjectPath(material.file_url)) {
        const { error: storageError } = await supabase.storage.from(SHARED_MATERIALS_BUCKET).remove([material.file_url])
        if (storageError) toast.error(`Material removed, but the stored file could not be deleted: ${storageError.message}`)
        else toast.success('Material removed')
      } else {
        toast.success('Material removed')
      }
    }
  }

  return (
    <AppNav>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Share Materials</h1>
          <p className="mt-1 text-muted-foreground">Share files and resources with your students</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" /> RAG Source Library</CardTitle>
            <CardDescription>Upload selectable-text PDFs, DOCX, TXT, or Markdown files. Relevant passages can ground generated content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                key={fileInputVersion}
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setSelectedFile(file)
                  setDocumentTitle(file?.name.replace(/\.[^.]+$/, '') ?? '')
                }}
                aria-label="Select a source document"
              />
              <Input
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                placeholder="Document title"
                maxLength={200}
                aria-label="Source document title"
              />
            </div>
            <Button type="button" data-testid="upload-source-button" onClick={handleDocumentUpload} disabled={uploadingDocument || !selectedFile} className="gap-2">
              {uploadingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadingDocument ? 'Extracting and indexing…' : 'Upload to source library'}
            </Button>
            <div className="space-y-2">
              <h2 className="font-semibold">Indexed documents ({sourceDocuments.length})</h2>
              {sourceDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No source documents uploaded yet.</p>
              ) : sourceDocuments.map((document) => (
                <div key={document.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{document.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {document.status === 'ready'
                        ? `${document.chunk_count} passages indexed · ${document.character_count.toLocaleString()} characters`
                        : document.status === 'processing' ? 'Indexing in progress' : document.error_message || 'Indexing failed'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {document.status === 'ready' && <CircleCheck className="h-4 w-4 text-primary" aria-label="Indexed" />}
                    <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${document.title}`} onClick={() => handleDeleteSourceDocument(document.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Share New Material</CardTitle>
              <CardDescription>Add a resource for students to access</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleShare} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 5 Notes" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materialFile">Upload a file from your device (optional)</Label>
                  <Input
                    key={materialFileInputVersion}
                    id="materialFile"
                    type="file"
                    onChange={(event) => setSelectedMaterialFile(event.target.files?.[0] ?? null)}
                    aria-label="Select a file to share with students"
                  />
                  <p className="text-xs text-muted-foreground">Private storage · maximum 25 MB · opened only through short-lived signed links. Choose this or paste an existing https:// link below.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fileUrl">Or use an existing file URL</Label>
                  <Input id="fileUrl" data-testid="material-url-input" type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fileType">File Type</Label>
                  <Input id="fileType" value={fileType} onChange={(e) => setFileType(e.target.value)} placeholder="pdf, docx, pptx..." />
                </div>
                <Button type="submit" data-testid="share-material-button" className="w-full gap-2"><Upload className="h-4 w-4" /> Share Material</Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Shared Materials ({materials.length})</h2>
            {materials.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No materials shared yet</p>
                </CardContent>
              </Card>
            ) : (
              (materials || []).map((m) => (
                <Card key={m.id} className="border-border/60">
                  <CardContent className="flex items-start justify-between p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{m.title}</p>
                        {m.subject && <p className="text-sm text-muted-foreground">{m.subject}</p>}
                        {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                        {m.file_url && (
                          signedMaterialUrls[m.id] || isSafeHttpsUrl(m.file_url) ? (
                            <a href={signedMaterialUrls[m.id] ?? m.file_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-primary hover:underline">
                              Open file
                            </a>
                          ) : <p className="mt-1 text-sm text-muted-foreground">Preparing secure file link…</p>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
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
