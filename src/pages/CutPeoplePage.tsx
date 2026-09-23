import { CANVAS_FONT } from "../lib/canvasFont";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import {
  Check,
  EyeOff,
  FlipVertical2,
  Grid3x3,
  ImageDown,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  UserPlus,
  Undo2,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";
import PhotoCanvas from "../components/PhotoCanvas";
import StagePlan, { type Mark } from "../components/StagePlan";
import NamePickerSheet from "../components/NamePickerSheet";
import { db } from "../db/db";
import { addStudents, dropPhotoIfNeeded, updateCut } from "../db/repo";
import { loadImage, releaseImage } from "../lib/image";
import { clampToStage, createStageMapper } from "../lib/homography";
import { detectPeople, footPoint, type PersonBox } from "../lib/detector";
import { textColorOn } from "../lib/colors";
import { describePosition } from "../lib/stageMarks";
import { useAutoSave } from "../lib/useAutoSave";
import { downloadDataUrl, safeFileName } from "../lib/backup";
import { josa } from "../lib/names";
import { useViewPrefs } from "../store/viewPrefs";
import type { Point, Student } from "../db/types";

/** 인식으로 찾은 네모 하나 */
interface DetBox extends PersonBox {
  key: string;
}

/** 화면에 실제로 보여 줄 한 사람의 자리 */
interface Spot {
  key: string;
  bbox?: [number, number, number, number];
  stage: Point;
  studentId?: string;
  /** 사진 속 발 위치 (다리가 가려졌으면 짐작한 자리) */
  foot?: Point;
  footEstimated?: boolean;
}

/** 인식 결과의 발 위치 */
function footOf(box: PersonBox): Point {
  return box.foot ?? footPoint(box.bbox);
}

/**
 * 지난 컷에서 가까이 있던 친구를 이번 컷의 이름 없는 자리에 짝지어 준다.
 * 가장 가까운 짝부터 차례로 정하고, 너무 멀리 떨어진 짝은 만들지 않는다.
 */
function matchByPrevCut(
  spots: Spot[],
  prev: { studentId: string; x: number; y: number }[],
  taken: Set<string>,
): Record<string, string> {
  const pairs: { key: string; studentId: string; d: number }[] = [];
  for (const s of spots) {
    if (s.studentId) continue;
    for (const p of prev) {
      if (taken.has(p.studentId)) continue;
      const d = Math.hypot(p.x - s.stage.x, p.y - s.stage.y);
      if (d < 0.32) pairs.push({ key: s.key, studentId: p.studentId, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedKeys = new Set<string>();
  const usedIds = new Set<string>();
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    if (usedKeys.has(pair.key) || usedIds.has(pair.studentId)) continue;
    usedKeys.add(pair.key);
    usedIds.add(pair.studentId);
    result[pair.key] = pair.studentId;
  }
  return result;
}

/** 되돌리기에 쓰는 한 순간의 상태 */
interface PeopleSnapshot {
  label: string;
  named: Record<string, string>;
  hidden: Record<string, true>;
  moved: Record<string, Point>;
  manual: Spot[];
}

/** 슬라이더 값(0~100)을 인식 민감도로 바꾼다. 오른쪽으로 갈수록 확실한 것만 찾는다. */
function sliderToScore(v: number) {
  return 0.15 + (v / 100) * 0.45;
}

export default function CutPeoplePage() {
  const { id = "", cutId = "" } = useParams();
  const navigate = useNavigate();

  const cut = useLiveQuery(
    async () => (await db.cuts.get(cutId)) ?? null,
    [cutId],
  );
  const project = useLiveQuery(
    async () => (await db.projects.get(id)) ?? null,
    [id],
  );
  const students = useLiveQuery(
    () => db.students.where("projectId").equals(id).sortBy("order"),
    [id],
    [] as Student[],
  );
  const prevCut = useLiveQuery(async () => {
    const c = await db.cuts.get(cutId);
    if (!c || c.order === 0) return null;
    const all = await db.cuts
      .where("projectId")
      .equals(c.projectId)
      .sortBy("order");
    return all.find((x) => x.order === c.order - 1) ?? null;
  }, [cutId]);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [detBoxes, setDetBoxes] = useState<DetBox[]>([]);
  const [named, setNamed] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Record<string, true>>({});
  const [moved, setMoved] = useState<Record<string, Point>>({});
  const [manual, setManual] = useState<Spot[]>([]);
  const [slider, setSlider] = useState(45);
  const [detecting, setDetecting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // 무대 밖(객석·무대 옆)에서 찾은 사람도 보여 줄지
  const [showOffStage, setShowOffStage] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  // 직접 넣기: 이 학생을 다음에 누르는 자리에 놓는다.
  const [placingStudentId, setPlacingStudentId] = useState<string | null>(null);
  // 되돌리기: 바꾸기 직전의 상태를 차곡차곡 쌓아 둔다.
  const [history, setHistory] = useState<PeopleSnapshot[]>([]);
  // 사진이 없는 컷이면 평면도부터 보여 준다. (한 번 정해지면 사용자가 고른 탭을 따른다)
  const [pickedPane, setPickedPane] = useState<"photo" | "plan" | null>(null);
  const prefs = useViewPrefs();
  const restoredRef = useRef<string | null>(null);
  // 콜백 안에서 최신 값을 읽기 위한 보관함
  const hiddenRef = useRef<Record<string, true>>({});
  const movedRef = useRef<Record<string, Point>>({});
  const mapperRef = useRef<ReturnType<typeof createStageMapper>>(null);
  const planStageRef = useRef<Konva.Stage | null>(null);

  // Dexie가 값을 새로 읽을 때마다 배열이 새로 만들어지므로, 내용으로 비교해 고정한다.
  const cornersKey = cut?.stageCorners ? JSON.stringify(cut.stageCorners) : "";
  const mapper = useMemo(
    () => (cornersKey ? createStageMapper(JSON.parse(cornersKey)) : null),
    [cornersKey],
  );

  // 사진 읽기
  useEffect(() => {
    if (!cut?.imageBlob) return;
    let alive = true;
    let loaded: HTMLImageElement | null = null;
    loadImage(cut.imageBlob)
      .then((img) => {
        if (!alive) {
          releaseImage(img);
          return;
        }
        loaded = img;
        setImage(img);
      })
      .catch(() => toast.error("사진을 열 수 없어요."));
    return () => {
      alive = false;
      releaseImage(loaded);
    };
  }, [cut?.imageBlob]);

  /** 인식 결과에 붙여 둔 이름을 잃지 않도록, 직접 넣은 자리로 옮겨 담는다. */
  const keepNamedSpots = useCallback(() => {
    setManual((prevManual) => {
      const kept: Spot[] = [];
      setNamed((prevNamed) => {
        setDetBoxes((prevBoxes) => {
          for (const box of prevBoxes) {
            const studentId = prevNamed[box.key];
            if (!studentId || hiddenRef.current[box.key]) continue;
            const foot = footOf(box);
            const stage =
              movedRef.current[box.key] ??
              (mapperRef.current
                ? clampToStage(mapperRef.current.toStage(foot))
                : { x: 0.5, y: 0.5 });
            kept.push({
              key: `k${box.key}-${Date.now()}`,
              bbox: box.bbox,
              stage,
              studentId,
            });
          }
          return prevBoxes;
        });
        return {};
      });
      return [...prevManual, ...kept];
    });
  }, []);

  const runDetection = useCallback(
    async (img: HTMLImageElement) => {
      setDetecting(true);
      setDetectError(null);
      setProgress(null);
      try {
        const started = performance.now();
        // 낮은 기준으로 한 번만 찾아 두고, 슬라이더는 그 결과를 걸러 내기만 한다.
        // 무대 영역을 알려 주면 무대 근처를 확대해서 뒷줄 친구까지 찾고, 무대 밖 사람은 가려낸다.
        const boxes = await detectPeople(img, 0.12, {
          stageCorners: cornersKey ? JSON.parse(cornersKey) : undefined,
          onProgress: (done, total) => setProgress({ done, total }),
        });
        // 다시 찾으면 네모 번호가 새로 매겨지므로, 이미 이름을 붙인 자리는
        // '직접 넣은 자리'로 옮겨 두어 이름이 사라지지 않게 한다.
        keepNamedSpots();
        setDetBoxes(boxes.map((b, i) => ({ ...b, key: `d${i}` })));
        const seconds = ((performance.now() - started) / 1000).toFixed(1);
        // 화면에 실제로 보이는 개수(민감도 슬라이더를 넘은 것)만 알려 준다.
        const passing = boxes.filter((b) => b.score >= sliderToScore(slider));
        const shown = passing.filter((b) => !b.offStage).length;
        const off = passing.length - shown;
        if (shown === 0) {
          toast("사람을 못 찾았어요. 빈 곳을 길게 눌러 직접 넣어 볼까요?");
        } else {
          toast.success(
            `${shown}명을 찾았어요! (${seconds}초)${off > 0 ? ` · 무대 밖 ${off}명은 뺐어요` : ""}`,
          );
        }
      } catch (err) {
        console.error(err);
        setDetectError(
          "사람 찾기를 준비하지 못했어요. 사진이나 평면도의 빈 곳을 길게 눌러 직접 넣을 수 있어요.",
        );
      } finally {
        setDetecting(false);
        setProgress(null);
      }
    },
    [slider, keepNamedSpots, cornersKey],
  );

  // 저장된 결과가 있으면 그대로 불러오고, 없으면 사람을 찾는다.
  // (사진이 없는 컷도 저장된 자리는 불러와야 하므로 image를 기다리지 않는다)
  useEffect(() => {
    if (!cut || restoredRef.current === cut.id) return;
    if (cut.imageBlob && !image) return; // 사진이 있는 컷은 사진을 다 읽은 뒤에
    restoredRef.current = cut.id;

    const saved: Spot[] = [
      ...cut.placements.map((p, i) => ({
        key: `s${i}`,
        bbox: p.bbox,
        stage: { x: p.x, y: p.y },
        studentId: p.studentId,
      })),
      ...cut.unassigned.map((u, i) => ({
        key: `u${i}`,
        bbox: u.bbox,
        stage: { x: u.x, y: u.y },
      })),
    ];

    if (saved.length > 0) {
      // 저장소(IndexedDB)에서 불러온 값을 화면에 올리는 자리라 상태 설정이 맞다.
      // oxlint-disable-next-line react/set-state-in-effect
      setManual(saved);
      return;
    }
    // 사진이 없는 컷(사진 없이 짜기)은 찾을 것이 없으니 평면도에서 바로 놓게 한다.
    if (image) runDetection(image);
  }, [cut, image, runDetection]);

  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);
  useEffect(() => {
    movedRef.current = moved;
  }, [moved]);
  useEffect(() => {
    mapperRef.current = mapper;
  }, [mapper]);

  const pane = pickedPane ?? (cut && !cut.imageBlob ? "plan" : "photo");
  const setPane = setPickedPane;

  const minScore = sliderToScore(slider);

  /** 화면에 보여 줄 자리 목록 */
  const spots: Spot[] = useMemo(() => {
    const fromDetection: Spot[] = detBoxes
      .filter(
        (b) =>
          !hidden[b.key] &&
          ((b.score >= minScore && (showOffStage || !b.offStage)) || named[b.key]),
      )
      .map((b) => {
        const foot = footOf(b);
        const stage =
          moved[b.key] ??
          (mapper ? clampToStage(mapper.toStage(foot)) : { x: 0.5, y: 0.5 });
        return {
          key: b.key,
          bbox: b.bbox,
          stage,
          studentId: named[b.key],
          foot,
          footEstimated: b.footEstimated,
        };
      });

    const fromManual: Spot[] = manual
      .filter((m) => !hidden[m.key])
      .map((m) => ({
        ...m,
        stage: moved[m.key] ?? m.stage,
        studentId: named[m.key] ?? m.studentId,
      }));

    return [...fromDetection, ...fromManual];
  }, [detBoxes, hidden, named, moved, manual, minScore, mapper, showOffStage]);

  /** 무대 밖이라서 숨겨 둔 사람 수 */
  const offStageCount = useMemo(
    () =>
      detBoxes.filter(
        (b) => b.offStage && !hidden[b.key] && !named[b.key] && b.score >= minScore,
      ).length,
    [detBoxes, hidden, named, minScore],
  );

  const studentById = useMemo(() => {
    const map: Record<string, Student> = {};
    for (const s of students) map[s.id] = s;
    return map;
  }, [students]);

  const placedIds = useMemo(
    () => new Set(spots.map((s) => s.studentId).filter(Boolean) as string[]),
    [spots],
  );

  /** 이 컷에 아직 자리를 안 잡은 친구들 */
  const missingStudents = useMemo(
    () => students.filter((student) => !placedIds.has(student.id)),
    [students, placedIds],
  );

  const namedCount = placedIds.size;
  const unnamedCount = spots.length - namedCount;

  /** 지난 컷에서 이 근처에 있던 학생을 추천한다. */
  function suggestFor(spot: Spot | undefined): string | undefined {
    if (!spot || !prevCut) return undefined;
    let best: { id: string; d: number } | undefined;
    for (const p of prevCut.placements) {
      if (placedIds.has(p.studentId)) continue;
      const d = Math.hypot(p.x - spot.stage.x, p.y - spot.stage.y);
      if (d < 0.25 && (!best || d < best.d)) best = { id: p.studentId, d };
    }
    return best?.id;
  }

  /** 지난 컷에서 이어 붙일 수 있는 이름 수 */
  const prevMatches = useMemo(
    () => (prevCut ? matchByPrevCut(spots, prevCut.placements, placedIds) : {}),
    [prevCut, spots, placedIds],
  );
  const prevMatchCount = Object.keys(prevMatches).length;

  /** 지난 컷 자리를 보고 이름 없는 네모에 한꺼번에 이름을 붙인다. */
  function autoNameFromPrev() {
    if (prevMatchCount === 0) return;
    remember("지난 컷처럼 이름 붙이기");
    setNamed((prev) => ({ ...prev, ...prevMatches }));
    toast.success(
      `${prevMatchCount}명에게 지난 컷 이름을 붙였어요. 틀린 이름은 눌러서 고쳐요.`,
    );
  }

  function addManualSpot(
    stage: Point,
    bbox?: [number, number, number, number],
  ) {
    remember("직접 넣기");
    const key = `m${Date.now()}`;
    setManual((prev) => [...prev, { key, stage: clampToStage(stage), bbox }]);
    setPicking(key);
  }

  /** 바꾸기 직전 상태를 기억해 둔다. */
  function remember(label: string) {
    setHistory((prev) => [
      ...prev.slice(-19),
      { label, named, hidden, moved, manual },
    ]);
  }

  /** 한 칸 되돌리기 */
  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setNamed(last.named);
    setHidden(last.hidden);
    setMoved(last.moved);
    setManual(last.manual);
    setHistory((prev) => prev.slice(0, -1));
    setPlacingStudentId(null);
    toast.success(`되돌렸어요: ${last.label}`);
  }

  /** 직접 넣기 모드에서 고른 친구를 이 자리에 놓는다. */
  function placePendingStudent(
    stage: Point,
    bbox?: [number, number, number, number],
  ) {
    if (!placingStudentId) return false;
    remember(`${studentById[placingStudentId]?.name ?? "친구"} 넣기`);
    const key = `m${Date.now()}`;
    const at = clampToStage(stage);
    setManual((prev) => [
      ...prev,
      { key, stage: at, bbox, studentId: placingStudentId },
    ]);
    const student = studentById[placingStudentId];
    setPlacingStudentId(null);
    toast.success(
      `${student?.name ?? "친구"} 자리를 넣었어요. (${describePosition(at.x)})`,
    );
    return true;
  }

  /** 누른 곳을 발 위치로 보고, 그 위로 사람만 한 네모를 만들어 둔다. */
  function boxAtFoot(p: Point): [number, number, number, number] {
    const size = image ? image.width * 0.06 : 40;
    return [p.x - size / 2, p.y - size * 2.4, size, size * 2.4];
  }

  function handleLongPressPhoto(p: Point) {
    if (!mapper) return;
    addManualSpot(mapper.toStage(p), boxAtFoot(p));
  }

  function handleTapPhoto(p: Point) {
    if (!mapper || !placingStudentId) return;
    placePendingStudent(mapper.toStage(p), boxAtFoot(p));
  }

  async function handlePick(studentId: string) {
    if (!picking) return;
    remember(`${studentById[studentId]?.name ?? "친구"} 이름 붙이기`);
    setNamed((prev) => ({ ...prev, [picking]: studentId }));
    setPicking(null);
    const student = studentById[studentId];
    if (student) toast.success(`${student.name} 자리를 정했어요!`);
  }

  async function handleAddNew(name: string) {
    const [created] = await addStudents(id, [name]);
    if (created && picking) {
      setNamed((prev) => ({ ...prev, [picking]: created.id }));
      setPicking(null);
      toast.success(
        `${created.name}${josa(created.name, "을", "를")} 명단에 넣고 자리를 정했어요!`,
      );
    }
  }

  function handleRemove() {
    if (!picking) return;
    remember("표시 지우기");
    setHidden((prev) => ({ ...prev, [picking]: true }));
    setNamed((prev) => {
      const next = { ...prev };
      delete next[picking];
      return next;
    });
    setPicking(null);
  }

  const lastSavedRef = useRef("");
  const saveSpots = useCallback(
    async (list: Spot[]) => {
      // 내용이 그대로면 저장하지 않는다. (저장 → 다시 읽기 → 또 저장 되풀이를 막는다)
      const fingerprint = JSON.stringify(list);
      if (fingerprint === lastSavedRef.current) return;
      lastSavedRef.current = fingerprint;
      await updateCut(cutId, {
        placements: list
          .filter((s) => s.studentId)
          .map((s) => ({
            studentId: s.studentId!,
            x: s.stage.x,
            y: s.stage.y,
            bbox: s.bbox,
          })),
        unassigned: list
          .filter((s) => !s.studentId)
          .map((s) => ({ x: s.stage.x, y: s.stage.y, bbox: s.bbox })),
      });
    },
    [cutId],
  );

  // 저장 버튼을 누르기 전에 화면을 떠나도 작업이 남도록 자동으로 저장한다.
  useAutoSave(spots, saveSpots);

  /** 지금 평면도를 그림 파일(PNG)로 저장한다. */
  function savePlanImage() {
    const stage = planStageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const name = safeFileName("plan", "png", `cut${(cut?.order ?? 0) + 1}`);
    downloadDataUrl(dataUrl, name);
    toast.success(`평면도를 그림으로 저장했어요! (${name})`);
  }

  async function handleSave() {
    await saveSpots(spots);
    await dropPhotoIfNeeded(cutId);
    toast.success("컷을 저장했어요!");
    navigate(`/project/${id}`);
  }

  const planMarks: Mark[] = spots.map((s) => {
    const student = s.studentId ? studentById[s.studentId] : undefined;
    return {
      id: s.key,
      x: s.stage.x,
      y: s.stage.y,
      color: student?.color ?? "#9AA3B5",
      label: student?.shortName ?? "?",
    };
  });

  const ghosts: Mark[] = useMemo(() => {
    if (!prevCut) return [];
    return prevCut.placements.flatMap((p) => {
      const student = studentById[p.studentId];
      if (!student) return [];
      // 같은 학생이 이번 컷에서도 있으면, 그 자리 key로 이어 준다.
      const here = spots.find((s) => s.studentId === p.studentId);
      if (!here) return [];
      return [
        {
          id: here.key,
          x: p.x,
          y: p.y,
          color: student.color,
          label: student.shortName,
        },
      ];
    });
  }, [prevCut, studentById, spots]);

  if (cut === undefined || project === undefined) return null;
  if (!cut || !project) {
    return (
      <>
        <AppHeader backTo={`/project/${id}`} title="컷을 찾을 수 없어요" />
        <main className="app-main" id="main-content">
          <div className="empty">
            <p>이 컷은 지워졌어요.</p>
          </div>
        </main>
      </>
    );
  }

  // 무대 영역은 '사진 좌표 → 무대 좌표'를 바꿀 때만 필요하다.
  // 사진이 없는 컷은 평면도에서 바로 놓으므로 없어도 된다.
  if (!cut.stageCorners && cut.imageBlob) {
    return (
      <>
        <AppHeader backTo={`/project/${id}`} title={cut.title} />
        <main className="app-main" id="main-content">
          <div className="empty">
            <MapPin size={44} aria-hidden="true" />
            <p>먼저 무대 네 귀퉁이를 정해야 해요.</p>
            <button
              type="button"
              className="btn btn-primary btn-big"
              onClick={() => navigate(`/project/${id}/cut/${cutId}/stage`)}
            >
              무대 영역 정하러 가기
            </button>
          </div>
        </main>
      </>
    );
  }

  const pickingSpot = spots.find((s) => s.key === picking);

  return (
    <>
      <AppHeader
        backTo={`/project/${id}/cut/${cutId}/stage`}
        title={cut.title}
        help={{
          title: "이름은 이렇게 붙여요",
          body: (
            <>
              <p>
                사진에서 사람 모양을 찾아 네모로 표시했어요. 네모를 누르고
                이름을 고르면 돼요.
              </p>
              <p>
                못 찾은 친구가 있으면{" "}
                <strong>사진이나 평면도의 빈 곳을 길게 누르면</strong> 직접 넣을
                수 있어요.
              </p>
              <p>
                사람이 아닌 네모는 눌러서 <strong>사람 아니에요</strong>로
                지워요. 평면도의 동그란 이름표는 끌어서 자리를 고칠 수 있어요.
              </p>
              <p>
                얼굴은 알아보지 않아요. 사람 모양만 찾고, 이름은 여러분이
                붙여요.
              </p>
            </>
          ),
        }}
      />

      <main className="app-main work-main has-save-bar" id="main-content">
        <div className="guide-bar" role="status">
          {placingStudentId ? (
            <UserPlus size={22} aria-hidden="true" />
          ) : detecting ? (
            <Loader2 size={22} className="spin" aria-hidden="true" />
          ) : (
            <Users size={22} aria-hidden="true" />
          )}
          <span>
            {placingStudentId
              ? `${studentById[placingStudentId]?.name ?? "친구"}${josa(
                  studentById[placingStudentId]?.name ?? "친구",
                  "이",
                  "가",
                )} 선 자리를 사진이나 평면도에서 눌러요`
              : detecting
                ? "사람을 찾는 중이에요…"
                : unnamedCount > 0
                  ? `네모를 눌러 이름을 붙여요 · 남은 네모 ${unnamedCount}개`
                  : namedCount > 0
                    ? `모두 이름을 붙였어요! ${namedCount}명`
                    : cut?.imageBlob
                      ? "빈 곳을 길게 눌러 친구를 넣어 보세요."
                      : "아래에서 친구 이름을 누르고, 평면도에서 설 자리를 눌러요."}
          </span>
        </div>

        {prevMatchCount > 0 && !detecting && !placingStudentId && (
          <div className="suggest-bar pop-in">
            <Sparkles size={22} aria-hidden="true" />
            <span>
              지난 컷과 비슷한 자리에 <strong>{prevMatchCount}명</strong>이 있어요.
              한 번에 이름을 붙일까요?
            </span>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={autoNameFromPrev}
            >
              지난 컷처럼 이름 붙이기
            </button>
          </div>
        )}

        {detectError && (
          <div className="notice notice-warn" role="alert">
            <MapPin size={22} aria-hidden="true" />
            <span>{detectError}</span>
          </div>
        )}

        <div className="pane-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={pane === "photo"}
            className={pane === "photo" ? "is-on" : ""}
            onClick={() => setPane("photo")}
          >
            사진
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pane === "plan"}
            className={pane === "plan" ? "is-on" : ""}
            onClick={() => setPane("plan")}
          >
            무대 평면도
          </button>
        </div>

        <div className="work-split">
          <section
            className="pane"
            data-active={pane === "photo"}
            aria-label="사진"
          >
            {image ? (
              <div className="photo-stage">
                <PhotoCanvas
                  image={image}
                  corners={cut.stageCorners ?? []}
                  showCorners={false}
                  zoom={zoom}
                  magnify={zoom === 1}
                  onTapImage={handleTapPhoto}
                  onLongPress={handleLongPressPhoto}
                >
                  {(scale) =>
                    spots
                      .filter((s) => s.bbox)
                      .map((s) => {
                        const [bx, by, bw, bh] = s.bbox!;
                        const student = s.studentId
                          ? studentById[s.studentId]
                          : undefined;
                        const color = student?.color ?? "#256EF4";
                        const foot = s.foot ?? { x: bx + bw / 2, y: by + bh };
                        const label = student?.name ?? "?";
                        return (
                          <Group
                            key={s.key}
                            x={bx * scale}
                            y={by * scale}
                            onClick={() => setPicking(s.key)}
                            onTap={() => setPicking(s.key)}
                          >
                            <Rect
                              name="overlay"
                              width={bw * scale}
                              height={bh * scale}
                              cornerRadius={8}
                              stroke={color}
                              strokeWidth={student ? 3.5 : 2.5}
                              dash={student ? undefined : [8, 6]}
                              fill={student ? "rgba(255,255,255,0.08)" : "rgba(37,110,244,0.08)"}
                              shadowColor="#000"
                              shadowOpacity={0.25}
                              shadowBlur={4}
                            />
                            {/* 발 위치: 가려져서 짐작한 경우 점선으로 이어 준다 */}
                            {s.footEstimated && (
                              <Line
                                listening={false}
                                points={[
                                  (bw / 2) * scale,
                                  bh * scale,
                                  (foot.x - bx) * scale,
                                  (foot.y - by) * scale,
                                ]}
                                stroke={color}
                                strokeWidth={2}
                                dash={[4, 4]}
                              />
                            )}
                            <Circle
                              listening={false}
                              x={(foot.x - bx) * scale}
                              y={(foot.y - by) * scale}
                              radius={5}
                              fill={color}
                              stroke="#fff"
                              strokeWidth={2}
                            />
                            <Rect
                              name="overlay"
                              y={-24}
                              width={Math.max(30, label.length * 15 + 14)}
                              height={22}
                              cornerRadius={11}
                              fill={color}
                            />
                            <Text
                              text={label}
                              y={-21}
                              width={Math.max(30, label.length * 15 + 14)}
                              align="center"
                              fontSize={14}
                              fontStyle="bold"
                              fontFamily={CANVAS_FONT}
                              fill={textColorOn(color)}
                              listening={false}
                            />
                          </Group>
                        );
                      })
                  }
                </PhotoCanvas>
                {detecting && (
                  <div className="scan-overlay" role="status">
                    <span className="scan-line" aria-hidden="true" />
                    <span className="scan-label">
                      <Loader2 size={18} className="spin" aria-hidden="true" />
                      사람을 찾는 중
                      {progress ? ` ${Math.round((progress.done / progress.total) * 100)}%` : "…"}
                    </span>
                  </div>
                )}
                <div className="zoom-tools">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
                    disabled={zoom <= 1}
                    aria-label="사진 작게 보기"
                  >
                    <ZoomOut size={20} aria-hidden="true" />
                  </button>
                  <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
                    disabled={zoom >= 3}
                    aria-label="사진 크게 보기"
                  >
                    <ZoomIn size={20} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty">
                <MapPin size={44} aria-hidden="true" />
                <p>이 컷에는 사진이 없어요.</p>
                <p>
                  <strong>무대 평면도</strong>에서 친구를 직접 놓고 끌어서
                  동선을 짜 보세요.
                </p>
              </div>
            )}

            {image && (
              <div className="panel">
                <div className="field field-compact">
                  <div className="field-row">
                    <label htmlFor="sens">사람 찾기 민감도</label>
                    <span className="field-value">
                      {detBoxes.length > 0
                        ? `찾은 사람 ${spots.filter((s) => s.bbox).length}명`
                        : ""}
                    </span>
                  </div>
                  <input
                    id="sens"
                    className="slider"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={slider}
                    onChange={(e) => setSlider(Number(e.target.value))}
                    disabled={detBoxes.length === 0}
                  />
                  <div className="slider-ends">
                    <span>더 많이 찾기</span>
                    <span>확실한 것만</span>
                  </div>
                </div>

                <div className="toolbar">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={undo}
                    disabled={history.length === 0}
                  >
                    <Undo2 size={20} aria-hidden="true" />
                    되돌리기
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => image && runDetection(image)}
                    disabled={!image || detecting}
                  >
                    {detecting ? (
                      <Loader2 size={20} className="spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw size={20} aria-hidden="true" />
                    )}
                    다시 찾기
                  </button>
                  {(offStageCount > 0 || showOffStage) && (
                    <button
                      type="button"
                      className={`btn btn-ghost${showOffStage ? " is-on" : ""}`}
                      onClick={() => setShowOffStage((v) => !v)}
                      aria-pressed={showOffStage}
                    >
                      <EyeOff size={20} aria-hidden="true" />
                      {showOffStage ? "무대 밖 사람 숨기기" : `무대 밖 ${offStageCount}명 보기`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {!image && (
              <div className="toolbar">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={undo}
                  disabled={history.length === 0}
                >
                  <Undo2 size={20} aria-hidden="true" />
                  되돌리기
                </button>
              </div>
            )}
          </section>

          <section
            className="pane"
            data-active={pane === "plan"}
            aria-label="무대 평면도"
          >
            <StagePlan
              stageWidthM={project.stageWidthM}
              stageDepthM={project.stageDepthM}
              marks={planMarks}
              ghosts={ghosts}
              showGrid={prefs.showGrid}
              flipped={prefs.flipped}
              stageRef={planStageRef}
              onMoveMark={(key, x, y) =>
                setMoved((prev) => ({ ...prev, [key]: { x, y } }))
              }
              onSelectMark={(key) => setPicking(key)}
              onLongPressEmpty={(x, y) => addManualSpot({ x, y })}
              onTapEmpty={(x, y) => placePendingStudent({ x, y })}
            />
            <div className="toolbar">
              <button
                type="button"
                className={`btn btn-ghost${prefs.showGrid ? " is-on" : ""}`}
                onClick={() => prefs.set({ showGrid: !prefs.showGrid })}
                aria-pressed={prefs.showGrid}
              >
                <Grid3x3 size={20} aria-hidden="true" />
                9구역 선
              </button>
              <button
                type="button"
                className={`btn btn-ghost${prefs.flipped ? " is-on" : ""}`}
                onClick={() => prefs.set({ flipped: !prefs.flipped })}
                aria-pressed={prefs.flipped}
                title="무대를 반대쪽에서 봐요"
              >
                <FlipVertical2 size={20} aria-hidden="true" />
                {prefs.flipped ? "무대에서 본 모습" : "객석에서 본 모습"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={savePlanImage}
              >
                <ImageDown size={20} aria-hidden="true" />
                그림으로 저장
              </button>
            </div>
            <p className="hint">
              동그란 이름표를 끌어서 자리를 고칠 수 있어요. 빈 곳을 길게 누르면
              친구를 직접 넣어요.
            </p>
          </section>
        </div>

        <section className="missing-wrap">
          <h2 className="section-title">
            <UserPlus size={20} aria-hidden="true" /> 아직 자리를 안 정한 친구
            {missingStudents.length > 0 && (
              <span className="count-badge">{missingStudents.length}</span>
            )}
          </h2>
          {missingStudents.length === 0 ? (
            <p className="hint">모든 친구가 자리를 잡았어요! 👏</p>
          ) : (
            <>
              <p className="hint">
                앱이 못 찾은 친구는 여기서 이름을 누른 다음, 사진이나 평면도에서
                그 친구가 선 자리를 한 번 누르면 들어가요.
              </p>
              <div className="chip-grid">
                {missingStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className={`picker-chip${placingStudentId === student.id ? " is-current" : ""}`}
                    style={{
                      background: student.color,
                      color: textColorOn(student.color),
                      opacity:
                        placingStudentId && placingStudentId !== student.id
                          ? 0.45
                          : 1,
                    }}
                    onClick={() =>
                      setPlacingStudentId((prev) =>
                        prev === student.id ? null : student.id,
                      )
                    }
                    aria-pressed={placingStudentId === student.id}
                  >
                    <UserPlus size={18} aria-hidden="true" />
                    <span className="picker-name">{student.name}</span>
                  </button>
                ))}
              </div>
              {placingStudentId && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => setPlacingStudentId(null)}
                  style={{ marginTop: "var(--sp-3)" }}
                >
                  그만두기
                </button>
              )}
            </>
          )}
        </section>

        <div className="save-bar">
          <div className="save-bar-inner">
            <div className="save-bar-status">
              <span className="save-bar-count">
                {namedCount}
                <small>/{students.length}명</small>
              </span>
              <span className="save-bar-label">자리를 정했어요</span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
            >
              <Check size={22} aria-hidden="true" />컷 저장하기
            </button>
          </div>
        </div>
      </main>

      {picking && (
        <NamePickerSheet
          students={students}
          placedIds={placedIds}
          currentId={pickingSpot?.studentId}
          suggestedId={suggestFor(pickingSpot)}
          onPick={handlePick}
          onAddNew={handleAddNew}
          onRemove={handleRemove}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}
