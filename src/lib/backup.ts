import { db } from '../db/db'
import type { Cut, Project, Student } from '../db/types'
import { newId } from '../db/repo'

/**
 * 공연 하나를 통째로 JSON 파일로 내보내고 다시 불러오는 도구.
 * 기기를 바꾸거나, 기기를 초기화하기 전에 자료를 지키는 용도다.
 */

const FORMAT = 'dongseon-note-backup'
const VERSION = 1

interface BackupFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  project: Project
  students: Student[]
  /** 사진은 용량이 커서 선택해서 담는다. 담을 때는 글자로 바꿔 넣는다. */
  cuts: (Omit<Cut, 'imageBlob'> & { imageDataUrl?: string })[]
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'))
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/** 공연 하나를 백업 파일(JSON)로 만든다. */
export async function exportProject(
  projectId: string,
  options: { includePhotos: boolean },
): Promise<{ json: string; fileName: string }> {
  const project = await db.projects.get(projectId)
  if (!project) throw new Error('공연을 찾을 수 없어요.')
  const students = await db.students.where('projectId').equals(projectId).sortBy('order')
  const cuts = await db.cuts.where('projectId').equals(projectId).sortBy('order')

  const packedCuts: BackupFile['cuts'] = []
  for (const cut of cuts) {
    const { imageBlob, ...rest } = cut
    packedCuts.push({
      ...rest,
      imageDataUrl:
        options.includePhotos && imageBlob ? await blobToDataUrl(imageBlob) : undefined,
    })
  }

  const file: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    project,
    students,
    cuts: packedCuts,
  }

  return {
    json: JSON.stringify(file),
    fileName: safeFileName('backup', 'json'),
  }
}

/** 백업 파일을 읽어 새 공연으로 넣는다. (기존 공연을 덮어쓰지 않는다) */
export async function importProject(text: string): Promise<{ projectId: string; title: string }> {
  let parsed: BackupFile
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('백업 파일이 아니에요. 동선노트에서 내보낸 JSON 파일을 골라 주세요.')
  }
  if (parsed?.format !== FORMAT || !parsed.project) {
    throw new Error('동선노트 백업 파일이 아니에요.')
  }

  // 아이디를 모두 새로 매겨서, 이미 있는 공연과 섞이지 않게 한다.
  const projectId = newId()
  const studentIdMap = new Map<string, string>()
  const now = Date.now()

  const project: Project = {
    ...parsed.project,
    id: projectId,
    title: parsed.project.title,
    createdAt: parsed.project.createdAt ?? now,
    updatedAt: now,
  }

  const students: Student[] = (parsed.students ?? []).map((s) => {
    const id = newId()
    studentIdMap.set(s.id, id)
    return { ...s, id, projectId }
  })

  const cuts: Cut[] = []
  for (const packed of parsed.cuts ?? []) {
    const { imageDataUrl, ...rest } = packed
    cuts.push({
      ...rest,
      id: newId(),
      projectId,
      imageBlob: imageDataUrl ? await dataUrlToBlob(imageDataUrl) : undefined,
      // 명단에 없는 학생을 가리키는 자리는 버린다.
      placements: (rest.placements ?? [])
        .filter((p) => studentIdMap.has(p.studentId))
        .map((p) => ({ ...p, studentId: studentIdMap.get(p.studentId)! })),
      unassigned: rest.unassigned ?? [],
    })
  }

  await db.transaction('rw', db.projects, db.students, db.cuts, async () => {
    await db.projects.add(project)
    if (students.length) await db.students.bulkAdd(students)
    if (cuts.length) await db.cuts.bulkAdd(cuts)
  })

  return { projectId, title: project.title }
}

/**
 * 내려받을 파일 이름을 만든다.
 *
 * 한글이 들어간 파일 이름은 일부 브라우저에서 'download'(확장자 없음)로 바뀌어 버려서,
 * 나중에 다시 불러올 수 없게 된다. 그래서 파일 이름은 영문·숫자만 쓰고,
 * 공연 이름은 파일 안에 담아 둔다. (불러올 때 한글 제목이 그대로 나온다)
 */
export function safeFileName(kind: string, ext: string, extra?: string): string {
  const day = new Date().toISOString().slice(0, 10)
  const tail = extra ? `_${extra.replace(/[^A-Za-z0-9-]/g, '')}` : ''
  return `dongseon-note_${kind}${tail}_${day}.${ext}`
}

/** 브라우저에서 파일 내려받기 */
export function downloadFile(content: Blob | string, fileName: string, type = 'application/json') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 브라우저가 파일을 다 받을 시간을 조금 준다.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** 데이터 URL(캔버스 그림)을 파일로 내려받기 */
export function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
}
