import Dexie, { type EntityTable } from 'dexie'
import type { Cut, Project, Student } from './types'

/**
 * 브라우저 안(IndexedDB)에만 저장하는 저장소.
 * 어떤 자료도 밖으로 나가지 않는다.
 */
class DongseonDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  students!: EntityTable<Student, 'id'>
  cuts!: EntityTable<Cut, 'id'>

  constructor() {
    super('dongseon-note')
    this.version(1).stores({
      projects: 'id, updatedAt, createdAt',
      students: 'id, projectId, order',
      cuts: 'id, projectId, order',
    })
  }
}

export const db = new DongseonDB()
