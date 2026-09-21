/** 동선노트가 다루는 자료의 모양 */

/** 사진 위의 한 점 (이미지 좌표) */
export interface Point {
  x: number
  y: number
}

/** 공연(프로젝트) */
export interface Project {
  id: string
  /** 공연 이름 */
  title: string
  /** 무대 가로 길이(m) */
  stageWidthM: number
  /** 무대 세로(앞뒤) 길이(m) */
  stageDepthM: number
  /** true면 원본 사진을 저장하지 않고 위치만 남긴다 */
  keepPhotos: boolean
  /**
   * 이 공연의 기본 무대 영역 (이미지 좌표).
   * 같은 자리에서 찍은 사진·영상이면 한 번만 정하면 되도록, 새 컷에 자동으로 물려준다.
   */
  defaultStageCorners?: [Point, Point, Point, Point]
  /** 기본 무대 영역을 정할 때 쓴 사진 크기 (크기가 다르면 물려주지 않는다) */
  defaultStageImageSize?: { width: number; height: number }
  createdAt: number
  updatedAt: number
}

/** 학생 한 명 */
export interface Student {
  id: string
  projectId: string
  /** 전체 이름 (예: 김서준) */
  name: string
  /** 아이콘에 쓰는 짧은 이름 (예: 서준) */
  shortName: string
  /** 배역 이름 (선택) */
  role?: string
  /** 아이콘 색 (#rrggbb) */
  color: string
  /** 명단에서의 순서 */
  order: number
}

/** 평면도 위 한 사람의 자리 */
export interface Placement {
  studentId: string
  /** 사진 위 사각형 (인식으로 만든 자리면 들어 있다) */
  bbox?: [number, number, number, number]
  /** 무대 좌표 0~1 (왼쪽 → 오른쪽) */
  x: number
  /** 무대 좌표 0~1 (무대 뒤 → 무대 앞) */
  y: number
}

/** 아직 이름을 붙이지 않은 인식 결과 */
export interface UnassignedSpot {
  /** 무대 좌표 0~1 */
  x: number
  y: number
  /** 사진 위 사각형 [x, y, 너비, 높이] (이미지 좌표). 직접 넣은 자리는 없을 수 있다. */
  bbox?: [number, number, number, number]
}

/** 한 장면(컷) */
export interface Cut {
  id: string
  projectId: string
  /** 정렬 순서 */
  order: number
  title: string
  memo: string
  source: 'camera' | 'photo' | 'video'
  /** 캡처한 사진 (사진을 저장하지 않는 설정이면 없음) */
  imageBlob?: Blob
  /** 사진 원본 크기 */
  imageSize?: { width: number; height: number }
  /** 영상에서 딴 컷이면 파일 이름과 시각 */
  video?: { fileName: string; timeSec: number }
  /** 무대 네 귀퉁이 (이미지 좌표, 뒤왼→뒤오→앞오→앞왼 순서) */
  stageCorners?: [Point, Point, Point, Point]
  placements: Placement[]
  unassigned: UnassignedSpot[]
  createdAt: number
  updatedAt: number
}
