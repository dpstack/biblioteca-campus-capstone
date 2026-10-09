export interface Book {
  id: string
  title: string
  authors: string[]
  firstPublishYear: number | null
  coverId: number | null
  subjects: string[]
  editionCount: number
}

export interface WorkDetail extends Book {
  description: string
  firstPublishDate: string | null
  links: Array<{ title: string; url: string }>
}

export interface CatalogResult {
  books: Book[]
  total: number
}

export interface InventoryItem {
  work_id: string
  total_copies: number
  available_copies: number
}

export interface BookSnapshot {
  work_id: string
  title: string
  author: string
  cover_id: number | null
}

export interface Loan extends BookSnapshot {
  id: string
  borrowed_at: string
  due_at: string
  returned_at: string | null
}

export interface Reservation extends BookSnapshot {
  id: string
  created_at: string
  status: 'waiting' | 'fulfilled' | 'cancelled'
}

export type ReadingStatus = 'want_to_read' | 'reading' | 'finished'

export interface ReadingListItem extends BookSnapshot {
  status: ReadingStatus
  updated_at: string
}
