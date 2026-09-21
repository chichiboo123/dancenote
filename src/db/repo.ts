import { db } from './db'
import type { Project, Student } from './types'
import { pickColor } from '../lib/colors'
import { makeShortName } from '../lib/names'

/** 브라우저가 주는 고유 아이디 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/* ---------------- 공연(프로젝트) ---------------- */

export async function createProject(input: {
  title: string
  stageWidthM: number
  stageDepthM: number
  keepPhotos: boolean
}): Promise<string> {
  const now = Date.now()
  const project: Project = {
    id: newId(),
    title: input.title.trim() || '이름 없는 공연',
    stageWidthM: input.stageWidthM,
    stageDepthM: input.stageDepthM,
    keepPhotos: input.keepPhotos,
    createdAt: now,
    updatedAt: now,
  }
  await db.projects.add(project)
  return project.id
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: Date.now() })
}

/** 공연을 지우면 그 공연의 명단과 컷도 함께 지운다. */
export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.students, db.cuts, async () => {
    await db.cuts.where('projectId').equals(id).delete()
    await db.students.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}

export function listProjects() {
  return db.projects.orderBy('updatedAt').reverse().toArray()
}

/* ---------------- 명단(학생) ---------------- */

export function listStudents(projectId: string) {
  return db.students.where('projectId').equals(projectId).sortBy('order')
}

/** 이름 여러 개를 한 번에 명단에 넣는다. 색과 짧은 이름은 자동으로 정한다. */
export async function addStudents(projectId: string, names: string[]): Promise<Student[]> {
  if (names.length === 0) return []

  const existing = await listStudents(projectId)
  const usedColors = existing.map((s) => s.color)
  const usedShort = existing.map((s) => s.shortName)
  let order = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0

  const created: Student[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const color = pickColor(usedColors)
    const shortName = makeShortName(name, usedShort)
    usedColors.push(color)
    usedShort.push(shortName)
    created.push({
      id: newId(),
      projectId,
      name,
      shortName,
      color,
      order: order++,
    })
  }

  await db.students.bulkAdd(created)
  await updateProject(projectId, {})
  return created
}

export async function updateStudent(id: string, patch: Partial<Student>): Promise<void> {
  await db.students.update(id, patch)
}

export async function deleteStudent(id: string): Promise<void> {
  await db.students.delete(id)
}

/** 되돌리기용 — 지웠던 학생을 그대로 되살린다. */
export async function restoreStudent(student: Student): Promise<void> {
  await db.students.put(student)
}

export function countCuts(projectId: string) {
  return db.cuts.where('projectId').equals(projectId).count()
}
