"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
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
  ChevronDown,
  X,
  Check,
  Clock,
  MessageCircle,
  Download,
  LogOut,
  Menu,
  Phone,
  Archive,
  AlertTriangle,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  Filter,
  Pencil,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { demoStore } from "@/lib/demo";
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
  evolutionMessage,
  whatsappUrl,
  validateStudent,
} from "@/lib/domain";
const nav = [
  ["overview", "Visão geral", LayoutDashboard],
  ["students", "Alunos", Users],
  ["classes", "Turmas", GraduationCap],
  ["offerings", "Cursos e pacotes", BookOpen],
  ["attendance", "Chamada", ClipboardCheck],
  ["pedagogy", "Pedagógico", BookOpen],
  ["alerts", "Central de atenção", Bell],
  ["reports", "Relatórios", BarChart3],
  ["units", "Unidades", Building2],
  ["settings", "Equipe e acesso", Settings],
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
type Modal = { kind: string; data?: Student | CourseClass | Offering } | null;
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
  const [store, setStore] = useState<Store | null>(null),
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
    [login, setLogin] = useState({ email: "", password: "" }),
    [sessionReady, setSessionReady] = useState(false);
  const [classId, setClassId] = useState(""),
    [lessonDate, setLessonDate] = useState(today()),
    [topic, setTopic] = useState(""),
    [marks, setMarks] = useState<Record<string, AttendanceStatus>>({}),
    [reportFrom, setReportFrom] = useState(""),
    [reportTo, setReportTo] = useState(today());
  const isDemo = !supabase;
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
      setUnit(p.role === "coordenacao" ? "all" : p.unit_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setSessionReady(true);
    }
  }
  useEffect(() => {
    if (isDemo) {
      try {
        const cached = localStorage.getItem("wisdom-demo-v2");
        const data = cached ? JSON.parse(cached) : demoStore();
        setStore(data);
        setProfile(data.profiles[0]);
      } catch {
        const data = demoStore();
        setStore(data);
        setProfile(data.profiles[0]);
      }
      setSessionReady(true);
    } else {
      void load();
      const { data } = supabase!.auth.onAuthStateChange(() => {
        setTimeout(() => void load(), 0);
      });
      return () => data.subscription.unsubscribe();
    }
  }, []);
  useEffect(() => {
    if (isDemo && store)
      localStorage.setItem("wisdom-demo-v2", JSON.stringify(store));
  }, [store, isDemo]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const scoped = (id: string) =>
    profile?.role === "coordenacao"
      ? unit === "all" || id === unit
      : id === profile?.unit_id;
  const students = store?.students.filter((s) => scoped(s.unit_id)) || [],
    classes = store?.classes.filter((c) => scoped(c.unit_id)) || [],
    active = students.filter((s) => s.status === "ativo"),
    alerts = active.filter((s) => absenceCount(store!, s.id) >= 3),
    filtered = students.filter((s) =>
      `${s.name} ${s.guardian}`.toLowerCase().includes(query.toLowerCase()),
    );
  const writableClasses = classes.filter(
    (c) => profile?.role !== "professor" || c.teacher_id === profile.id,
  );
  const selectedClass =
    writableClasses.find((c) => c.id === classId) || writableClasses[0];
  const selectedLesson = store?.lessons.find(
    (l) => l.class_id === selectedClass?.id && l.date === lessonDate,
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
  }, [selectedClass?.id, lessonDate, store?.lessons, store?.attendance]);
  async function save<K extends keyof Store>(
    table: K,
    record: Store[K][number],
  ) {
    setBusy(true);
    setError("");
    try {
      if (supabase) {
        const { error } = await (table === "pedagogy" || table === "contacts"
          ? supabase.from(table).insert(record)
          : supabase.from(table).upsert(record));
        if (error) throw error;
      }
      setStore((prev) =>
        prev
          ? {
              ...prev,
              [table]: [
                ...prev[table].filter((r) => r.id !== record.id),
                record,
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
    const { error } = await supabase!.auth.signInWithPassword(login);
    setBusy(false);
    if (error) setError("Não foi possível entrar. Confira seu e-mail e senha.");
  }
  async function pdf(title: string, lines: string[]) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(24, 71, 62);
    doc.text("WISDOM", 18, 22);
    doc.setFontSize(13);
    doc.text(title, 18, 33);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(
      `Emitido em ${displayDate(today())} | ${unit === "all" ? "Todas as unidades" : store?.units.find((u) => u.id === unit)?.name || ""}`,
      18,
      42,
    );
    let y = 54;
    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line.replace(/\*/g, ""), 173);
      for (const text of wrapped) {
        if (y > 278) {
          doc.addPage();
          y = 20;
        }
        doc.text(text, 18, y);
        y += 6;
      }
      y += 2;
    }
    doc.save(`wisdom-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.pdf`);
    notify("PDF gerado. Guarde o arquivo em local seguro.");
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
    }));
    setBusy(true);
    setError("");
    try {
      if (supabase) {
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
      const record: Student = {
        id,
        unit_id: c?.unit_id || "",
        class_id: v("class_id"),
        offering_id: v("offering_id") || null,
        name: v("name"),
        birth_date: v("birth_date"),
        phone: v("phone"),
        guardian: v("guardian"),
        guardian_phone: v("guardian_phone"),
        email: v("email"),
        address: v("address"),
        created_by: previous?.created_by || profile.id,
        enrollment_date: previous?.enrollment_date || today(),
        status: previous?.status || "ativo",
        archive_reason: previous?.archive_reason || "",
      };
      const invalid = validateStudent(record);
      if (invalid) {
        setError(invalid);
        return;
      }
      if (!c) {
        setError("Turma não encontrada.");
        return;
      }
      if (
        record.offering_id &&
        !store.offerings.some(
          (o) => o.id === record.offering_id && o.unit_id === c.unit_id,
        )
      ) {
        setError("O curso ou pacote deve pertencer à unidade da turma.");
        return;
      }
      if (c.unit_id !== previous?.unit_id && previous) {
        setError(
          "A transferência entre unidades exige um novo vínculo de matrícula.",
        );
        return;
      }
      if (
        record.status === "ativo" &&
        store.students.filter(
          (s) => s.class_id === c.id && s.status === "ativo" && s.id !== id,
        ).length >= c.capacity
      ) {
        setError("Turma sem vagas. Escolha outra turma.");
        return;
      }
      ok = await save("students", record);
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
      ok = await save("classes", {
        id,
        unit_id: targetUnit,
        name: v("name"),
        course: v("course"),
        teacher_id: p.id,
        teacher: p.name,
        schedule: v("schedule"),
        capacity,
        whatsapp: v("whatsapp"),
      });
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
      if (st && st.class_id !== c.id) {
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
    if (modal.kind === "profile") {
      ok = await save("profiles", {
        id: v("id"),
        name: v("name"),
        role: v("role") as Role,
        unit_id: v("unit_id"),
      });
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
  if (!profile || !store)
    return (
      <main className="login">
        <div className="login-brand">
          <img
            src="/wisdom-symbol.svg"
            alt="Wisdom Cursos"
            className="brand-symbol"
          />
          <h1>
            Uma visão completa.
            <br />
            Mais possibilidades.
          </h1>
          <p>A gestão que aproxima sua equipe de cada aluno.</p>
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
            E-mail
            <input
              type="email"
              autoComplete="username"
              required
              value={login.email}
              onChange={(e) => setLogin({ ...login, email: e.target.value })}
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
          <button className="primary" disabled={busy}>
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
  const className = (id: string) =>
    store.classes.find((c) => c.id === id)?.name || "—";
  const studentName = (id: string | null) =>
    store.students.find((s) => s.id === id)?.name || "Toda a turma";
  const currentUnit = profile.role === "coordenacao" ? unit : profile.unit_id;
  const unitOptions = store.units.filter(
    (u) => profile.role === "coordenacao" || u.id === profile.unit_id,
  );
  const reportLessons = store.lessons.filter(
    (l) =>
      scoped(l.unit_id) &&
      (!reportFrom || l.date >= reportFrom) &&
      l.date <= reportTo,
  );
  const reportAttendance = store.attendance.filter((a) =>
    reportLessons.some((l) => l.id === a.lesson_id),
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            goto("overview");
          }}
        >
          <img src="/wisdom-symbol.svg" alt="" className="brand-symbol" />
          <div>
            WISDOM<span>CURSOS / GESTÃO EDUCACIONAL</span>
          </div>
        </a>
        <div className="workspace-label">SEU ESPAÇO DE GESTÃO</div>
        <nav>
          {nav
            .filter(
              (n) =>
                !["units", "settings"].includes(n[0]) ||
                profile.role === "coordenacao",
            )
            .map(([key, label, Icon]) => (
              <button
                key={key}
                className={page === key ? "active" : ""}
                onClick={() => goto(key)}
              >
                <Icon size={19} />
                <span>{label}</span>
                {key === "alerts" && alerts.length > 0 && (
                  <b>{alerts.length}</b>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <Sparkles size={19} />
            <strong>Cada aluno importa.</strong>
            <p>Transforme informação em cuidado e novas oportunidades.</p>
          </div>
          <div className="user">
            <div className="avatar">{initials(profile.name)}</div>
            <div>
              <strong>{profile.name}</strong>
              <small>{labels[profile.role]}</small>
            </div>
            {!isDemo && (
              <button title="Sair" onClick={() => supabase!.auth.signOut()}>
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Abrir menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{currentNav[1]}</strong>
          </div>
          <div className="topbar-actions">
            <span className="live-dot" />{" "}
            <span className="desktop">
              {isDemo ? "Ambiente de demonstração" : "Conectado ao Supabase"}
            </span>
            <span className="separator" />
            {!isDemo && (
              <button
                className="icon-button"
                title="Atualizar dados"
                disabled={busy}
                onClick={() => void load()}
              >
                <RefreshCw size={17} />
              </button>
            )}
            <button
              className="notification icon-button"
              title="Central de atenção"
              onClick={() => goto("alerts")}
            >
              <Bell size={20} />
              {alerts.length > 0 && <i />}
            </button>
            <div className="avatar small">{initials(profile.name)}</div>
          </div>
        </header>
        <main className="content">
          {isDemo && (
            <div className="demo-strip">
              <span>DEMONSTRAÇÃO</span> Dados fictícios salvos neste navegador.{" "}
              <button onClick={() => goto("settings")}>
                Configurar acesso <ArrowUpRight size={13} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "overview"
                  ? "ACOMPANHE. ENTENDA. TRANSFORME."
                  : "WISDOM / " + currentNav[1].toUpperCase()}
              </div>
              <h1>
                {page === "overview"
                  ? "Sua gestão, em perspectiva"
                  : currentNav[1]}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {
                  (
                    {
                      overview:
                        "Tudo o que importa para acompanhar sua escola de perto.",
                      offerings:
                        "Formações para o primeiro emprego e para toda a trajetória.",
                      students: "Cada trajetória começa com uma oportunidade.",
                      classes:
                        "Organize seus encontros e encontre espaço para crescer.",
                      attendance:
                        "Presença registrada. Aprendizagem acompanhada.",
                      pedagogy: "Dê visibilidade à evolução de cada aluno.",
                      alerts: "Um olhar atento faz toda a diferença.",
                      reports:
                        "Informações claras para decisões bem fundamentadas.",
                      units: "Uma rede conectada, respeitando cada unidade.",
                      settings: "As pessoas certas, com o acesso certo.",
                    } as Record<string, string>
                  )[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              <label className="unit-picker">
                <Building2 size={16} />
                <select
                  aria-label="Filtrar unidade"
                  value={currentUnit}
                  disabled={profile.role !== "coordenacao"}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  {profile.role === "coordenacao" && (
                    <option value="all">Todas as unidades</option>
                  )}
                  {unitOptions.map((u) => (
                    <option value={u.id} key={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              {!["attendance", "reports", "settings"].includes(page) &&
                !(page === "pedagogy" && profile.role === "secretaria") && (
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
                                  profile.role !== "professor"
                                ? "offering"
                                : page === "pedagogy"
                                  ? "pedagogy"
                                  : "student",
                      })
                    }
                  >
                    <Plus size={17} />
                    {page === "classes" && profile.role !== "professor"
                      ? "Nova turma"
                      : page === "units"
                        ? "Nova unidade"
                        : page === "offerings" && profile.role !== "professor"
                          ? "Novo curso ou pacote"
                          : page === "pedagogy"
                            ? "Novo registro"
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
          {page === "overview" && (
            <>
              <div className="summary-row">
                <span>
                  <CalendarDays size={16} />
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "full",
                    timeZone: "America/Sao_Paulo",
                  }).format(new Date())}
                </span>
                <Badge tone="neutral">
                  Visão{" "}
                  {profile.role === "coordenacao"
                    ? "da coordenação"
                    : labels[profile.role].toLowerCase()}
                </Badge>
              </div>
              <div className="stat-grid">
                <Stat
                  label="Alunos ativos"
                  value={active.length}
                  icon={<Users size={20} />}
                  detail={`${students.length} matrículas no total`}
                  color="green"
                />
                <Stat
                  label="Turmas em andamento"
                  value={classes.length}
                  icon={<GraduationCap size={20} />}
                  detail={`${classes.reduce((n, c) => n + Math.max(0, c.capacity - active.filter((s) => s.class_id === c.id).length), 0)} vagas disponíveis`}
                  color="blue"
                />
                <Stat
                  label="Frequência geral"
                  value={
                    overallFrequency === null ? "—" : overallFrequency + "%"
                  }
                  icon={<ClipboardCheck size={20} />}
                  detail="Presenças e atrasos nas aulas registradas"
                  color="purple"
                />
                <Stat
                  label="Precisam de atenção"
                  value={alerts.length}
                  icon={<Bell size={20} />}
                  detail="Alunos com 3 ou mais faltas"
                  color="orange"
                />
              </div>
              <div className="lifecycle-row">
                {(
                  [
                    "conclusao",
                    "cancelamento",
                    "abandono",
                    "inadimplencia",
                  ] as const
                ).map((status) => (
                  <div key={status}>
                    <span>{labels[status]}</span>
                    <strong>
                      {students.filter((s) => s.status === status).length}
                    </strong>
                    <small>matrículas no cadastro atual</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel enrollment-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Movimento de matrículas</h2>
                      <p>Novos começos, mês a mês</p>
                    </div>
                    <Badge tone="neutral">Últimos 6 meses</Badge>
                  </div>
                  <EnrollmentChart students={students} />
                  <div className="chart-legend">
                    <span>
                      <i /> Matrículas
                    </span>
                    <span>
                      <i /> Saídas e conclusões atuais
                    </span>
                  </div>
                </section>
                <section className="panel attention-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Vamos cuidar de perto</h2>
                      <p>O próximo contato pode fazer a diferença</p>
                    </div>
                    <span className="circle-icon orange">
                      <Bell size={19} />
                    </span>
                  </div>
                  {alerts.length ? (
                    alerts.slice(0, 3).map((s) => (
                      <div className="attention-item" key={s.id}>
                        <div className="avatar peach">{initials(s.name)}</div>
                        <div>
                          <strong>{s.name}</strong>
                          <small>{className(s.class_id)}</small>
                        </div>
                        <Badge tone="orange">
                          {absenceCount(store, s.id)} faltas
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <Empty text="Nenhum alerta de faltas no momento." />
                  )}
                  <button className="text-link" onClick={() => goto("alerts")}>
                    Ver central de atenção <ArrowRight size={16} />
                  </button>
                </section>
              </div>
              <div className="dashboard-grid lower">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Turmas em foco</h2>
                      <p>Encontros que fazem o aprendizado acontecer</p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => goto("classes")}
                    >
                      Todas as turmas <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>TURMA / CURSO</th>
                          <th>PROFESSOR</th>
                          <th>OCUPAÇÃO</th>
                          <th>SITUAÇÃO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.slice(0, 4).map((c) => {
                          const count = active.filter(
                            (s) => s.class_id === c.id,
                          ).length;
                          return (
                            <tr key={c.id}>
                              <td>
                                <strong>{c.name}</strong>
                                <small>{c.schedule}</small>
                              </td>
                              <td>{c.teacher}</td>
                              <td>
                                <div className="occupancy">
                                  <span>
                                    {count}
                                    <em> / {c.capacity}</em>
                                  </span>
                                  <div className="progress">
                                    <i
                                      style={{
                                        width:
                                          Math.min(
                                            100,
                                            (count / c.capacity) * 100,
                                          ) + "%",
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge
                                  tone={
                                    count / c.capacity < 0.4
                                      ? "orange"
                                      : "green"
                                  }
                                >
                                  {count / c.capacity < 0.4
                                    ? "Vagas em aberto"
                                    : "Em andamento"}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!classes.length && (
                    <Empty text="Cadastre sua primeira turma." />
                  )}
                </section>
                <section className="insight-card">
                  <span className="eyebrow">OLHAR PEDAGÓGICO</span>
                  <div className="insight-art">
                    <BookOpen size={44} />
                    <span>+</span>
                    <i />
                    <b />
                  </div>
                  <h2>
                    Além da presença,
                    <br />a evolução.
                  </h2>
                  <p>
                    Registre conquistas, identifique desafios e acompanhe o
                    desenvolvimento dos seus alunos.
                  </p>
                  <button onClick={() => goto("pedagogy")}>
                    Acompanhar evolução <ArrowUpRight size={17} />
                  </button>
                </section>
              </div>
              <section className="quick-actions">
                <span>Seu próximo passo</span>
                <button onClick={() => goto("attendance")}>
                  <ClipboardCheck size={18} /> Fazer chamada{" "}
                  <ArrowRight size={15} />
                </button>
                <button onClick={() => setModal({ kind: "student" })}>
                  <Plus size={18} /> Matrícula expressa <ArrowRight size={15} />
                </button>
                <button onClick={() => goto("reports")}>
                  <Download size={18} /> Gerar relatório{" "}
                  <ArrowRight size={15} />
                </button>
              </section>
            </>
          )}
          {page === "students" && (
            <section className="panel">
              <div className="list-toolbar">
                <div className="tabs">
                  <span className="selected">
                    Todos os alunos <b>{students.length}</b>
                  </span>
                  <span>{active.length} ativos</span>
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
                            <div className="avatar">{initials(s.name)}</div>
                            <div>
                              <strong>{s.name}</strong>
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
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              title="Editar matrícula"
                              onClick={() =>
                                setModal({ kind: "student", data: s })
                              }
                            >
                              <Pencil size={16} />
                            </button>
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
                            {profile.role !== "professor" && (
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
                                      active.filter((a) => a.class_id === c.id)
                                        .length >= c.capacity
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
            <div className="class-grid">
              {classes.map((c) => {
                const list = active.filter((s) => s.class_id === c.id);
                const occupancy = Math.round((list.length / c.capacity) * 100);
                return (
                  <section className="panel class-card" key={c.id}>
                    <div className="class-card-top">
                      <span className="circle-icon green">
                        <GraduationCap size={23} />
                      </span>
                      <Badge tone={occupancy < 40 ? "orange" : "green"}>
                        {occupancy < 40 ? "Baixa ocupação" : "Em andamento"}
                      </Badge>
                    </div>
                    <h2>{c.name}</h2>
                    <p>{c.course}</p>
                    <div className="class-meta">
                      <span>
                        <Users size={16} />
                        {c.teacher}
                      </span>
                      <span>
                        <Clock size={16} />
                        {c.schedule}
                      </span>
                      <span>
                        <Building2 size={16} />
                        {store.units.find((u) => u.id === c.unit_id)?.name}
                      </span>
                    </div>
                    <div className="occupancy-label">
                      <span>Ocupação da turma</span>
                      <strong>
                        {list.length} / {c.capacity}
                      </strong>
                    </div>
                    <div className="progress">
                      <i style={{ width: Math.min(100, occupancy) + "%" }} />
                    </div>
                    <footer>
                      <button
                        className="text-link"
                        onClick={() => {
                          setClassId(c.id);
                          goto("attendance");
                        }}
                      >
                        Abrir chamada <ArrowRight size={16} />
                      </button>
                      {profile.role !== "professor" && (
                        <button
                          className="icon-button"
                          title="Editar turma"
                          onClick={() => setModal({ kind: "class", data: c })}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </footer>
                  </section>
                );
              })}
              {!classes.length && (
                <Empty text="Nenhuma turma cadastrada nesta unidade." />
              )}
            </div>
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
                      {profile.role !== "professor" && (
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
          {page === "attendance" && profile.role !== "secretaria" && (
            <form onSubmit={saveAttendance}>
              <section className="panel lesson-config">
                <label>
                  Turma
                  <select
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
                    onClick={() =>
                      setMarks(
                        Object.fromEntries(
                          active
                            .filter((s) => s.class_id === selectedClass?.id)
                            .map((s) => [s.id, "presente"]),
                        ),
                      )
                    }
                  >
                    <Check size={16} /> Todos presentes
                  </button>
                </div>
                {active
                  .filter((s) => s.class_id === selectedClass?.id)
                  .map((s) => (
                    <div className="attendance-row" key={s.id}>
                      <div className="person">
                        <div className="avatar">{initials(s.name)}</div>
                        <strong>{s.name}</strong>
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
                            onClick={() =>
                              setMarks({ ...marks, [s.id]: status })
                            }
                          >
                            {marks[s.id] === status && <Check size={14} />}{" "}
                            {labels[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                {!active.some((s) => s.class_id === selectedClass?.id) && (
                  <Empty text="Nenhum aluno ativo nesta turma." />
                )}
                <div className="form-footer">
                  <span>
                    {Object.keys(marks).length} alunos com situação registrada
                  </span>
                  <button className="primary" disabled={busy || !selectedClass}>
                    <CheckCircle2 size={17} />
                    {busy ? "Salvando…" : "Finalizar chamada e gerar resumo"}
                  </button>
                </div>
              </section>
            </form>
          )}
          {page === "pedagogy" && (
            <>
              <div className="info-banner">
                <BookOpen size={22} />
                <div>
                  <strong>Aprender é uma trajetória.</strong>
                  <p>
                    Registre diagnósticos, evolução e intervenções individuais
                    ou de toda a turma.
                  </p>
                </div>
              </div>
              <div className="records-grid">
                {store.pedagogy
                  .filter((p) => scoped(p.unit_id))
                  .sort((a, b) => b.date.localeCompare(a.date))
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
                      <h2>{studentName(p.student_id)}</h2>
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
              <div className="info-banner warning">
                <AlertTriangle size={23} />
                <div>
                  <strong>{alerts.length} alunos com 3 ou mais faltas</strong>
                  <p>
                    Faltas acumuladas nas aulas registradas. Registre o motivo e
                    combine o próximo acompanhamento.
                  </p>
                </div>
              </div>
              <section className="panel">
                {alerts.map((s) => (
                  <div className="alert-row" key={s.id}>
                    <div className="person">
                      <div className="avatar peach">{initials(s.name)}</div>
                      <div>
                        <strong>{s.name}</strong>
                        <small>
                          {className(s.class_id)} •{" "}
                          {s.guardian || "Responsável não informado"}
                        </small>
                      </div>
                    </div>
                    <Badge tone="orange">
                      {absenceCount(store, s.id)} faltas
                    </Badge>
                    <div className="row-actions">
                      {s.guardian_phone && (
                        <a
                          className="secondary"
                          href={`tel:${s.guardian_phone.replace(/[^+\d]/g, "")}`}
                        >
                          <Phone size={16} /> Ligar
                        </a>
                      )}
                      <button
                        className="secondary"
                        onClick={() =>
                          setMessage({
                            title: "Contato por faltas",
                            phone: s.guardian_phone,
                            text: `Olá, ${s.guardian || "responsável"}! Aqui é da Wisdom. Sentimos falta de ${s.name} nas últimas aulas. Gostaríamos de entender o que aconteceu e ajudar no retorno. Podemos conversar?`,
                          })
                        }
                      >
                        <MessageCircle size={16} /> WhatsApp
                      </button>
                      <button
                        className="primary"
                        onClick={() => setModal({ kind: "contact", data: s })}
                      >
                        Registrar contato
                      </button>
                    </div>
                  </div>
                ))}
                {!alerts.length && (
                  <Empty text="Tudo acompanhado. Nenhum aluno com alerta de faltas." />
                )}
              </section>
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
          {page === "reports" && (
            <>
              <section className="panel report-filters">
                <Filter size={19} />
                <strong>Período dos relatórios</strong>
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
                        ...students.map((s) => {
                          const rows = reportAttendance.filter(
                            (a) => a.student_id === s.id,
                          );
                          return `${s.name} | ${className(s.class_id)} | Presenças: ${rows.filter((a) => a.status === "presente").length} | Faltas: ${rows.filter((a) => a.status === "falta").length} | Atrasos: ${rows.filter((a) => a.status === "atrasado").length} | Justificadas: ${rows.filter((a) => a.status === "justificado").length}`;
                        }),
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
                            `${p.skill} - Nível ${p.level}/5: ${p.notes}`,
                            `Intervenção: ${p.intervention || "—"}`,
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
                              attendanceMessage(store, l).split("\n"),
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
                              text: attendanceMessage(store, l),
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
          {page === "units" && profile.role === "coordenacao" && (
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
          {page === "settings" && (
            <>
              <div className="info-banner">
                <Settings size={23} />
                <div>
                  <strong>
                    {isDemo
                      ? "Explore os perfis de demonstração"
                      : "Acesso definido pelo perfil autenticado"}
                  </strong>
                  <p>
                    {isDemo
                      ? "A troca abaixo existe apenas na demonstração. Em produção, o banco aplica as permissões de cada usuário."
                      : "Professores e secretaria acessam sua unidade. A coordenação tem visão consolidada."}
                  </p>
                </div>
              </div>
              {isDemo && (
                <section className="panel settings-panel">
                  <h2>Testar um perfil</h2>
                  <div className="profile-options">
                    {store.profiles.map((p) => (
                      <button
                        key={p.id}
                        className={p.id === profile.id ? "selected" : ""}
                        onClick={() => {
                          setProfile(p);
                          setUnit(p.role === "coordenacao" ? "all" : p.unit_id);
                          setPage("overview");
                          setClassId("");
                          notify(`Visão de ${labels[p.role]} ativada.`);
                        }}
                      >
                        <div className="avatar">{initials(p.name)}</div>
                        <strong>{p.name}</strong>
                        <small>
                          {labels[p.role]} •{" "}
                          {store.units.find((u) => u.id === p.unit_id)?.name}
                        </small>
                      </button>
                    ))}
                  </div>
                  <p>
                    Para ativar o banco real, configure as variáveis do Supabase
                    conforme o README. Os dados de demonstração não são enviados
                    ao banco.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Restaurar os dados fictícios e apagar as alterações da demonstração?",
                        )
                      ) {
                        const data = demoStore();
                        setStore(data);
                        setProfile(data.profiles[0]);
                        setUnit("all");
                        notify("Demonstração restaurada.");
                      }
                    }}
                  >
                    Restaurar demonstração
                  </button>
                </section>
              )}
              {profile.role === "coordenacao" && (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Equipe e permissões</h2>
                      <p>
                        Cadastre primeiro o usuário em Supabase Authentication e
                        vincule seu UUID ao perfil.
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setModal({ kind: "profile" })}
                    >
                      <Plus size={17} /> Vincular usuário
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>NOME</th>
                          <th>PERFIL</th>
                          <th>UNIDADE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {store.profiles.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.name}</strong>
                            </td>
                            <td>
                              <Badge tone="neutral">{labels[p.role]}</Badge>
                            </td>
                            <td>
                              {
                                store.units.find((u) => u.id === p.unit_id)
                                  ?.name
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <span className="footer-mark">w</span> WISDOM <em> / </em> Gestão
              que transforma.
            </span>
            <span>Feito para acompanhar pessoas.</span>
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
      {modal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
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
                <span className="eyebrow">CUIDADO EM CADA DETALHE</span>
                <h2 id="modal-title">
                  {
                    (
                      {
                        student: modal.data
                          ? "Editar matrícula"
                          : "Nova matrícula",
                        class: modal.data ? "Editar turma" : "Nova turma",
                        unit: "Nova unidade",
                        archive: "Arquivar matrícula",
                        pedagogy: "Registro pedagógico",
                        contact: "Registrar contato",
                        profile: "Vincular usuário",
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
                  <div className="form-section-label">DADOS DO ALUNO</div>
                  <label>
                    Nome completo *
                    <input
                      name="name"
                      required
                      defaultValue={(modal.data as Student)?.name}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Nascimento
                      <input
                        name="birth_date"
                        type="date"
                        max={today()}
                        defaultValue={(modal.data as Student)?.birth_date}
                      />
                    </label>
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
                    Turma *
                    <select
                      name="class_id"
                      required
                      defaultValue={(modal.data as Student)?.class_id || ""}
                    >
                      <option value="" disabled>
                        Selecione a turma
                      </option>
                      {classes
                        .filter(
                          (c) =>
                            !modal.data || c.unit_id === modal.data.unit_id,
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
                    WhatsApp do responsável *
                    <input
                      type="tel"
                      name="guardian_phone"
                      required
                      placeholder="55 + DDD + número"
                      pattern="[+0-9 ()-]{10,20}"
                      defaultValue={(modal.data as Student)?.guardian_phone}
                    />
                  </label>
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
                  <small>
                    Para matrícula expressa, preencha os campos com *. A
                    secretaria pode completar o cadastro depois.
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
                          (p) =>
                            p.role === "professor" || p.role === "coordenacao",
                        )
                        .filter(
                          (p) =>
                            profile.role === "coordenacao" ||
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
                <>
                  <label>
                    Turma *
                    <select name="class_id" required>
                      {writableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Aluno (opcional)
                    <select name="student_id">
                      <option value="">Registro de toda a turma</option>
                      {active
                        .filter((s) =>
                          writableClasses.some((c) => c.id === s.class_id),
                        )
                        .map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.name} • {className(s.class_id)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      Tipo
                      <select name="kind">
                        <option>Diagnóstico</option>
                        <option>Evolução</option>
                        <option>Intervenção</option>
                      </select>
                    </label>
                    <label>
                      Nível atual (1 a 5)
                      <input
                        type="number"
                        name="level"
                        min="1"
                        max="5"
                        required
                        defaultValue="3"
                      />
                    </label>
                  </div>
                  <label>
                    Habilidade observada *
                    <input
                      name="skill"
                      required
                      placeholder="Ex.: raciocínio lógico, comunicação…"
                    />
                  </label>
                  <label>
                    Observações e evolução *<textarea name="notes" required />
                  </label>
                  <label>
                    Intervenção / próximo passo
                    <textarea name="intervention" />
                  </label>
                  <label>
                    Data para acompanhamento
                    <input type="date" name="follow_up" min={today()} />
                  </label>
                </>
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
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
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
                <span className="eyebrow">COMUNICAÇÃO COM CUIDADO</span>
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
              <textarea
                className="message-preview"
                aria-label="Mensagem para WhatsApp"
                value={message.text}
                onChange={(e) =>
                  setMessage({ ...message, text: e.target.value })
                }
              />
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
function Stat({
  label,
  value,
  icon,
  detail,
  color,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  detail: string;
  color: string;
}) {
  return (
    <section className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
function EnrollmentChart({ students }: { students: Student[] }) {
  const date = new Date();
  const months = Array.from(
    { length: 6 },
    (_, i) => new Date(date.getFullYear(), date.getMonth() - 5 + i, 1),
  );
  const rows = months.map((d) => {
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      total: students.filter((s) => s.enrollment_date.startsWith(prefix))
        .length,
      exits: students.filter(
        (s) => s.enrollment_date.startsWith(prefix) && s.status !== "ativo",
      ).length,
    };
  });
  const max = Math.max(4, ...rows.map((r) => r.total));
  return (
    <div className="chart">
      <div className="y-axis">
        {[
          max,
          Math.round(max * 0.75),
          Math.round(max * 0.5),
          Math.round(max * 0.25),
          0,
        ].map((n, i) => (
          <span key={i}>{n}</span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="grid-lines">
          {[0, 1, 2, 3, 4].map((n) => (
            <i key={n} />
          ))}
        </div>
        <div className="bars">
          {rows.map((r) => (
            <div className="bar-group" key={r.label}>
              <div className="bar-pair">
                <div
                  title={`${r.total} matrículas`}
                  className="bar main-bar"
                  style={{ height: (r.total / max) * 100 + "%" }}
                >
                  <span>{r.total}</span>
                </div>
                <div
                  title={`${r.exits} saídas atuais na coorte`}
                  className="bar exit-bar"
                  style={{ height: (r.exits / max) * 100 + "%" }}
                />
              </div>
              <span className="x-label">{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
