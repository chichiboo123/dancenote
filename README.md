# 동선노트 (Dongseon Note)

> 뮤지컬 연습 장면을 무대 평면도 위의 **동그란 이름표**로 옮겨 기록하는 교실용 웹앱

초등학교 뮤지컬 수업에서, 연습 사진을 찍으면 학생들이 무대 어디에 서 있었는지를
위에서 내려다본 무대 평면도에 옮겨 줍니다. 동선이 바뀔 때마다 컷을 쌓고,
컷을 이어 재생하면 동선이 움직이는 모습을 볼 수 있습니다.

- **사용자**: 초등 교사, 그리고 초등학생(3~6학년) 혼자서도 사용 가능
- **기기**: 태블릿(아이패드·갤럭시탭) 우선, 스마트폰·PC에서도 동작
- **서버 없음**: 모든 처리는 브라우저 안에서만 이루어집니다

## 🔒 개인정보 안내 (꼭 읽어 주세요)

- 사진과 이름은 **이 기기 안(브라우저 저장소)에만** 저장됩니다.
- 인터넷으로 어디에도 보내지 않고, 분석 도구(트래킹)도 넣지 않았습니다.
- **얼굴을 알아보지 않습니다.** 사람의 형태만 찾고, 이름은 사용자가 직접 붙입니다.
- 공연을 만들 때 "사진은 저장하지 않고 위치만 저장하기"를 켜면 원본 사진을
  남기지 않고 평면도 자리만 보관합니다.
- 기기에서 앱 자료를 지우면 되돌릴 수 없으니, 필요하면 JSON 백업을 내보내 두세요.

## 사용법

1. **새 공연 만들기** — 공연 이름과 무대 크기(가로·세로 m)를 정합니다.
2. **친구 명단 넣기** — 한 명씩 넣거나, 엑셀에서 복사한 이름을 한 번에 붙여넣습니다.
   이름마다 서로 잘 구분되는 색이 자동으로 배정되고, 칩을 누르면 색·배역을 바꿀 수 있습니다.
3. *(다음 단계에서 추가됩니다)* 사진 찍기 / 사진·영상 올리기 → 무대 네 귀퉁이 지정 →
   사람 인식 → 이름 붙이기 → 컷 저장 → 동선 재생 → PNG·PDF·JSON 내보내기

## 개발 현황

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 1 | 기반 세팅, 디자인 토큰, 저장소, 홈·공연·명단 화면 | ✅ 완료 |
| 2 | 사진 입력 + 무대 영역(네 귀퉁이) 지정 | ⏳ 예정 |
| 3 | 사람 인식(MediaPipe) + 이름 붙이기 | ⏳ 예정 |
| 4 | 컷 타임라인 + 동선 재생 | ⏳ 예정 |
| 5 | 영상 입력 + 프레임 캡처 | ⏳ 예정 |
| 6 | 내보내기, PWA, 첫 사용 안내, 배포 마무리 | ⏳ 예정 |

## 개발 환경

```bash
npm install     # 처음 한 번
npm run dev     # 개발 서버 (http://localhost:5173/dancenote/)
npm run build   # 배포용 빌드
npm run preview # 빌드 결과 확인
npm run lint    # 문법 검사
```

### 배포

`main` 브랜치에 푸시하면 GitHub Actions가 자동으로 빌드해 GitHub Pages에 올립니다
(`.github/workflows/deploy.yml`).
처음 한 번은 저장소 **Settings → Pages → Source** 를 **GitHub Actions** 로 바꿔 주세요.

다른 경로에 올릴 때는 `VITE_BASE` 환경변수로 base 경로를 바꿀 수 있습니다.

## 사용한 오픈소스

| 이름 | 역할 | 라이선스 | 링크 |
| --- | --- | --- | --- |
| React | 화면 구성 | MIT | https://react.dev |
| Vite | 빌드·개발 서버 | MIT | https://vite.dev |
| TypeScript | 타입 검사 | Apache-2.0 | https://www.typescriptlang.org |
| React Router | 화면 이동 | MIT | https://reactrouter.com |
| Dexie.js | 브라우저 저장소(IndexedDB) | Apache-2.0 | https://dexie.org |
| Zustand | 상태 관리 | MIT | https://zustand.docs.pmnd.rs |
| sonner | 안내 토스트 | MIT | https://sonner.emilkowal.ski |
| Lucide React | 아이콘 | ISC | https://lucide.dev |
| oxlint | 문법 검사 | MIT | https://oxc.rs |
| Jua · Gowun Dodum | 글꼴 | SIL Open Font License 1.1 | https://fonts.google.com |
| Material Icons Outlined | 푸터 아이콘 | Apache-2.0 | https://fonts.google.com/icons |

다음 단계에서 추가될 예정인 오픈소스: MediaPipe Tasks Vision(Apache-2.0),
perspective-transform(MIT), Konva·react-konva(MIT), jsPDF(MIT), vite-plugin-pwa(MIT).

---

Created by. 교육뮤지컬 꿈꾸는 치수쌤 — https://litt.ly/chichiboo
