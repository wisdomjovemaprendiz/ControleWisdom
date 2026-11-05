"use client";
import { isManager, loginAddress } from "@/lib/accounts";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardCheck,
  BookOpen,
  Bell,
  BarChart3,
  Building2,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  X,
  Check,
  MessageCircle,
  Download,
  LogOut,
  Menu,
  Archive,
  CheckCircle2,
  Filter,
  Pencil,
  Loader2,
  RefreshCw,
  Upload,
  Cake,
  QrCode,
} from "lucide-react";
import { SalesDashboard } from "@/components/sales-dashboard";
import { ClassWelcome } from "@/components/class-welcome";
import { ClassQrEditor } from "@/components/class-qr-editor";
import {
  validGroupLink,
  canEditStudent,
  enrollmentStage,
  needsAbsenceOutreach,
} from "@/lib/sales";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { StudentImporter } from "@/components/student-importer";
import { birthdaysThisWeek } from "@/lib/birthdays";
import { OperationsBoard } from "@/components/operations-board";
import { FollowUpCenter } from "@/components/follow-up-center";
import { StudentDossier } from "@/components/student-dossier";
import { PedagogyFields } from "@/components/pedagogy-fields";
import { PedagogyAgenda } from "@/components/pedagogy-agenda";
import {
  pendingPedagogy,
  pedagogicalReportLines,
  outcomeLabels,
} from "@/lib/pedagogy";
import { RecordManager } from "@/components/record-manager";
import { operationalStore, type RecordTable } from "@/lib/records";
import { TeamManager } from "@/components/team-manager";
import { PasswordChange } from "@/components/password-change";
import { DailyAnalysis } from "@/components/daily-analysis";
import { StudentAvatar } from "@/components/student-avatar";
import { StudentPhotoEditor } from "@/components/student-photo-editor";
import {
  clearPhotoCache,
  photoForReport,
  type CompressedPhoto,
  type ReportPhoto,
} from "@/lib/photos";
import { supabase } from "@/lib/supabase";
import {
  type Store,
  type Profile,
  type Student,
  type CourseClass,
  type Lesson,
  type AttendanceStatus,
  type Pedagogy,
  type Contact,
  type Unit,
  type Offering,
  type Role,
  labels,
  today,
  displayDate,
  absenceCount,
  frequency,
  attendanceMessage,
  attendanceReportLines,
  frequencyReportLines,
  evolutionMessage,
  comparePedagogy,
  whatsappUrl,
  validateStudent,
  studentDisplayName,
} from "@/lib/domain";
const nav = [
  ["overview", "Operação", LayoutDashboard],
  ["students", "Alunos", Users],
  ["classes", "Turmas", GraduationCap],
  ["offerings", "Cursos e pacotes", BookOpen],
  ["attendance", "Chamada", ClipboardCheck],
  ["pedagogy", "Pedagógico", BookOpen],
  ["alerts", "Central de atenção", Bell],
  ["reports", "Relatórios", BarChart3],
  ["units", "Unidades", Building2],
  ["settings", "Equipe e acesso", Settings],
  ["records", "Gestão de registros", Archive],
] as const;
const tables: (keyof Store)[] = [
  "units",
  "profiles",
  "offerings",
  "classes",
  "students",
  "lessons",
  "attendance",
  "pedagogy",
  "contacts",
];
type Modal = {
  kind: string;
  data?: Student | CourseClass | Offering;
  parentRecord?: Pedagogy;
  classPreset?: string;
} | null;
function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
}
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <BookOpen size={28} />
      <p>{text}</p>
    </div>
  );
}
export default function App() {
  const [allRecords, setStore] = useState<Store | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [page, setPage] = useState("overview"),
    [unit, setUnit] = useState("all"),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState<Modal>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [message, setMessage] = useState<{
      text: string;
      phone: string;
      title: string;
    } | null>(null),
    [login, setLogin] = useState({ username: "", password: "" }),
    [sessionReady, setSessionReady] = useState(false);
  const store = useMemo(
    () => (allRecords ? operationalStore(allRecords) : null),
    [allRecords],
  );
  const [managementTable, setManagementTable] =
    useState<RecordTable>("students");
  const [calendarDay, setCalendarDay] = useState(today());
  useEffect(() => {
    const tick = () => setCalendarDay(today());
    const timer = setInterval(tick, 60000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  const [welcome, setWelcome] = useState<{
    course: CourseClass;
    student?: Student;
  } | null>(null);
  const [qrDraft, setQrDraft] = useState<Blob | null>(null),
    [removeQr, setRemoveQr] = useState(false),
    [qrBusy, setQrBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [reportClass, setReportClass] = useState("all");
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [studentStatus, setStudentStatus] = useState("all"),
    [studentClass, setStudentClass] = useState("all");
  const [classId, setClassId] = useState(""),
    [lessonDate, setLessonDate] = useState(today()),
    [topic, setTopic] = useState(""),
    [marks, setMarks] = useState<Record<string, AttendanceStatus>>({}),
    [attendanceDetails, setAttendanceDetails] = useState<
      Record<string, { arrival_time: string; justification: string }>
    >({}),
    [reportFrom, setReportFrom] = useState(""),
    [reportTo, setReportTo] = useState(today());
  const [photoDraft, setPhotoDraft] = useState<CompressedPhoto | null>(null),
    [removePhoto, setRemovePhoto] = useState(false),
    [photoBusy, setPhotoBusy] = useState(false);
  useEffect(() => {
    setQrDraft(null);
    setRemoveQr(false);
    setQrBusy(false);
    setPhotoDraft(null);
    setRemovePhoto(false);
    setPhotoBusy(false);
  }, [modal]);
  async function load() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        setStore(null);
        return;
      }
      const { data: p, error: e } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (e)
        throw new Error(
          "Seu usuário ainda não possui perfil de acesso. Solicite o vínculo à coordenação.",
        );
      if (p.active === false || p.archived_at)
        throw new Error("Seu acesso está desativado. Procure a administração.");
      if (p.must_change_password) {
        setProfile(p);
        setStore(null);
        return;
      }
      const next = {} as Store;
      for (const table of tables) {
        const collected: unknown[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error: err } = await supabase
            .from(table)
            .select("*")
            .order("id")
            .range(offset, offset + 999);
          if (err) throw new Error(`${table}: ${err.message}`);
          collected.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        (next[table] as unknown[]) = collected;
      }
      setStore(next);
      setProfile(p);
      setUnit(isManager(p.role) ? "all" : p.unit_id);
    } catch (e) {
      setProfile(null);
      setStore(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setSessionReady(true);
    }
  }
  useEffect(() => {
    if (!supabase) {
      setError("O acesso ainda não foi configurado. Procure a administração.");
      setSessionReady(true);
      return;
    }
    void load();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      clearPhotoCache();
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setStore(null);
        setPage("overview");
        return;
      }
      setTimeout(() => void load(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (
      !supabase ||
      !profile ||
      profile.must_change_password ||
      profile.role === "professor" ||
      !["overview", "students", "classes", "alerts"].includes(page) ||
      modal ||
      importOpen ||
      welcome ||
      message
    )
      return;
    let active = true,
      inFlight = false;
    const client = supabase;
    async function refreshQueues() {
      if (!active || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const updates: Partial<Store> = {};
        for (const table of [
          "students",
          "classes",
          "contacts",
          "lessons",
          "attendance",
        ] as const) {
          const rows: unknown[] = [];
          for (let offset = 0; ; offset += 1000) {
            const result = await client
              .from(table)
              .select("*")
              .order("id")
              .range(offset, offset + 999);
            if (result.error) return;
            rows.push(...result.data);
            if (result.data.length < 1000) break;
          }
          (updates[table] as unknown[]) = rows;
        }
        if (active)
          setStore((previous) =>
            previous ? { ...previous, ...updates } : previous,
          );
      } finally {
        inFlight = false;
      }
    }
    const refresh = () => {
      void refreshQueues().catch(() => {});
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [
    profile?.id,
    profile?.role,
    profile?.must_change_password,
    page,
    modal,
    importOpen,
    welcome,
    message,
  ]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const scoped = (id: string) =>
    profile && isManager(profile.role)
      ? unit === "all" || id === unit
      : id === profile?.unit_id;
  const students = store?.students.filter((s) => scoped(s.unit_id)) || [],
    classes = store?.classes.filter((c) => scoped(c.unit_id)) || [],
    active = students.filter((s) => s.status === "ativo"),
    alerts = active.filter((s) => needsAbsenceOutreach(store!, s)),
    filtered = students.filter(
      (s) =>
        `${studentDisplayName(s)} ${s.guardian}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (studentStatus === "all" || s.status === studentStatus) &&
        (studentClass === "all" || s.class_id === studentClass),
    );
  const writableClasses = classes.filter(
    (c) => profile?.role !== "professor" || c.teacher_id === profile.id,
  );
  const selectedClass =
    writableClasses.find((c) => c.id === classId) || writableClasses[0];
  const selectedLesson = store?.lessons.find(
    (l) => l.class_id === selectedClass?.id && l.date === lessonDate,
  );
  const attendanceDirty = Boolean(
    selectedLesson &&
    (topic.trim() !== selectedLesson.topic ||
      active
        .filter((s) => s.class_id === selectedClass?.id)
        .some(
          (s) =>
            marks[s.id] !==
              store?.attendance.find(
                (a) =>
                  a.lesson_id === selectedLesson.id && a.student_id === s.id,
              )?.status ||
            (attendanceDetails[s.id]?.arrival_time || "") !==
              (store?.attendance.find(
                (a) =>
                  a.lesson_id === selectedLesson.id && a.student_id === s.id,
              )?.arrival_time || "") ||
            (attendanceDetails[s.id]?.justification || "") !==
              (store?.attendance.find(
                (a) =>
                  a.lesson_id === selectedLesson.id && a.student_id === s.id,
              )?.justification || ""),
        )),
  );
  useEffect(() => {
    if (!store || !selectedClass) return;
    const l = store.lessons.find(
      (l) => l.class_id === selectedClass.id && l.date === lessonDate,
    );
    setTopic(l?.topic || "");
    const next: Record<string, AttendanceStatus> = {};
    store.attendance
      .filter((a) => a.lesson_id === l?.id)
      .forEach((a) => (next[a.student_id] = a.status));
    setMarks(next);
    setAttendanceDetails(
      Object.fromEntries(
        store.attendance
          .filter((a) => a.lesson_id === l?.id)
          .map((a) => [
            a.student_id,
            {
              arrival_time: a.arrival_time || "",
              justification: a.justification || "",
            },
          ]),
      ),
    );
  }, [selectedClass?.id, lessonDate, store?.lessons, store?.attendance]);
  async function save<K extends keyof Store>(
    table: K,
    record: Store[K][number],
  ) {
    setBusy(true);
    setError("");
    try {
      if (!supabase) throw new Error("Acesso não configurado.");
      let persisted = record;
      {
        const { data, error } = await (table === "pedagogy"
          ? supabase.rpc("save_pedagogical_record", { record_data: record })
          : table === "contacts"
            ? supabase.from(table).insert(record)
            : supabase.from(table).upsert(record));
        if (error)
          throw new Error(
            error.code === "23505"
              ? "Este acompanhamento já foi registrado. Atualize os dados para consultar a evolução."
              : error.message,
          );
        if (table === "pedagogy" && data) persisted = data as Store[K][number];
      }
      setStore((prev) =>
        prev
          ? {
              ...prev,
              [table]: [
                ...prev[table].filter((r) => r.id !== persisted.id),
                persisted,
              ],
            }
          : prev,
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function notify(text: string) {
    setNotice(text);
  }
  function goto(key: string) {
    setPage(key);
    setQuery("");
    setMobile(false);
  }
  async function loginSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!supabase) throw new Error("Acesso não configurado.");
      const email = loginAddress(login.username);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: login.password,
      });
      if (error)
        throw new Error(
          "Não foi possível entrar. Confira o nome de usuário e a senha.",
        );
      setLogin((current) => ({ ...current, password: "" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function pdf(title: string, lines: string[]) {
    try {
      const { createInstitutionalPdf } = await import("@/lib/pdf");
      const scopeUnit =
        profile && isManager(profile.role) ? unit : profile?.unit_id;
      const photos: ReportPhoto[] = [];
      const reportStudents = [
        "Frequência e faltas",
        "Acompanhamento pedagógico",
        "Resumo da aula",
        "Ficha do aluno",
        "Evolução do aluno",
        "Evolução pedagógica",
      ].includes(title)
        ? (allRecords?.students || students).filter(
            (s) =>
              scoped(s.unit_id) &&
              s.photo_path &&
              lines.some((line) => line.includes(studentDisplayName(s))),
          )
        : [];
      for (let i = 0; i < reportStudents.length; i += 4) {
        const batch = await Promise.all(
          reportStudents.slice(i, i + 4).map(photoForReport),
        );
        photos.push(...batch.filter((p): p is ReportPhoto => Boolean(p)));
      }
      const doc = await createInstitutionalPdf({
        photos,
        featuredStudent:
          title === "Ficha do aluno" ? reportStudents[0] : undefined,
        title,
        lines,
        unit:
          scopeUnit === "all"
            ? "Todas as unidades"
            : store?.units.find((u) => u.id === scopeUnit)?.name ||
              "Wisdom Cursos",
        author: profile?.name || "Equipe Wisdom",
      });
      doc.save(
        `wisdom-${title
          .toLocaleLowerCase("pt-BR")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "-")}.pdf`,
      );
      notify("Relatório PDF gerado com sucesso.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveImportedStudents(records: Student[]) {
    if (!profile || !store || !records.length || records.length > 500)
      return false;
    if (
      records.some(
        (s) => !isManager(profile.role) && s.unit_id !== profile.unit_id,
      )
    )
      return false;
    setBusy(true);
    try {
      let saved = records;
      if (!supabase) return false;
      {
        const { data, error } = await supabase
          .from("students")
          .insert(records)
          .select("*");
        if (error) throw error;
        saved = data as Student[];
      }
      setStore((previous) =>
        previous
          ? { ...previous, students: [...previous.students, ...saved] }
          : previous,
      );
      notify(
        `${saved.length} alunos importados. Complete os cadastros na secretaria.`,
      );
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveAttendance(e: FormEvent) {
    e.preventDefault();
    if (!selectedClass || !profile || !store) return;
    const list = active.filter((s) => s.class_id === selectedClass.id);
    if (!list.length) {
      setError("Esta turma não possui alunos ativos.");
      return;
    }
    if (!topic.trim()) {
      setError("Informe o conteúdo da aula.");
      return;
    }
    if (list.some((s) => !marks[s.id])) {
      setError("Registre a situação de todos os alunos antes de finalizar.");
      return;
    }
    const lesson: Lesson = {
      id: selectedLesson?.id || crypto.randomUUID(),
      unit_id: selectedClass.unit_id,
      class_id: selectedClass.id,
      teacher_id: profile.id,
      teacher: profile.name,
      date: lessonDate,
      topic: topic.trim(),
      closed: true,
    };
    const rows = list.map((s) => ({
      id:
        store.attendance.find(
          (a) => a.lesson_id === lesson.id && a.student_id === s.id,
        )?.id || crypto.randomUUID(),
      unit_id: selectedClass.unit_id,
      lesson_id: lesson.id,
      student_id: s.id,
      status: marks[s.id],
      arrival_time:
        marks[s.id] === "atrasado"
          ? attendanceDetails[s.id]?.arrival_time || ""
          : "",
      justification:
        marks[s.id] === "justificado"
          ? attendanceDetails[s.id]?.justification.trim() || ""
          : "",
    }));
    setBusy(true);
    setError("");
    try {
      if (!supabase) throw new Error("Acesso não configurado.");
      {
        const { error } = await supabase.rpc("save_lesson_attendance", {
          lesson_data: lesson,
          attendance_data: rows,
        });
        if (error) throw error;
      }
      const next = {
        ...store,
        lessons: [...store.lessons.filter((l) => l.id !== lesson.id), lesson],
        attendance: [
          ...store.attendance.filter((a) => !rows.some((r) => r.id === a.id)),
          ...rows,
        ],
      };
      setStore(next);
      setMessage({
        title: "Resumo da aula",
        text: attendanceMessage(next, lesson),
        phone: "",
      });
      notify("Chamada finalizada e resumo preparado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submitModal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!store || !profile || !modal) return;
    const fd = new FormData(e.currentTarget);
    const v = (key: string) => String(fd.get(key) || "").trim();
    const id = modal.data?.id || crypto.randomUUID();
    let ok = false;
    if (modal.kind === "student") {
      const c = store.classes.find((c) => c.id === v("class_id"));
      const previous = modal.data as Student | undefined;
      const offering = store.offerings.find((o) => o.id === v("offering_id"));
      const record: Student = {
        id,
        unit_id:
          c?.unit_id ||
          offering?.unit_id ||
          previous?.unit_id ||
          (unit !== "all" ? unit : profile.unit_id),
        photo_path: previous?.photo_path || null,
        class_id: v("class_id") || null,
        offering_id: v("offering_id") || null,
        name: v("name"),
        birth_date: fd.has("birth_date")
          ? v("birth_date")
          : previous?.birth_date || "",
        phone: v("phone"),
        guardian: v("guardian"),
        guardian_phone: v("guardian_phone"),
        email: fd.has("email") ? v("email") : previous?.email || "",
        address: fd.has("address") ? v("address") : previous?.address || "",
        created_by: previous?.created_by || profile.id,
        enrollment_date: previous?.enrollment_date || today(),
        status: previous?.status || "ativo",
        archive_reason: previous?.archive_reason || "",
        registration_stage:
          profile.role === "comercial"
            ? "pre_enrollment"
            : fd.get("complete_registration") === "on"
              ? "complete"
              : previous?.registration_stage || "complete",
        completed_by: previous?.completed_by || null,
        completed_at: previous?.completed_at || null,
      };
      const invalid = validateStudent(record);
      if (invalid) {
        setError(invalid);
        return;
      }
      if (!c && v("class_id")) {
        setError("Turma não encontrada.");
        return;
      }
      if (
        record.offering_id &&
        !store.offerings.some(
          (o) => o.id === record.offering_id && o.unit_id === record.unit_id,
        )
      ) {
        setError("O curso ou pacote deve pertencer à unidade da turma.");
        return;
      }
      if (record.unit_id !== previous?.unit_id && previous) {
        setError(
          "A transferência entre unidades exige um novo vínculo de matrícula.",
        );
        return;
      }
      if (
        c &&
        record.status === "ativo" &&
        store.students.filter(
          (s) => s.class_id === c.id && s.status === "ativo" && s.id !== id,
        ).length >= c.capacity
      ) {
        setError("Turma sem vagas. Escolha outra turma.");
        return;
      }
      if (
        profile.role === "comercial" &&
        previous &&
        !canEditStudent(profile, previous)
      ) {
        setError(
          "O comercial pode editar somente suas próprias pré-matrículas pendentes.",
        );
        return;
      }
      if (
        profile.role === "comercial" &&
        c &&
        c.enrollment_open === false &&
        c.id !== previous?.class_id
      ) {
        setError(
          "Esta turma está fechada para matrícula. Escolha outra opção.",
        );
        return;
      }
      ok = await save("students", record);
      if (ok && supabase && (photoDraft || removePhoto)) {
        setBusy(true);
        const oldPath = previous?.photo_path || null;
        let uploadedPath: string | null = null;
        try {
          if (photoDraft) {
            uploadedPath = `${record.unit_id}/${record.id}/${crypto.randomUUID()}.${photoDraft.extension}`;
            const upload = await supabase.storage
              .from("student-photos")
              .upload(uploadedPath, photoDraft.blob, {
                contentType: photoDraft.blob.type,
                upsert: false,
                cacheControl: "3600",
              });
            if (upload.error) throw upload.error;
          }
          const change = await supabase
            .from("students")
            .update({ photo_path: uploadedPath })
            .eq("id", record.id);
          if (change.error) throw change.error;
          setStore((prev) =>
            prev
              ? {
                  ...prev,
                  students: prev.students.map((st) =>
                    st.id === record.id
                      ? { ...st, photo_path: uploadedPath }
                      : st,
                  ),
                }
              : prev,
          );
          clearPhotoCache();
          if (oldPath)
            await supabase.storage.from("student-photos").remove([oldPath]);
        } catch {
          if (uploadedPath)
            await supabase.storage
              .from("student-photos")
              .remove([uploadedPath]);
          setModal(null);
          setError(
            "A matrícula foi salva, mas a foto não pôde ser atualizada. Abra a edição do aluno para tentar novamente.",
          );
          return;
        } finally {
          setBusy(false);
        }
      }
      if (ok && profile.role === "comercial" && c)
        setWelcome({ course: c, student: record });
    }
    if (modal.kind === "class") {
      const p = store.profiles.find((p) => p.id === v("teacher_id"));
      const targetUnit = v("unit_id");
      if (!p || p.unit_id !== targetUnit) {
        setError("Selecione um professor da mesma unidade.");
        return;
      }
      const capacity = Number(v("capacity"));
      if (
        store.students.filter((s) => s.class_id === id && s.status === "ativo")
          .length > capacity
      ) {
        setError(
          "A capacidade não pode ser menor que o número de alunos ativos.",
        );
        return;
      }
      if (!validGroupLink(v("whatsapp"))) {
        setError(
          "Informe um link HTTPS de convite do grupo em chat.whatsapp.com.",
        );
        return;
      }
      const groupLink = v("whatsapp") ? new URL(v("whatsapp")).href : "";
      const previousClass = modal.data as CourseClass | undefined;
      const oldQr = previousClass?.whatsapp_qr_path || null;
      const qrChanged = Boolean(
        qrDraft || removeQr || previousClass?.whatsapp !== groupLink,
      );
      ok = await save("classes", {
        id,
        unit_id: targetUnit,
        name: v("name"),
        course: v("course"),
        teacher_id: p.id,
        teacher: p.name,
        schedule: v("schedule"),
        capacity,
        whatsapp: groupLink,
        enrollment_open: fd.get("enrollment_open") === "on",
        enrollment_priority: Number(v("enrollment_priority")) || 3,
        whatsapp_qr_path: qrChanged ? null : oldQr,
      });
      if (ok && qrChanged && supabase) {
        let uploaded: string | null = null;
        setBusy(true);
        try {
          if (qrDraft) {
            uploaded = `${targetUnit}/${id}/${crypto.randomUUID()}.png`;
            const upload = await supabase.storage
              .from("class-qr-codes")
              .upload(uploaded, qrDraft, {
                contentType: "image/png",
                upsert: false,
              });
            if (upload.error) throw upload.error;
            const pointer = await supabase
              .from("classes")
              .update({ whatsapp_qr_path: uploaded })
              .eq("id", id);
            if (pointer.error) throw pointer.error;
          }
          setStore((prev) =>
            prev
              ? {
                  ...prev,
                  classes: prev.classes.map((c) =>
                    c.id === id ? { ...c, whatsapp_qr_path: uploaded } : c,
                  ),
                }
              : prev,
          );
          if (oldQr)
            await supabase.storage.from("class-qr-codes").remove([oldQr]);
        } catch {
          if (uploaded)
            await supabase.storage.from("class-qr-codes").remove([uploaded]);
          setModal(null);
          setError(
            "A turma foi salva, mas a imagem do QR code não foi atualizada. O link permite gerar o QR automaticamente.",
          );
          return;
        } finally {
          setBusy(false);
        }
      }
    }
    if (modal.kind === "offering") {
      ok = await save("offerings", {
        id,
        unit_id: v("unit_id"),
        name: v("name"),
        kind: v("kind") as Offering["kind"],
        duration_months: Number(v("duration_months")),
        courses: v("courses"),
      });
    }
    if (modal.kind === "unit")
      ok = await save("units", {
        id,
        name: v("name"),
        address: v("address"),
      } as Unit);
    if (modal.kind === "archive") {
      const previous = modal.data as Student;
      ok = await save("students", {
        ...previous,
        status: v("status") as Student["status"],
        archive_reason: v("archive_reason"),
      });
    }
    if (modal.kind === "pedagogy") {
      const c = store.classes.find((c) => c.id === v("class_id"));
      if (!c) return;
      const st = store.students.find((s) => s.id === v("student_id"));
      if (st && st.class_id !== c.id && !modal.parentRecord) {
        setError("O aluno deve pertencer à turma selecionada.");
        return;
      }
      ok = await save("pedagogy", {
        id,
        unit_id: c.unit_id,
        class_id: c.id,
        student_id: v("student_id") || null,
        author_id: profile.id,
        date: today(),
        kind: v("kind"),
        skill: v("skill"),
        level: Number(v("level")),
        notes: v("notes"),
        intervention: v("intervention"),
        follow_up: v("follow_up"),
        parent_record_id: v("parent_record_id") || null,
        support_plan: JSON.parse(v("support_plan") || "{}"),
      } as Pedagogy);
    }
    if (modal.kind === "contact") {
      const st = modal.data as Student;
      ok = await save("contacts", {
        id: crypto.randomUUID(),
        unit_id: st.unit_id,
        student_id: st.id,
        author_id: profile.id,
        date: today(),
        reason: v("reason"),
        outcome: v("outcome"),
        next_contact: v("next_contact"),
      } as Contact);
    }
    if (ok) {
      setModal(null);
      notify("Registro salvo com sucesso.");
    }
  }
  if (!sessionReady)
    return (
      <div className="loading">
        <Loader2 className="spin" /> Preparando seu espaço…
      </div>
    );
  if (profile?.must_change_password)
    return (
      <main className="password-required">
        <img src="/wisdom-logo.svg" alt="Wisdom Cursos" />
        <PasswordChange
          required
          onDone={() => {
            setProfile(null);
            setStore(null);
            setNotice("Senha alterada. Entre novamente com sua senha pessoal.");
          }}
        />
      </main>
    );
  if (!profile || !store)
    return (
      <main className="login">
        <div className="login-brand">
          <img
            src="/wisdom-logo.svg"
            alt="Wisdom Cursos"
            className="brand-symbol"
          />
          <h1>
            Wisdom Cursos.
            <br />
            Controle acadêmico.
          </h1>
          <p>
            Matrículas, diário de classe e acompanhamento dos alunos da sua
            unidade.
          </p>
          <span>WISDOM / GESTÃO EDUCACIONAL</span>
        </div>
        <form onSubmit={loginSubmit} className="login-form">
          <span className="eyebrow">BEM-VINDO À WISDOM</span>
          <h2>Entre no seu espaço</h2>
          <p>Use o acesso fornecido pela sua coordenação.</p>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <label>
            Nome de usuário
            <input
              type="text"
              autoComplete="username"
              required
              value={login.username}
              onChange={(e) => setLogin({ ...login, username: e.target.value })}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              minLength={6}
              required
              value={login.password}
              onChange={(e) => setLogin({ ...login, password: e.target.value })}
            />
          </label>
          <button className="primary" disabled={busy || !supabase}>
            {busy ? "Entrando…" : "Entrar"}
            <ArrowRight size={17} />
          </button>
          <small>
            Para recuperar seu acesso, procure a coordenação da sua unidade.
          </small>
        </form>
      </main>
    );
  const currentNav = nav.find((n) => n[0] === page)!;
  const scopedStore = {
    ...store,
    attendance: store.attendance.filter((a) => scoped(a.unit_id)),
  };
  const overallFrequency = frequency(scopedStore);
  const className = (id: string | null) =>
    allRecords?.classes.find((c) => c.id === id)?.name || "Sem turma";
  const studentName = (id: string | null) => {
    if (!id) return "Toda a turma";
    const student = allRecords?.students.find((s) => s.id === id);
    return student ? studentDisplayName(student) : "Aluno";
  };
  const currentUnit = isManager(profile.role) ? unit : profile.unit_id;
  const unitOptions = store.units.filter(
    (u) => isManager(profile.role) || u.id === profile.unit_id,
  );
  const interventionDueCount = pendingPedagogy(
    store,
    profile,
    currentUnit,
    calendarDay,
  ).filter((item) => item.state !== "upcoming").length;
  const attentionCount =
    alerts.length +
    interventionDueCount +
    (profile.role !== "comercial"
      ? students.filter(
          (s) => s.status === "ativo" && enrollmentStage(s) !== "complete",
        ).length
      : 0);
  const reportSource = allRecords!;
  const reportLessons = reportSource.lessons.filter(
    (l) =>
      scoped(l.unit_id) &&
      (!reportFrom || l.date >= reportFrom) &&
      l.date <= reportTo &&
      (reportClass === "all" || l.class_id === reportClass),
  );
  return (
    <div className="app-shell">
      <header className="institutional-header">
        <a
          className="institutional-brand"
          aria-label="Wisdom Cursos — início"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            goto("overview");
          }}
        >
          <img src="/wisdom-logo.svg" alt="" />
          <div>
            <strong>
              WISDOM<span>CURSOS</span>
            </strong>
            <small>CONTROLE ACADÊMICO</small>
          </div>
        </a>
        <div className="header-greeting">
          <strong>{profile.name.split(" ")[0]}</strong>
          <span>
            {labels[profile.role]}
            {!isManager(profile.role) && (
              <> • {store.units.find((u) => u.id === profile.unit_id)?.name}</>
            )}
          </span>
        </div>
        <form
          className="global-search"
          onSubmit={(e) => {
            e.preventDefault();
            goto("students");
            setQuery(globalSearch);
          }}
        >
          <input
            aria-label="Buscar alunos no sistema"
            placeholder="Pesquisar no sistema…"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
          <button type="submit" aria-label="Buscar alunos">
            <Search size={17} />
          </button>
        </form>
        <div className="institutional-tools">
          <span className="system-label">ÁREA DA EQUIPE</span>
          {supabase && (
            <button
              className="icon-button"
              title="Atualizar dados"
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw size={18} />
            </button>
          )}
          <button
            className="birthday-alert-button"
            title="Aniversariantes de hoje e da semana"
            onClick={() => {
              goto("overview");
              requestAnimationFrame(() =>
                document
                  .getElementById("birthdays")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" }),
              );
            }}
          >
            <Cake size={19} />
            <b>{birthdaysThisWeek(students).filter((b) => b.isToday).length}</b>
          </button>
          <button
            className="header-notification"
            title="Central de atenção"
            onClick={() => goto("alerts")}
          >
            <Bell size={19} />
            {attentionCount > 0 && <b>{attentionCount}</b>}
          </button>
          <div className="header-user">
            <span>
              {profile.name}
              <small>{labels[profile.role]}</small>
            </span>
            <div className="avatar">{initials(profile.name)}</div>
          </div>
          {supabase && (
            <button
              className="icon-button"
              title="Sair"
              onClick={() => supabase!.auth.signOut()}
            >
              <LogOut size={18} />
            </button>
          )}
          <button
            className="mobile-menu icon-button"
            aria-label={mobile ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={22} />
          </button>
        </div>
      </header>
      <nav
        className={`module-navigation ${mobile ? "open" : ""}`}
        aria-label="Módulos do sistema"
      >
        {nav
          .filter(
            (n) =>
              (n[0] !== "units" || isManager(profile.role)) &&
              (n[0] !== "records" || profile.role === "admin") &&
              (profile.role !== "comercial" ||
                [
                  "overview",
                  "students",
                  "classes",
                  "offerings",
                  "alerts",
                  "settings",
                ].includes(n[0])),
          )
          .map(([key, label, Icon], index) => (
            <button
              key={key}
              title={label}
              aria-label={label}
              className={page === key ? "active" : ""}
              onClick={() => goto(key)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {key === "alerts" && attentionCount > 0 && (
                <b>{attentionCount}</b>
              )}
            </button>
          ))}
      </nav>
      <div className="main-shell">
        <main className="content">
          <div className="page-heading">
            <div>
              <h1>
                {page === "overview"
                  ? profile.role === "comercial"
                    ? "Minha mesa comercial"
                    : profile.role === "professor"
                      ? "Meu diário de classe"
                      : profile.role === "secretaria"
                        ? "Mesa da secretaria"
                        : "Operação das unidades"
                  : currentNav[1]}
              </h1>
            </div>
            <div className="heading-actions">
              {profile.role === "admin" &&
                [
                  "students",
                  "classes",
                  "offerings",
                  "units",
                  "settings",
                ].includes(page) && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setManagementTable(
                        page === "settings"
                          ? "profiles"
                          : (page as RecordTable),
                      );
                      goto("records");
                    }}
                  >
                    <Archive size={16} /> Gerenciar registros
                  </button>
                )}
              {page === "students" && profile.role !== "comercial" && (
                <button
                  className="secondary"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload size={16} /> Importar Excel
                </button>
              )}
              {isManager(profile.role) && (
                <label className="unit-picker">
                  <Building2 size={16} />
                  <select
                    aria-label="Filtrar unidade"
                    value={currentUnit}
                    disabled={!isManager(profile.role)}
                    onChange={(e) => {
                      setUnit(e.target.value);
                      setStudentClass("all");
                      setReportClass("all");
                      setDossierId(null);
                    }}
                  >
                    {isManager(profile.role) && (
                      <option value="all">Todas as unidades</option>
                    )}
                    {unitOptions.map((u) => (
                      <option value={u.id} key={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!["attendance", "reports", "settings", "records"].includes(
                page,
              ) &&
                !(page === "pedagogy" && profile.role === "secretaria") &&
                !(
                  profile.role === "comercial" &&
                  ["classes", "offerings", "settings"].includes(page)
                ) && (
                  <button
                    className="primary"
                    onClick={() =>
                      setModal({
                        kind:
                          page === "classes"
                            ? profile.role === "professor"
                              ? "student"
                              : "class"
                            : page === "units"
                              ? "unit"
                              : page === "offerings" &&
                                  profile.role !== "professor" &&
                                  profile.role !== "comercial"
                                ? "offering"
                                : page === "pedagogy"
                                  ? "pedagogy"
                                  : "student",
                      })
                    }
                  >
                    <Plus size={17} />
                    {page === "classes" &&
                    profile.role !== "professor" &&
                    profile.role !== "comercial"
                      ? "Nova turma"
                      : page === "units"
                        ? "Nova unidade"
                        : page === "offerings" &&
                            profile.role !== "professor" &&
                            profile.role !== "comercial"
                          ? "Novo curso ou pacote"
                          : page === "pedagogy"
                            ? "Novo registro"
                            : profile.role === "comercial"
                              ? "Nova pré-matrícula"
                              : "Nova matrícula"}
                  </button>
                )}
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Fechar erro" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {page === "overview" && profile.role === "comercial" && (
            <SalesDashboard
              store={store}
              profile={profile}
              onEnroll={(course) =>
                setModal({ kind: "student", classPreset: course?.id })
              }
              onGroup={(course) => setWelcome({ course })}
              onStudent={(student) => setDossierId(student.id)}
              onContact={(student) =>
                setModal({ kind: "contact", data: student })
              }
            />
          )}
          {page === "overview" && profile.role !== "comercial" && (
            <OperationsBoard
              store={store}
              profile={profile}
              unit={currentUnit}
              classes={classes}
              onClass={(id, date) => {
                setClassId(id);
                if (date) setLessonDate(date);
                if (profile.role === "secretaria") {
                  setReportClass(id);
                  setReportFrom(date || "");
                  setReportTo(date || today());
                }
                goto(profile.role === "secretaria" ? "reports" : "attendance");
              }}
              onStudent={(s) => setDossierId(s.id)}
              onAction={(kind, data) => {
                if (kind.startsWith("followup:")) {
                  const record = store.pedagogy.find(
                    (p) => p.id === kind.slice(9),
                  );
                  if (record)
                    setModal({ kind: "pedagogy", parentRecord: record });
                } else setModal({ kind, data });
              }}
              onPage={goto}
              onMessage={(lesson) =>
                setMessage({
                  title: "Resumo da aula",
                  text: attendanceMessage(allRecords!, lesson),
                  phone: "",
                })
              }
            />
          )}
          {page === "students" && (
            <section className="panel">
              <div className="list-toolbar">
                <div className="registry-label">
                  <span className="index-label">CADASTRO DE ALUNOS</span>
                  <strong>
                    {filtered.length} encontrados{" "}
                    <small>/ {students.length} matrículas</small>
                  </strong>
                </div>
                <div className="student-filters">
                  <select
                    aria-label="Filtrar situação da matrícula"
                    value={studentStatus}
                    onChange={(e) => setStudentStatus(e.target.value)}
                  >
                    <option value="all">Todas as situações</option>
                    {[
                      "ativo",
                      "conclusao",
                      "cancelamento",
                      "abandono",
                      "inadimplencia",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {labels[status]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar turma dos alunos"
                    value={studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                  >
                    <option value="all">Todas as turmas</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder="Buscar aluno ou responsável…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ALUNO</th>
                      <th>TURMA</th>
                      <th>RESPONSÁVEL</th>
                      <th>FREQUÊNCIA</th>
                      <th>STATUS</th>
                      <th>AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="person">
                            <StudentAvatar student={s} />
                            <div>
                              <button
                                className="student-link"
                                onClick={() => setDossierId(s.id)}
                              >
                                {studentDisplayName(s)}
                              </button>
                              <small>
                                Desde {displayDate(s.enrollment_date)}
                              </small>
                              {s.offering_id && (
                                <span className="package-label">
                                  {
                                    store.offerings.find(
                                      (o) => o.id === s.offering_id,
                                    )?.name
                                  }
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{className(s.class_id)}</td>
                        <td>
                          {s.guardian || "Não informado"}
                          <small>{s.guardian_phone || "Sem telefone"}</small>
                        </td>
                        <td>
                          {frequency(store, s.id) === null
                            ? "—"
                            : frequency(store, s.id) + "%"}
                        </td>
                        <td>
                          <Badge
                            tone={s.status === "ativo" ? "green" : "neutral"}
                          >
                            {labels[s.status]}
                          </Badge>
                          {enrollmentStage(s) !== "complete" && (
                            <Badge tone="amber">
                              {labels[enrollmentStage(s)]}
                            </Badge>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              title="Editar matrícula"
                              disabled={!canEditStudent(profile, s)}
                              onClick={() =>
                                setModal({ kind: "student", data: s })
                              }
                            >
                              <Pencil size={16} />
                            </button>
                            {s.class_id && (
                              <button
                                title="Grupo da turma"
                                onClick={() => {
                                  const course = store.classes.find(
                                    (c) => c.id === s.class_id,
                                  );
                                  if (course)
                                    setWelcome({ course, student: s });
                                }}
                              >
                                <QrCode size={17} />
                              </button>
                            )}
                            {profile.role !== "comercial" && (
                              <button
                                title="Evolução para responsável"
                                onClick={() =>
                                  setMessage({
                                    title: "Evolução do aluno",
                                    text: evolutionMessage(store, s),
                                    phone: s.guardian_phone,
                                  })
                                }
                              >
                                <MessageCircle size={17} />
                              </button>
                            )}
                            {profile.role !== "professor" &&
                              profile.role !== "comercial" && (
                                <button
                                  title={
                                    s.status === "ativo"
                                      ? "Arquivar aluno"
                                      : "Reativar matrícula"
                                  }
                                  onClick={async () => {
                                    if (s.status === "ativo")
                                      setModal({ kind: "archive", data: s });
                                    else {
                                      const c = store.classes.find(
                                        (c) => c.id === s.class_id,
                                      );
                                      if (
                                        c &&
                                        active.filter(
                                          (a) => a.class_id === c.id,
                                        ).length >= c.capacity
                                      ) {
                                        setError(
                                          "Turma sem vagas para reativação.",
                                        );
                                        return;
                                      }
                                      if (
                                        await save("students", {
                                          ...s,
                                          status: "ativo",
                                          archive_reason: "",
                                        })
                                      )
                                        notify("Matrícula reativada.");
                                    }
                                  }}
                                >
                                  <Archive size={16} />
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && <Empty text="Nenhum aluno encontrado." />}
            </section>
          )}
          {page === "classes" && (
            <section className="panel class-directory">
              <div className="panel-header">
                <div>
                  <span className="index-label">DISTRIBUIÇÃO DAS TURMAS</span>
                  <h2>{classes.length} turmas cadastradas</h2>
                </div>
                <span className="directory-note">
                  Baixa ocupação: menos de 40% das vagas
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>TURMA / FORMAÇÃO</th>
                      <th>PROFESSOR / UNIDADE</th>
                      <th>DIAS E HORÁRIO</th>
                      <th>OCUPAÇÃO</th>
                      <th>AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => {
                      const count = active.filter(
                        (s) => s.class_id === c.id,
                      ).length;
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.name}</strong>
                            <small>{c.course}</small>
                            <Badge
                              tone={
                                c.enrollment_open !== false
                                  ? "green"
                                  : "neutral"
                              }
                            >
                              {c.enrollment_open !== false
                                ? "Matrículas abertas"
                                : "Matrículas fechadas"}
                            </Badge>{" "}
                            <Badge tone="neutral">
                              {c.enrollment_priority || 3}ª opção
                            </Badge>
                          </td>
                          <td>
                            {c.teacher}
                            <small>
                              {
                                store.units.find((u) => u.id === c.unit_id)
                                  ?.name
                              }
                            </small>
                          </td>
                          <td>{c.schedule}</td>
                          <td>
                            <span className="roster-count">
                              {count}
                              <small> / {c.capacity}</small>
                            </span>
                            <span className="capacity-line">
                              <i
                                style={{
                                  width:
                                    Math.min(100, (count / c.capacity) * 100) +
                                    "%",
                                }}
                              />
                            </span>
                            <small>
                              {count / c.capacity < 0.4
                                ? "Baixa ocupação"
                                : `${c.capacity - count} vagas disponíveis`}
                            </small>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="secondary"
                                onClick={() => setWelcome({ course: c })}
                              >
                                <QrCode size={16} />
                                Grupo
                              </button>
                              <button
                                className="secondary"
                                disabled={
                                  profile.role === "comercial" &&
                                  (c.enrollment_open === false ||
                                    count >= c.capacity)
                                }
                                onClick={() => {
                                  if (profile.role === "comercial") {
                                    setModal({
                                      kind: "student",
                                      classPreset: c.id,
                                    });
                                    return;
                                  }
                                  setClassId(c.id);
                                  goto(
                                    profile.role === "secretaria"
                                      ? "reports"
                                      : "attendance",
                                  );
                                }}
                              >
                                {profile.role === "comercial"
                                  ? "Pré-matricular"
                                  : profile.role === "secretaria"
                                    ? "Ver frequência"
                                    : "Abrir diário"}{" "}
                                <ArrowRight size={15} />
                              </button>
                              {profile.role !== "professor" &&
                                profile.role !== "comercial" && (
                                  <button
                                    className="icon-button"
                                    title="Editar turma"
                                    onClick={() =>
                                      setModal({ kind: "class", data: c })
                                    }
                                  >
                                    <Pencil size={16} />
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!classes.length && (
                <Empty text="Nenhuma turma cadastrada nesta unidade." />
              )}
            </section>
          )}
          {page === "offerings" && (
            <div className="class-grid">
              {store.offerings
                .filter((o) => scoped(o.unit_id))
                .map((o) => (
                  <section className="panel class-card" key={o.id}>
                    <div className="class-card-top">
                      <span className="circle-icon blue">
                        <BookOpen size={23} />
                      </span>
                      <Badge tone={o.kind === "pacote" ? "orange" : "neutral"}>
                        {o.kind === "pacote"
                          ? "Pacote de cursos"
                          : "Curso individual"}
                      </Badge>
                    </div>
                    <h2>{o.name}</h2>
                    <p>
                      {o.duration_months} meses de formação •{" "}
                      {store.units.find((u) => u.id === o.unit_id)?.name}
                    </p>
                    <div className="intervention">
                      <strong>Trilha de aprendizagem</strong>
                      <p>{o.courses}</p>
                    </div>
                    <footer>
                      <small>
                        {
                          students.filter(
                            (s) =>
                              s.offering_id === o.id && s.status === "ativo",
                          ).length
                        }{" "}
                        alunos ativos
                      </small>
                      {profile.role !== "professor" &&
                        profile.role !== "comercial" && (
                          <button
                            className="icon-button"
                            title="Editar formação"
                            onClick={() =>
                              setModal({ kind: "offering", data: o })
                            }
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                    </footer>
                  </section>
                ))}
              {!store.offerings.some((o) => scoped(o.unit_id)) && (
                <Empty text="Cadastre os cursos e pacotes oferecidos pela unidade." />
              )}
            </div>
          )}
          {page === "attendance" && profile.role === "secretaria" && (
            <div className="info-banner">
              <ClipboardCheck size={22} />
              <div>
                <strong>Consulta de frequência</strong>
                <p>
                  Os professores registram as chamadas. Consulte as presenças e
                  resumos em Relatórios.
                </p>
                <button className="text-link" onClick={() => goto("reports")}>
                  Abrir relatórios <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
          {page === "attendance" &&
            profile.role !== "secretaria" &&
            profile.role !== "comercial" && (
              <form onSubmit={saveAttendance}>
                <section className="panel lesson-config">
                  <label>
                    Turma
                    <select
                      aria-label="Turma"
                      value={selectedClass?.id || ""}
                      onChange={(e) => setClassId(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      {writableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Data da aula
                    <input
                      type="date"
                      required
                      max={today()}
                      value={lessonDate}
                      onChange={(e) => setLessonDate(e.target.value)}
                    />
                  </label>
                  <label className="topic">
                    Conteúdo trabalhado
                    <input
                      required
                      placeholder="O que os alunos aprenderam hoje?"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </label>
                </section>
                <div
                  className="attendance-totals"
                  aria-label="Resumo das marcações"
                >
                  {(
                    [
                      "presente",
                      "falta",
                      "atrasado",
                      "justificado",
                    ] as AttendanceStatus[]
                  ).map((status) => (
                    <div key={status} className={status}>
                      <span>{labels[status]}</span>
                      <strong>
                        {
                          Object.values(marks).filter((v) => v === status)
                            .length
                        }
                      </strong>
                    </div>
                  ))}
                  <div>
                    <span>Sem marcação</span>
                    <strong>
                      {
                        active.filter(
                          (s) =>
                            s.class_id === selectedClass?.id && !marks[s.id],
                        ).length
                      }
                    </strong>
                  </div>
                </div>
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Lista de presença</h2>
                      <p>
                        {selectedLesson
                          ? "Chamada registrada • você pode atualizar as marcações"
                          : "Marque a situação de cada aluno para finalizar"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setAttendanceDetails({});
                        setMarks(
                          Object.fromEntries(
                            active
                              .filter((s) => s.class_id === selectedClass?.id)
                              .map((s) => [s.id, "presente"]),
                          ),
                        );
                      }}
                    >
                      <Check size={16} /> Todos presentes
                    </button>
                  </div>
                  {active
                    .filter((s) => s.class_id === selectedClass?.id)
                    .map((s) => (
                      <div className="attendance-row" key={s.id}>
                        <div className="person">
                          <StudentAvatar student={s} />
                          <button
                            className="student-link"
                            type="button"
                            onClick={() => setDossierId(s.id)}
                          >
                            {studentDisplayName(s)}
                          </button>
                        </div>
                        <div className="attendance-options">
                          {(
                            [
                              "presente",
                              "falta",
                              "atrasado",
                              "justificado",
                            ] as AttendanceStatus[]
                          ).map((status) => (
                            <button
                              type="button"
                              key={status}
                              aria-pressed={marks[s.id] === status}
                              className={
                                marks[s.id] === status ? `chosen ${status}` : ""
                              }
                              onClick={() => {
                                setMarks({ ...marks, [s.id]: status });
                                setAttendanceDetails((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    arrival_time:
                                      status === "atrasado"
                                        ? prev[s.id]?.arrival_time || ""
                                        : "",
                                    justification:
                                      status === "justificado"
                                        ? prev[s.id]?.justification || ""
                                        : "",
                                  },
                                }));
                              }}
                            >
                              {marks[s.id] === status && <Check size={14} />}{" "}
                              {labels[status]}
                            </button>
                          ))}
                        </div>
                        {marks[s.id] === "atrasado" && (
                          <label className="attendance-detail">
                            Horário de chegada (opcional)
                            <input
                              type="time"
                              aria-label={`Horário de chegada de ${studentDisplayName(s)}`}
                              value={
                                attendanceDetails[s.id]?.arrival_time || ""
                              }
                              onChange={(e) =>
                                setAttendanceDetails((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    arrival_time: e.target.value,
                                    justification: "",
                                  },
                                }))
                              }
                            />
                          </label>
                        )}
                        {marks[s.id] === "justificado" && (
                          <label className="attendance-detail">
                            Motivo da justificativa (opcional)
                            <textarea
                              maxLength={2000}
                              aria-label={`Justificativa de ${studentDisplayName(s)}`}
                              value={
                                attendanceDetails[s.id]?.justification || ""
                              }
                              onChange={(e) =>
                                setAttendanceDetails((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    arrival_time: "",
                                    justification: e.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  {!active.some((s) => s.class_id === selectedClass?.id) && (
                    <Empty text="Nenhum aluno ativo nesta turma." />
                  )}
                  <div className="form-footer">
                    <span>
                      {Object.keys(marks).length} alunos com situação registrada
                    </span>
                    <div className="attendance-footer-actions">
                      {selectedLesson?.closed && (
                        <button
                          type="button"
                          className="whatsapp-share"
                          disabled={busy || attendanceDirty}
                          title={
                            attendanceDirty
                              ? "Salve as alterações da chamada antes de compartilhar."
                              : "Preparar mensagem para o grupo da turma"
                          }
                          onClick={() =>
                            setMessage({
                              title: "Compartilhar chamada no grupo",
                              text: attendanceMessage(
                                allRecords!,
                                selectedLesson,
                              ),
                              phone: "",
                            })
                          }
                        >
                          <MessageCircle size={17} /> Compartilhar chamada no
                          grupo
                        </button>
                      )}
                      <button
                        className="primary"
                        disabled={busy || !selectedClass}
                      >
                        <CheckCircle2 size={17} />
                        {busy
                          ? "Salvando…"
                          : "Finalizar chamada e gerar resumo"}
                      </button>
                    </div>
                  </div>
                </section>
              </form>
            )}
          {page === "pedagogy" && profile.role !== "comercial" && (
            <>
              <PedagogyAgenda
                store={store}
                profile={profile}
                unit={currentUnit}
                onFollowUp={(record) =>
                  setModal({ kind: "pedagogy", parentRecord: record })
                }
              />
              <div className="records-grid">
                {store.pedagogy
                  .filter((p) => scoped(p.unit_id))
                  .sort(comparePedagogy)
                  .map((p) => (
                    <section className="panel record-card" key={p.id}>
                      <div className="record-top">
                        <Badge
                          tone={p.kind === "Intervenção" ? "orange" : "green"}
                        >
                          {p.kind}
                        </Badge>
                        <small>{displayDate(p.date)}</small>
                      </div>
                      <h2 className="student-heading">
                        {p.student_id &&
                          store.students.find((s) => s.id === p.student_id) && (
                            <StudentAvatar
                              student={store.students.find(
                                (s) => s.id === p.student_id,
                              )!}
                            />
                          )}{" "}
                        {studentName(p.student_id)}
                      </h2>
                      <p>{className(p.class_id)}</p>
                      <div className="skill-level">
                        <span>{p.skill}</span>
                        <span>
                          {Array.from({ length: 5 }, (_, i) => (
                            <i
                              key={i}
                              className={i < p.level ? "filled" : ""}
                            />
                          ))}
                        </span>
                      </div>
                      <p className="record-notes">{p.notes}</p>
                      {p.parent_record_id && (
                        <Badge tone="neutral">
                          Evolução vinculada à intervenção
                        </Badge>
                      )}
                      {p.support_plan?.outcome && (
                        <p>
                          <strong>Resultado:</strong>{" "}
                          {outcomeLabels[p.support_plan.outcome] ||
                            p.support_plan.outcome}
                        </p>
                      )}
                      {p.follow_up &&
                        store.pedagogy.some(
                          (child) => child.parent_record_id === p.id,
                        ) && (
                          <Badge tone="green">Acompanhamento registrado</Badge>
                        )}
                      {p.intervention && (
                        <div className="intervention">
                          <strong>Próximo passo</strong>
                          <p>{p.intervention}</p>
                          {p.follow_up && (
                            <small>Retomar em {displayDate(p.follow_up)}</small>
                          )}
                        </div>
                      )}
                      <footer>
                        <span>
                          {store.profiles.find((pr) => pr.id === p.author_id)
                            ?.name || "Equipe pedagógica"}
                        </span>
                        {p.student_id && (
                          <button
                            className="icon-button"
                            title="Preparar relatório de evolução"
                            onClick={() => {
                              const s = store.students.find(
                                (s) => s.id === p.student_id,
                              )!;
                              setMessage({
                                title: "Evolução pedagógica",
                                text: evolutionMessage(store, s),
                                phone: s.guardian_phone,
                              });
                            }}
                          >
                            <MessageCircle size={18} />
                          </button>
                        )}
                      </footer>
                    </section>
                  ))}
              </div>
              {!store.pedagogy.some((p) => scoped(p.unit_id)) && (
                <Empty text="Adicione o primeiro registro pedagógico." />
              )}
            </>
          )}
          {page === "alerts" && (
            <>
              {profile.role !== "comercial" && (
                <PedagogyAgenda
                  store={store}
                  profile={profile}
                  unit={currentUnit}
                  onFollowUp={(record) =>
                    setModal({ kind: "pedagogy", parentRecord: record })
                  }
                />
              )}
              <FollowUpCenter
                store={store}
                profile={profile}
                unit={currentUnit}
                onStudent={(s) => setDossierId(s.id)}
                onAction={(kind, data) => {
                  if (kind.startsWith("followup:")) {
                    const record = store.pedagogy.find(
                      (p) => p.id === kind.slice(9),
                    );
                    if (record)
                      setModal({ kind: "pedagogy", parentRecord: record });
                  } else setModal({ kind, data });
                }}
                onPedagogy={(record) =>
                  record && profile.role !== "secretaria"
                    ? setModal({ kind: "pedagogy", parentRecord: record })
                    : goto("pedagogy")
                }
              />
              <section className="panel contact-history">
                <div className="panel-header">
                  <div>
                    <h2>Histórico de contatos</h2>
                    <p>O cuidado continua depois da ligação</p>
                  </div>
                </div>
                {store.contacts
                  .filter((c) => scoped(c.unit_id))
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((c) => (
                    <div className="history-item" key={c.id}>
                      <strong>
                        {store.students.find((s) => s.id === c.student_id) && (
                          <StudentAvatar
                            student={store.students.find(
                              (s) => s.id === c.student_id,
                            )!}
                          />
                        )}{" "}
                        {studentName(c.student_id)}{" "}
                        <small>{displayDate(c.date)}</small>
                      </strong>
                      <p>Motivo: {c.reason}</p>
                      <p>{c.outcome}</p>
                      {c.next_contact && (
                        <Badge tone="neutral">
                          Próximo contato: {displayDate(c.next_contact)}
                        </Badge>
                      )}
                    </div>
                  ))}
                {!store.contacts.some((c) => scoped(c.unit_id)) && (
                  <Empty text="Os contatos registrados aparecerão aqui." />
                )}
              </section>
            </>
          )}
          {page === "reports" && profile.role !== "comercial" && (
            <>
              {isManager(profile.role) && (
                <DailyAnalysis unit={currentUnit} units={store.units} />
              )}
              <section className="panel report-filters">
                <Filter size={19} />
                <strong>Período dos relatórios</strong>
                <label>
                  Turma dos registros
                  <select
                    aria-label="Turma dos registros"
                    value={reportClass}
                    onChange={(e) => setReportClass(e.target.value)}
                  >
                    <option value="all">Todas as turmas</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  De
                  <input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    max={reportTo}
                  />
                </label>
                <label>
                  Até
                  <input
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    min={reportFrom}
                    max={today()}
                  />
                </label>
              </section>
              <div className="class-grid">
                {[
                  {
                    title: "Panorama da gestão",
                    description:
                      "Matrículas, saídas, ocupação e alunos por unidade.",
                    icon: BarChart3,
                    action: () =>
                      pdf("Panorama da gestão", [
                        `Alunos ativos: ${active.length}`,
                        `Matrículas totais: ${students.length}`,
                        `Conclusões: ${students.filter((s) => s.status === "conclusao").length}`,
                        `Cancelamentos: ${students.filter((s) => s.status === "cancelamento").length}`,
                        `Abandonos: ${students.filter((s) => s.status === "abandono").length}`,
                        `Inadimplência: ${students.filter((s) => s.status === "inadimplencia").length}`,
                        ...classes.map(
                          (c) =>
                            `${c.name}: ${active.filter((s) => s.class_id === c.id).length}/${c.capacity} vagas | ${c.teacher}`,
                        ),
                        "Indicadores de matrícula são do cadastro atual; para presença aplica-se o período selecionado.",
                      ]),
                  },
                  {
                    title: "Frequência e faltas",
                    description:
                      "Presenças por aluno, com faltas e atrasos no período.",
                    icon: ClipboardCheck,
                    action: () =>
                      pdf("Frequência e faltas", [
                        `Período: ${reportFrom ? displayDate(reportFrom) : "início"} a ${displayDate(reportTo)}`,
                        `Aulas registradas: ${reportLessons.length}`,
                        ...frequencyReportLines(
                          reportSource,
                          reportLessons,
                          currentUnit,
                          reportClass,
                        ),
                      ]),
                  },
                  {
                    title: "Atividade da equipe",
                    description:
                      "Aulas, matrículas e acompanhamentos por professor e secretaria.",
                    icon: Users,
                    action: () =>
                      pdf(
                        "Atividade da equipe",
                        store.profiles
                          .filter((p) => scoped(p.unit_id))
                          .map(
                            (p) =>
                              `${p.name} | ${labels[p.role]} | Aulas no período: ${reportLessons.filter((l) => l.teacher_id === p.id).length} | Matrículas no período: ${students.filter((s) => s.created_by === p.id && (!reportFrom || s.enrollment_date >= reportFrom) && s.enrollment_date <= reportTo).length} | Registros pedagógicos: ${store.pedagogy.filter((r) => r.author_id === p.id && (!reportFrom || r.date >= reportFrom) && r.date <= reportTo).length} | Contatos: ${store.contacts.filter((c) => c.author_id === p.id && (!reportFrom || c.date >= reportFrom) && c.date <= reportTo).length}`,
                          ),
                      ),
                  },
                  {
                    title: "Acompanhamento pedagógico",
                    description:
                      "Diagnósticos, evolução e intervenções documentadas.",
                    icon: BookOpen,
                    action: () =>
                      pdf(
                        "Acompanhamento pedagógico",
                        store.pedagogy
                          .filter(
                            (p) =>
                              scoped(p.unit_id) &&
                              (!reportFrom || p.date >= reportFrom) &&
                              p.date <= reportTo,
                          )
                          .flatMap((p) => [
                            `${displayDate(p.date)} | ${studentName(p.student_id)} | ${className(p.class_id)} | ${p.kind}`,
                            ...pedagogicalReportLines(p),
                          ]),
                      ),
                  },
                ].map((r) => (
                  <section className="panel report-card" key={r.title}>
                    <span className="circle-icon green">
                      <r.icon size={23} />
                    </span>
                    <h2>{r.title}</h2>
                    <p>{r.description}</p>
                    <button className="secondary" onClick={r.action}>
                      <Download size={16} /> Exportar PDF
                    </button>
                  </section>
                ))}
              </div>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Resumos de aula</h2>
                    <p>
                      Conteúdo, professor e chamada prontos para compartilhar
                    </p>
                  </div>
                </div>
                {reportLessons
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((l) => (
                    <div className="lesson-report" key={l.id}>
                      <div>
                        <strong>{className(l.class_id)}</strong>
                        <small>
                          {displayDate(l.date)} • {l.teacher}
                        </small>
                        <p>{l.topic}</p>
                      </div>
                      <div className="row-actions">
                        <button
                          className="secondary"
                          onClick={() =>
                            pdf(
                              "Resumo da aula",
                              attendanceReportLines(allRecords!, l),
                            )
                          }
                        >
                          <Download size={16} /> PDF
                        </button>
                        <button
                          className="primary"
                          onClick={() =>
                            setMessage({
                              title: "Resumo da aula",
                              text: attendanceMessage(allRecords!, l),
                              phone: "",
                            })
                          }
                        >
                          <MessageCircle size={17} /> WhatsApp
                        </button>
                      </div>
                    </div>
                  ))}
                {!reportLessons.length && (
                  <Empty text="Nenhuma aula no período selecionado." />
                )}
              </section>
            </>
          )}
          {page === "units" && isManager(profile.role) && (
            <div className="class-grid">
              {store.units.map((u) => (
                <section className="panel class-card" key={u.id}>
                  <span className="circle-icon green">
                    <Building2 size={24} />
                  </span>
                  <h2>{u.name}</h2>
                  <p>{u.address || "Endereço não informado"}</p>
                  <div className="unit-stats">
                    <div>
                      <strong>
                        {
                          store.students.filter(
                            (s) => s.unit_id === u.id && s.status === "ativo",
                          ).length
                        }
                      </strong>
                      <small>alunos ativos</small>
                    </div>
                    <div>
                      <strong>
                        {store.classes.filter((c) => c.unit_id === u.id).length}
                      </strong>
                      <small>turmas</small>
                    </div>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => {
                      setUnit(u.id);
                      goto("overview");
                    }}
                  >
                    Ver indicadores desta unidade <ArrowRight size={17} />
                  </button>
                </section>
              ))}
            </div>
          )}
          {page === "records" && profile.role === "admin" && allRecords && (
            <RecordManager
              key={managementTable}
              initialTable={managementTable}
              store={allRecords}
              onSaved={load}
            />
          )}
          {page === "settings" && (
            <div className="account-settings">
              {profile.role === "admin" && (
                <TeamManager
                  profiles={store.profiles}
                  units={store.units}
                  actor={profile}
                  onSaved={load}
                />
              )}
              <PasswordChange
                onDone={() => {
                  setProfile(null);
                  setStore(null);
                }}
              />
            </div>
          )}
          <footer className="page-footer">
            <span>
              <span className="footer-mark">w</span> WISDOM <em> / </em>{" "}
              Controle acadêmico.
            </span>
            <span>Wisdom Cursos / Uso da equipe</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          {notice}
          <button onClick={() => setNotice("")} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
      {dossierId && students.some((s) => s.id === dossierId) && (
        <StudentDossier
          key={dossierId}
          student={students.find((s) => s.id === dossierId)!}
          store={store}
          canViewPedagogy={profile.role !== "comercial"}
          canEdit={canEditStudent(
            profile,
            students.find((s) => s.id === dossierId)!,
          )}
          onGroup={
            students.find((s) => s.id === dossierId)?.class_id
              ? () => {
                  const student = students.find((s) => s.id === dossierId)!;
                  const course = store.classes.find(
                    (c) => c.id === student.class_id,
                  );
                  if (course) {
                    setDossierId(null);
                    setWelcome({ course, student });
                  }
                }
              : undefined
          }
          onClose={() => setDossierId(null)}
          onEdit={() => {
            setModal({
              kind: "student",
              data: students.find((s) => s.id === dossierId)!,
            });
            setDossierId(null);
          }}
          onMessage={() => {
            const student = students.find((s) => s.id === dossierId)!;
            setMessage({
              title: "Evolução do aluno",
              text: evolutionMessage(store, student),
              phone: student.guardian_phone,
            });
            setDossierId(null);
          }}
          onPdf={() => {
            const student = students.find((s) => s.id === dossierId)!;
            void pdf("Ficha do aluno", [
              evolutionMessage(store, student),
              `Matrícula: ${displayDate(student.enrollment_date)}`,
              `Situação: ${labels[student.status]}`,
              "Histórico pedagógico completo",
              ...reportSource.pedagogy
                .filter((p) => p.student_id === student.id)
                .sort(comparePedagogy)
                .flatMap((p) => [
                  p.archived_at ? "Registro arquivado" : "Registro pedagógico",
                  ...pedagogicalReportLines(p),
                ]),
            ]);
          }}
        />
      )}
      {welcome && (
        <ClassWelcome
          course={welcome.course}
          student={welcome.student}
          onClose={() => setWelcome(null)}
          onMessage={(text, phone, title) => {
            setWelcome(null);
            setMessage({ text, phone, title });
          }}
        />
      )}
      {importOpen && (
        <StudentImporter
          store={store}
          profile={profile}
          initialUnit={currentUnit}
          onClose={() => setImportOpen(false)}
          onImport={saveImportedStudents}
        />
      )}
      {modal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy && !photoBusy && !qrBusy)
              setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">REGISTRO ACADÊMICO</span>
                <h2 id="modal-title">
                  {
                    (
                      {
                        student: modal.data
                          ? "Editar matrícula"
                          : profile.role === "comercial"
                            ? "Nova pré-matrícula"
                            : "Nova matrícula",
                        class: modal.data ? "Editar turma" : "Nova turma",
                        unit: "Nova unidade",
                        archive: "Arquivar matrícula",
                        pedagogy: "Registro pedagógico",
                        contact: "Registrar contato",
                        offering: modal.data
                          ? "Editar formação"
                          : "Novo curso ou pacote",
                      } as Record<string, string>
                    )[modal.kind]
                  }
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Fechar"
                disabled={busy || photoBusy || qrBusy}
                onClick={() => setModal(null)}
              >
                <X size={21} />
              </button>
            </div>
            <form onSubmit={submitModal} className="modal-form">
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              {modal.kind === "student" && (
                <>
                  <StudentPhotoEditor
                    key={modal.data?.id || "new"}
                    student={modal.data as Student | undefined}
                    onChange={(photo, remove) => {
                      setPhotoDraft(photo);
                      setRemovePhoto(remove);
                    }}
                    onBusy={setPhotoBusy}
                  />
                  <div className="form-section-label">DADOS DO ALUNO</div>
                  <label>
                    Nome completo
                    <input
                      name="name"
                      defaultValue={(modal.data as Student)?.name}
                    />
                  </label>
                  <div className="form-grid">
                    {profile.role !== "comercial" && (
                      <label>
                        Nascimento
                        <input
                          name="birth_date"
                          type="date"
                          max={today()}
                          defaultValue={(modal.data as Student)?.birth_date}
                        />
                        <small>
                          Exibe alertas de aniversário do dia e da semana.
                        </small>
                      </label>
                    )}
                    <label>
                      Telefone do aluno
                      <input
                        name="phone"
                        type="tel"
                        defaultValue={(modal.data as Student)?.phone}
                      />
                    </label>
                  </div>
                  <label>
                    Turma
                    <select
                      name="class_id"
                      aria-label="Turma"
                      defaultValue={
                        (modal.data as Student)?.class_id ||
                        modal.classPreset ||
                        ""
                      }
                    >
                      <option value="">Selecionar turma depois</option>
                      {classes
                        .filter(
                          (c) =>
                            (!modal.data || c.unit_id === modal.data.unit_id) &&
                            (profile.role !== "comercial" ||
                              c.enrollment_open !== false ||
                              c.id === (modal.data as Student)?.class_id),
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} •{" "}
                            {store.units.find((u) => u.id === c.unit_id)?.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Curso ou pacote contratado
                    <select
                      name="offering_id"
                      defaultValue={(modal.data as Student)?.offering_id || ""}
                    >
                      <option value="">Selecionar depois</option>
                      {store.offerings
                        .filter((o) => scoped(o.unit_id))
                        .map((o) => (
                          <option value={o.id} key={o.id}>
                            {o.name} •{" "}
                            {store.units.find((u) => u.id === o.unit_id)?.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="form-section-label">
                    RESPONSÁVEL E CONTATO
                  </div>
                  <label>
                    Nome do responsável
                    <input
                      name="guardian"
                      defaultValue={(modal.data as Student)?.guardian}
                    />
                  </label>
                  <label>
                    WhatsApp do responsável
                    <input
                      type="tel"
                      name="guardian_phone"
                      placeholder="55 + DDD + número"
                      pattern="[+0-9 ()-]{10,20}"
                      defaultValue={(modal.data as Student)?.guardian_phone}
                    />
                  </label>
                  {profile.role !== "comercial" && (
                    <div className="form-grid">
                      <label>
                        E-mail
                        <input
                          type="email"
                          name="email"
                          defaultValue={(modal.data as Student)?.email}
                        />
                      </label>
                      <label>
                        Endereço
                        <input
                          name="address"
                          defaultValue={(modal.data as Student)?.address}
                        />
                      </label>
                    </div>
                  )}
                  {profile.role !== "comercial" &&
                    profile.role !== "professor" &&
                    modal.data &&
                    enrollmentStage(modal.data as Student) !== "complete" && (
                      <label className="checkbox-label">
                        <input type="checkbox" name="complete_registration" />
                        Concluir conferência da pré-matrícula
                      </label>
                    )}
                  <small>
                    Todos os campos são opcionais. O cadastro recebe um
                    identificador e fica vinculado à unidade selecionada ou à
                    sua unidade. Complete os dados e vincule a turma depois.
                  </small>
                </>
              )}
              {modal.kind === "class" && (
                <>
                  <label>
                    Nome da turma *
                    <input
                      name="name"
                      required
                      defaultValue={(modal.data as CourseClass)?.name}
                    />
                  </label>
                  <label>
                    Curso *
                    <input
                      name="course"
                      required
                      defaultValue={(modal.data as CourseClass)?.course}
                    />
                  </label>
                  <label>
                    Unidade *
                    <select
                      name="unit_id"
                      required
                      defaultValue={modal.data?.unit_id || unitOptions[0]?.id}
                    >
                      {unitOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Professor *
                    <select
                      name="teacher_id"
                      required
                      defaultValue={
                        (modal.data as CourseClass)?.teacher_id || ""
                      }
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      {store.profiles
                        .filter(
                          (p) => p.role === "professor" || isManager(p.role),
                        )
                        .filter(
                          (p) =>
                            isManager(profile.role) ||
                            p.unit_id === profile.unit_id,
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} •{" "}
                            {store.units.find((u) => u.id === p.unit_id)?.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      Dias e horário *
                      <input
                        name="schedule"
                        required
                        placeholder="Seg e Qua • 14h às 16h"
                        defaultValue={(modal.data as CourseClass)?.schedule}
                      />
                    </label>
                    <label>
                      Capacidade *
                      <input
                        name="capacity"
                        required
                        type="number"
                        min="1"
                        max="500"
                        defaultValue={
                          (modal.data as CourseClass)?.capacity || 25
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Link do grupo de WhatsApp
                    <input
                      name="whatsapp"
                      type="url"
                      placeholder="https://chat.whatsapp.com/…"
                      defaultValue={(modal.data as CourseClass)?.whatsapp}
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="enrollment_open"
                      defaultChecked={
                        (modal.data as CourseClass)?.enrollment_open !== false
                      }
                    />
                    Turma aberta para matrícula
                  </label>
                  <label>
                    Prioridade para o comercial
                    <select
                      name="enrollment_priority"
                      defaultValue={
                        (modal.data as CourseClass)?.enrollment_priority || 3
                      }
                    >
                      <option value="1">1ª opção — foco principal</option>
                      <option value="2">
                        2ª opção — alternativa prioritária
                      </option>
                      <option value="3">3ª opção — demais opções</option>
                    </select>
                  </label>
                  <ClassQrEditor
                    path={(modal.data as CourseClass)?.whatsapp_qr_path}
                    onChange={(blob, remove) => {
                      setQrDraft(blob);
                      setRemoveQr(remove);
                    }}
                    onBusy={setQrBusy}
                  />
                </>
              )}
              {modal.kind === "offering" && (
                <>
                  <label>
                    Nome da formação *
                    <input
                      name="name"
                      required
                      defaultValue={(modal.data as Offering)?.name}
                    />
                  </label>
                  <label>
                    Unidade *
                    <select
                      name="unit_id"
                      required
                      defaultValue={modal.data?.unit_id || unitOptions[0]?.id}
                    >
                      {unitOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      Modalidade
                      <select
                        name="kind"
                        defaultValue={
                          (modal.data as Offering)?.kind || "individual"
                        }
                      >
                        <option value="individual">Curso individual</option>
                        <option value="pacote">Pacote de cursos</option>
                      </select>
                    </label>
                    <label>
                      Duração em meses *
                      <input
                        name="duration_months"
                        type="number"
                        min="1"
                        max="120"
                        required
                        defaultValue={
                          (modal.data as Offering)?.duration_months || 6
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Cursos e módulos incluídos *
                    <textarea
                      name="courses"
                      required
                      placeholder="Ex.: Informática, Administração, Comunicação e empregabilidade"
                      defaultValue={(modal.data as Offering)?.courses}
                    />
                  </label>
                </>
              )}
              {modal.kind === "unit" && (
                <>
                  <label>
                    Nome da unidade *<input name="name" required />
                  </label>
                  <label>
                    Endereço
                    <input name="address" />
                  </label>
                </>
              )}
              {modal.kind === "archive" && (
                <>
                  <p>
                    O histórico de {(modal.data as Student).name} será
                    preservado.
                  </p>
                  <label>
                    Motivo *
                    <select name="status" required>
                      <option value="conclusao">Conclusão do curso</option>
                      <option value="inadimplencia">Inadimplência</option>
                      <option value="abandono">Abandono</option>
                      <option value="cancelamento">Cancelamento</option>
                    </select>
                  </label>
                  <label>
                    Detalhes *
                    <textarea
                      name="archive_reason"
                      required
                      placeholder="Registre o motivo e o encaminhamento realizado."
                    />
                  </label>
                </>
              )}
              {modal.kind === "pedagogy" && (
                <PedagogyFields
                  store={store}
                  classes={writableClasses}
                  parent={modal.parentRecord}
                />
              )}
              {modal.kind === "contact" && (
                <>
                  <p>Contato sobre {(modal.data as Student).name}</p>
                  <label>
                    Motivo identificado *
                    <input
                      name="reason"
                      required
                      placeholder="Ex.: transporte, saúde, horário…"
                    />
                  </label>
                  <label>
                    Resultado e encaminhamento *
                    <textarea name="outcome" required />
                  </label>
                  <label>
                    Próximo contato
                    <input name="next_contact" type="date" min={today()} />
                  </label>
                </>
              )}
              {modal.kind === "profile" && (
                <>
                  <p>
                    Use o UUID do usuário criado em Authentication no Supabase.
                    A conta terá acesso aos dados reais da unidade escolhida.
                  </p>
                  <label>
                    UUID do usuário *
                    <input
                      name="id"
                      required
                      pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                    />
                  </label>
                  <label>
                    Nome *<input name="name" required />
                  </label>
                  <label>
                    Perfil
                    <select name="role">
                      <option value="professor">Professor</option>
                      <option value="secretaria">Secretaria</option>
                      <option value="coordenacao">Coordenação</option>
                    </select>
                  </label>
                  <label>
                    Unidade
                    <select name="unit_id" required>
                      {store.units.map((u) => (
                        <option value={u.id} key={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || photoBusy || qrBusy}
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  className="primary"
                  disabled={busy || photoBusy || qrBusy}
                >
                  {busy ? "Salvando…" : "Salvar registro"}
                  <Check size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {message && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">REVISÃO DA MENSAGEM</span>
                <h2 id="message-title">{message.title}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar mensagem"
                onClick={() => setMessage(null)}
              >
                <X size={21} />
              </button>
            </div>
            <div className="modal-form">
              <p>
                Revise os destinatários antes de compartilhar informações de
                alunos. Para grupos, copie o texto e cole no WhatsApp.
              </p>
              <WhatsAppPreview text={message.text} />
              <details className="message-editor">
                <summary>Editar texto da mensagem</summary>
                <textarea
                  className="message-preview"
                  aria-label="Mensagem para WhatsApp"
                  value={message.text}
                  onChange={(e) =>
                    setMessage({ ...message, text: e.target.value })
                  }
                />
              </details>
              <label>
                WhatsApp de destino (opcional)
                <input
                  type="tel"
                  placeholder="55 + DDD + número"
                  value={message.phone}
                  onChange={(e) =>
                    setMessage({ ...message, phone: e.target.value })
                  }
                />
              </label>
              <div className="message-buttons">
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(message.text);
                      notify("Mensagem copiada.");
                    } catch {
                      setError(
                        "Não foi possível copiar. Selecione o texto e copie manualmente.",
                      );
                    }
                  }}
                >
                  Copiar texto
                </button>
                <button
                  className="secondary"
                  onClick={() => pdf(message.title, message.text.split("\n"))}
                >
                  <Download size={16} /> PDF
                </button>
                <a
                  className="primary"
                  href={whatsappUrl(message.phone, message.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={17} /> Abrir WhatsApp
                </a>
              </div>
              <small>
                O envio é manual. A mensagem só será enviada após sua
                confirmação no WhatsApp.
              </small>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
