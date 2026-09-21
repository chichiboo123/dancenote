import { db } from './db'
import type { Cut, Project, Student } from './types'
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

/* ---------------- 컷 ---------------- */

export function listCuts(projectId: string) {
  return db.cuts.where('projectId').equals(projectId).sortBy('order')
}

export function getCut(id: string) {
  return db.cuts.get(id)
}

/** 가장 마지막 컷 (무대 영역을 물려받을 때 쓴다) */
export async function lastCut(projectId: string): Promise<Cut | undefined> {
  const cuts = await listCuts(projectId)
  return cuts[cuts.length - 1]
}

/**
 * 사진 파일들로 컷을 만든다. 고른 순서대로 컷이 생긴다.
 * 직전 컷의 무대 영역이 있으면 그대로 물려받는다. (삼각대·영상 촬영 대응)
 */
export async function createCutsFromImages(
  projectId: string,
  images: { blob: Blob; width: number; height: number }[],
  source: Cut['source'],
): Promise<string[]> {
  const existing = await listCuts(projectId)
  const previous = existing[existing.length - 1]
  let order = existing.length
  const now = Date.now()

  const cuts: Cut[] = images.map((img, i) => ({
    id: newId(),
    projectId,
    order: order++,
    title: `컷 ${order}`,
    memo: '',
    source,
    imageBlob: img.blob,
    imageSize: { width: img.width, height: img.height },
    stageCorners: previous?.stageCorners,
    placements: [],
    unassigned: [],
    createdAt: now + i,
    updatedAt: now + i,
  }))

  await db.cuts.bulkAdd(cuts)
  await updateProject(projectId, {})
  return cuts.map((c) => c.id)
}

export async function updateCut(id: string, patch: Partial<Cut>): Promise<void> {
  await db.cuts.update(id, { ...patch, updatedAt: Date.now() })
  const cut = await db.cuts.get(id)
  if (cut) await updateProject(cut.projectId, {})
}

export async function deleteCut(id: string): Promise<void> {
  await db.cuts.delete(id)
}

/** 사진을 저장하지 않는 공연이면, 컷을 마무리할 때 원본 사진을 지운다. */
export async function dropPhotoIfNeeded(cutId: string): Promise<void> {
  const cut = await db.cuts.get(cutId)
  if (!cut) return
  const project = await db.projects.get(cut.projectId)
  if (project && !project.keepPhotos && cut.imageBlob) {
    await db.cuts.update(cutId, { imageBlob: undefined })
  }
}

/** 컷 순서를 통째로 다시 매긴다. (타임라인에서 끌어 옮겼을 때) */
export async function reorderCuts(projectId: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.cuts, db.projects, async () => {
    await Promise.all(orderedIds.map((cutId, index) => db.cuts.update(cutId, { order: index })))
  })
  await updateProject(projectId, {})
}

/**
 * 영상에서 딴 한 장면으로 컷을 만든다.
 * 영상 파일 자체는 저장하지 않고, 파일 이름과 시각만 적어 둔다. (용량 때문)
 */
export async function createCutFromVideoFrame(
  projectId: string,
  image: { blob: Blob; width: number; height: number },
  video: { fileName: string; timeSec: number },
): Promise<string> {
  const [cutId] = await createCutsFromImages(projectId, [image], 'video')
  await db.cuts.update(cutId, {
    video,
    title: `${formatTime(video.timeSec)} 장면`,
  })
  return cutId
}

/** 초를 "1:23.4" 처럼 보여 준다. */
export function formatTime(sec: number): string {
  const safe = Math.max(0, sec)
  const m = Math.floor(safe / 60)
  const s = Math.floor(safe % 60)
  const tenth = Math.floor((safe * 10) % 10)
  return `${m}:${String(s).padStart(2, '0')}.${tenth}`
}

/** 이 공연에서 마지막으로 쓴 영상 파일 이름 */
export async function lastVideoFileName(projectId: string): Promise<string | null> {
  const cuts = await listCuts(projectId)
  for (let i = cuts.length - 1; i >= 0; i--) {
    if (cuts[i].video?.fileName) return cuts[i].video!.fileName
  }
  return null
}
