export function readDemoList<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

export function writeDemoList<T>(key: string, value: T[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function mergeDemoList<T extends { id: string }>(remote: T[] | null | undefined, key: string, limit = 50) {
  const local = readDemoList<T>(key)
  const merged = [...(remote || []), ...local.filter((item) => !(remote || []).some((remoteItem) => remoteItem.id === item.id))]
  return merged.slice(0, limit)
}
