export type SnapshotStore<T> = {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
  set(value: T): void
  update(recipe: (draft: T) => void): void
}

type PersistOptions = {
  persist?: {
    name: string
  }
}

export function createSnapshotStore<T>(initial: T, options?: PersistOptions): SnapshotStore<T> {
  const key = options?.persist?.name
  const stored = key === undefined ? null : localStorage.getItem(key)
  let snapshot = stored === null ? initial : JSON.parse(stored) as T
  const listeners = new Set<() => void>()

  const publish = (): void => {
    if (key !== undefined) localStorage.setItem(key, JSON.stringify(snapshot))
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: value => {
      snapshot = value
      publish()
    },
    update: recipe => {
      const draft = structuredClone(snapshot)
      recipe(draft)
      snapshot = draft
      publish()
    },
  }
}
