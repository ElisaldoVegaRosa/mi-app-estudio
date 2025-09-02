import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Pencil,
  Save,
  X,
  Play,
  Pause,
  Square,
  StickyNote,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* =========================
   Datos iniciales (seed)
   ========================= */
const seedPlan = (weeks = 24) => {
  const sessions = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const date = day.toISOString().slice(0, 10);

      if (day.getDay() === 0 || day.getDay() === 6) {
        sessions.push({
          id: `${w}-${d}-am`,
          date,
          start: "09:00",
          end: "11:00",
          topic: "Proyecto / Portafolio",
          status: "planned",
          realMinutes: 0,
          note: "",
        });
      } else {
        sessions.push({
          id: `${w}-${d}-pm`,
          date,
          start: "19:00",
          end: "20:00",
          topic: "Estudio",
          status: "planned",
          realMinutes: 0,
          note: "",
        });
      }
    }
  }
  return sessions;
};

/* =========================
   Utilidades
   ========================= */
const timeRangeShort = (start, end) => {
  const fmt = (t24) => {
    const [h, m] = t24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""} ${ampm}`;
  };
  return `${fmt(start)} — ${fmt(end)}`;
};
const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

const formatClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

const minutesBetween = (start, end) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let a = sh * 60 + sm;
  let b = eh * 60 + em;
  if (b <= a) b += 24 * 60;
  return b - a;
};

function getWeekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Dom ... 6=Sáb
  const diffToMonday = (day + 6) % 7; // Lunes=0
  d.setDate(d.getDate() - diffToMonday);
  return d.toISOString().slice(0, 10); // lunes de esa semana
}

/* =========================
   Filtros (estado + búsqueda)
   ========================= */
function FiltersBar({ filterStatus, setFilterStatus, search, setSearch }) {
  const Btn = ({ value, label }) => {
    const active = filterStatus === value;
    return (
      <button
        onClick={() => setFilterStatus(value)}
        className={
          "px-3 py-1 rounded-full border text-sm transition " +
          (active
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white text-gray-700 hover:bg-gray-50")
        }
      >
        {label}
      </button>
    );
  };

  return (
    <Card className="p-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium mr-1">Filtros:</span>
          <Btn value="all" label="Todas" />
          <Btn value="planned" label="Pendientes" />
          <Btn value="done" label="Hechas" />
          <Btn value="missed" label="Omitidas" />
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tema (p. ej., Inglés, Python...)"
            className="w-full md:w-72 border rounded px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            onClick={() => setSearch("")}
            className="text-gray-600"
          >
            Limpiar
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* =========================
   Header
   ========================= */
function Header({ progress, projection, weekly }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl sm:text-3xl font-extrabold"
      >
        Seguimiento de Estudio v1.6
      </motion.h1>

      <div className="grid grid-cols-2 sm:flex gap-2 text-sm">
        <div className="px-3 py-2 rounded-full bg-blue-50 border text-sm">
          Planificado: <b>{progress.plannedSessions}</b>
        </div>
        <div className="px-3 py-2 rounded-full bg-green-50 border text-sm">
          Completado: <b>{progress.doneSessions}</b>
        </div>
        <div className="px-3 py-2 rounded-full bg-indigo-50 border text-sm">
          % Avance: <b>{progress.percent.toFixed(0)}%</b>
        </div>
        <div className="px-3 py-2 rounded-full bg-amber-50 border text-sm">
          Semana: <b>{weekly.real} / {weekly.goal} min</b>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Fila editable (incluye nota)
   ========================= */
function EditableRow({ s, onSave, onCancel }) {
  const [topic, setTopic] = useState(s.topic);
  const [start, setStart] = useState(s.start);
  const [end, setEnd] = useState(s.end);
  const [note, setNote] = useState(s.note || "");
  const [err, setErr] = useState("");

  const save = () => {
    if (!topic.trim()) return setErr("El tema no puede estar vacío.");
    if (!isValidTime(start) || !isValidTime(end)) {
      return setErr("Formato de hora inválido. Usa HH:MM (24h).");
    }
    setErr("");
    onSave({ topic: topic.trim(), start, end, note: note.trim() });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          className="border rounded px-2 py-1 text-sm"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Tema (p. ej., Inglés, Python/SQL...)"
        />
        <input
          className="border rounded px-2 py-1 text-sm"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="Inicio (HH:MM)"
        />
        <input
          className="border rounded px-2 py-1 text-sm"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          placeholder="Fin (HH:MM)"
        />
      </div>
      <div>
        <textarea
          className="border rounded px-2 py-1 text-sm w-full"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota breve de la sesión (opcional)"
        />
      </div>
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save}>
          <Save size={14} className="mr-1" />
          Guardar
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X size={14} className="mr-1" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/* =========================
   Panel de Hoy (cronómetro + nota)
   ========================= */
function TodayPanel({ sessions, onUpdate, onEdit, timer, startTimer, pauseTimer, resumeTimer, stopTimer }) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter((s) => s.date === today);

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-2">
        <Calendar size={18} /> Hoy — {today}
      </h2>

      {todaySessions.length > 0 ? (
        todaySessions.map((s) => (
          <TodayRow
            key={s.id}
            s={s}
            onUpdate={onUpdate}
            onEdit={onEdit}
            timer={timer}
            startTimer={startTimer}
            pauseTimer={pauseTimer}
            resumeTimer={resumeTimer}
            stopTimer={stopTimer}
          />
        ))
      ) : (
        <p className="text-sm text-gray-500">No hay sesiones planificadas hoy.</p>
      )}
    </Card>
  );
}

function TodayRow({ s, onUpdate, onEdit, timer, startTimer, pauseTimer, resumeTimer, stopTimer }) {
  const [editing, setEditing] = useState(false);

  const isActive = timer?.sessionId === s.id;
  const running = isActive && timer?.running;
  const elapsed = isActive ? timer.elapsedMs + (running ? Date.now() - timer.startTs : 0) : 0;

  return (
    <div className="p-3 border rounded-lg mb-2">
      {!editing ? (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium truncate">{s.topic}</div>
            <div className="text-sm text-gray-500">
              {timeRangeShort(s.start, s.end)} · Plan: {minutesBetween(s.start, s.end)} min · Real: {Math.round(s.realMinutes || 0)} min
            </div>
            {s.note && (
              <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                <StickyNote size={14} /> {s.note}
              </div>
            )}
            {isActive && (
              <div className="text-xs mt-1">
                ⏱️ Cronómetro: <b>{formatClock(elapsed)}</b> {running ? "(en curso)" : "(pausado)"}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!isActive && (
              <Button variant="outline" onClick={() => startTimer(s.id)}>
                <Play size={16} className="mr-1" /> Iniciar
              </Button>
            )}
            {isActive && running && (
              <Button variant="outline" onClick={pauseTimer}>
                <Pause size={16} className="mr-1" /> Pausar
              </Button>
            )}
            {isActive && !running && (
              <Button variant="outline" onClick={resumeTimer}>
                <Play size={16} className="mr-1" /> Reanudar
              </Button>
            )}
            {isActive && (
              <Button
                variant="outline"
                className="border-green-500 text-green-600"
                onClick={() => stopTimer(true)}
              >
                <Square size={16} className="mr-1" /> Finalizar
              </Button>
            )}

            <Button
              variant="outline"
              className="border-blue-500 text-blue-600"
              onClick={() => setEditing(true)}
            >
              <Pencil size={16} className="mr-1" />
              Editar
            </Button>

            <Button
              variant="outline"
              className="border-green-500 text-green-600"
              onClick={() => onUpdate(s.id, "done")}
            >
              <CheckCircle2 size={16} className="mr-1" />
              Hecho
            </Button>

            <Button
              variant="outline"
              className="border-red-500 text-red-600"
              onClick={() => onUpdate(s.id, "missed")}
            >
              <XCircle size={16} className="mr-1" />
              Omitir
            </Button>
          </div>
        </div>
      ) : (
        <EditableRow
          s={s}
          onSave={(patch) => {
            onEdit(s.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/* =========================
   Filtros de vista
   ========================= */
const applyFilters = (sessions, filterStatus, search) => {
  let result = sessions;
  if (filterStatus !== "all") {
    result = result.filter((s) => s.status === filterStatus);
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter((s) => s.topic.toLowerCase().includes(q));
  }
  return result;
};

/* =========================
   Próximas 10 sesiones (con nota)
   ========================= */
function UpcomingList({ sessions, onUpdate, onEdit }) {
  const upcoming = sessions.slice(0, 10);
  const [editingId, setEditingId] = useState(null);

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
        <Calendar size={18} />
        Próximas 10 sesiones
      </h2>

      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-500">Sin resultados con los filtros.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upcoming.map((s) => (
            <div key={s.id} className="border rounded-lg p-2 flex flex-col gap-2">
              {editingId !== s.id ? (
                <>
                  <div className="text-sm font-medium">
                    {new Date(s.date).toDateString()} · {timeRangeShort(s.start, s.end)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.topic} · Plan: {minutesBetween(s.start, s.end)} min · Real: {Math.round(s.realMinutes || 0)} min
                  </div>
                  {s.note && (
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <StickyNote size={14} /> {s.note}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="border-green-500 text-green-600"
                      onClick={() => onUpdate(s.id, "done")}
                      variant="outline"
                    >
                      Hecho
                    </Button>
                    <Button
                      size="sm"
                      className="border-blue-500 text-blue-600"
                      onClick={() => setEditingId(s.id)}
                      variant="outline"
                    >
                      <Pencil size={14} className="mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      className="border-red-500 text-red-600"
                      onClick={() => onUpdate(s.id, "missed")}
                      variant="outline"
                    >
                      Omitir
                    </Button>
                  </div>
                </>
              ) : (
                <EditableRow
                  s={s}
                  onSave={(patch) => {
                    onEdit(s.id, patch);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* =========================
   Gráficos
   ========================= */
function ProgressChart({ sessions }) {
  const data = useMemo(
    () =>
      sessions.map((s, i) => ({
        name: i + 1,
        Plan: i + 1,
        Real: sessions.slice(0, i + 1).filter((x) => x.status === "done").length,
      })),
    [sessions]
  );

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
        📈 Acumulado de sesiones — Plan vs Real
      </h2>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Plan" stroke="#6478f2" dot={false} />
          <Line type="monotone" dataKey="Real" stroke="#22c55e" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

function SummaryChart({ sessions }) {
  const total = sessions.length;
  const done = sessions.filter((s) => s.status === "done").length;
  const missed = sessions.filter((s) => s.status === "missed").length;
  const pending = total - done - missed;

  const data = [
    { name: "Completadas", value: done, color: "#22c55e" },
    { name: "Omitidas", value: missed, color: "#ef4444" },
    { name: "Pendientes", value: pending, color: "#3b82f6" },
  ];

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-3">📊 Resumen general de sesiones</h2>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={88}
            dataKey="value"
            label={({ name, value }) => (value > 0 ? `${name}: ${value}` : "")}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

function WeeklyProgress({ sessions }) {
  const byWeek = useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
      const w = getWeekStart(s.date);
      if (!map.has(w)) map.set(w, { total: 0, done: 0 });
      const slot = map.get(w);
      slot.total += 1;
      if (s.status === "done") slot.done += 1;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([week, v]) => ({
        week,
        percent: v.total ? Math.round((v.done / v.total) * 100) : 0,
        done: v.done,
        total: v.total,
      }));
  }, [sessions]);

  const last = byWeek.slice(0, 10);

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-3">📅 Progreso por semana</h2>
      <div className="space-y-3">
        {last.map((w) => (
          <div key={w.week}>
            <div className="flex justify-between text-sm mb-1">
              <span>Semana de {w.week}</span>
              <span>
                {w.done}/{w.total} · {w.percent}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-3 bg-green-500"
                style={{ width: `${w.percent}%` }}
              />
            </div>
          </div>
        ))}
        {last.length === 0 && (
          <p className="text-sm text-gray-500">No hay datos para calcular semanas.</p>
        )}
      </div>
    </Card>
  );
}

function TopicSummary({ sessions }) {
  const rows = useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
      const key = s.topic || "Sin tema";
      const planned = minutesBetween(s.start, s.end);
      const real = Math.round(s.realMinutes || 0);
      if (!map.has(key)) map.set(key, { topic: key, planned: 0, real: 0 });
      const row = map.get(key);
      row.planned += planned;
      row.real += real;
    }
    return Array.from(map.values())
      .sort((a, b) => b.planned - a.planned)
      .slice(0, 8);
  }, [sessions]);

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-3">🧠 Resumen por tema (minutos)</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Aún no hay temas registrados.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="topic" hide />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="planned" name="Planificado (min)" fill="#3b82f6" />
            <Bar dataKey="real" name="Real (min)" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      )}
      <div className="mt-3 text-xs text-gray-500">
        * Planificado se calcula con la diferencia entre <code>Inicio</code> y <code>Fin</code> de cada sesión.
      </div>
    </Card>
  );
}

/* =========================
   Objetivo semanal (nuevo)
   ========================= */
function WeeklyGoalBar({ goal, real, onChangeGoal }) {
  const pct = goal > 0 ? Math.min(100, Math.round((real / goal) * 100)) : 0;
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-3">🎯 Objetivo semanal</h2>

      <div className="flex items-center gap-3 mb-2">
        <label className="text-sm">
          Meta (min/semana):
          <input
            type="number"
            min={0}
            className="ml-2 border p-1 rounded w-24"
            value={goal}
            onChange={(e) => onChangeGoal(Math.max(0, Number(e.target.value)))}
          />
        </label>
        <div className="text-sm text-gray-600">
          Real: <b>{real}</b> min · Cumplido: <b>{pct}%</b>
        </div>
      </div>

      <div className="w-full h-3 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-3 bg-indigo-500"
          style={{ width: `${pct}%` }}
          title={`${pct}%`}
        />
      </div>
    </Card>
  );
}

/* =========================
   Semana en curso (filtrada + editar)
   ========================= */
function WeekCard({ sessions, onUpdate, onEdit }) {
  const grouped = useMemo(() => {
    const acc = {};
    for (const s of sessions) {
      (acc[s.date] ??= []).push(s);
    }
    return Object.fromEntries(
      Object.entries(acc).sort(([a], [b]) => (a < b ? -1 : 1))
    );
  }, [sessions]);

  const first7 = Object.entries(grouped).slice(0, 7);
  const [editingId, setEditingId] = useState(null);

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
        <Calendar size={18} /> Semana en curso
      </h2>

      {first7.length === 0 ? (
        <p className="text-sm text-gray-500">Sin resultados con los filtros.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {first7.map(([date, items]) => (
            <div key={date} className="border rounded-lg p-2 flex flex-col gap-2">
              <div className="font-medium text-sm">{date}</div>

              {items.map((s) => (
                <div key={s.id} className="p-2 rounded border">
                  {editingId !== s.id ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs leading-tight truncate">
                        <div className="font-medium">{timeRangeShort(s.start, s.end)}</div>
                        <div className="text-gray-500">
                          {s.topic} · Plan: {minutesBetween(s.start, s.end)} min · Real: {Math.round(s.realMinutes || 0)} min
                        </div>
                        {s.note && (
                          <div className="text-[11px] text-gray-600 mt-1 flex items-center gap-1">
                            <StickyNote size={12} /> {s.note}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={s.status === "done"}
                          onCheckedChange={(v) => onUpdate(s.id, v ? "done" : "planned")}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-500 text-blue-600"
                          onClick={() => setEditingId(s.id)}
                        >
                          <Pencil size={14} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <EditableRow
                      s={s}
                      onSave={(patch) => {
                        onEdit(s.id, patch);
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* =========================
   Configuración (Export/Import)
   ========================= */
function Settings({ setState, weeklyGoal, setWeeklyGoal }) {
  const [weeks, setWeeks] = useState(24);
  const fileRef = useRef(null);

  const regenerate = () =>
    setState((s) => ({ ...s, sessions: seedPlan(Math.max(1, weeks)) }));

  const clearAll = () => {
    localStorage.removeItem("sessions");
    setState((s) => ({ ...s, sessions: seedPlan(24) }));
  };

  const exportJSON = () => {
    try {
      const sessions = localStorage.getItem("sessions");
      const storedGoal = localStorage.getItem("weeklyGoal");
      const payload = {
        sessions: sessions ? JSON.parse(sessions) : [],
        weeklyGoal: storedGoal ? Number(storedGoal) : 0,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 10);
      a.download = `plan-estudio-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert("✅ Exportado correctamente.");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo exportar.");
    }
  };

  const importJSON = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Permite importar formato nuevo (objeto) o antiguo (array)
      if (Array.isArray(data)) {
        // Formato viejo
        localStorage.setItem("sessions", JSON.stringify(data));
        setState((s) => ({ ...s, sessions: data }));
      } else if (data && Array.isArray(data.sessions)) {
        localStorage.setItem("sessions", JSON.stringify(data.sessions));
        setState((s) => ({ ...s, sessions: data.sessions }));
        if (typeof data.weeklyGoal === "number") {
          localStorage.setItem("weeklyGoal", String(data.weeklyGoal));
          setWeeklyGoal(data.weeklyGoal);
        }
      } else {
        throw new Error("Estructura JSON no reconocida.");
      }

      alert("✅ Importado correctamente.");
    } catch (e) {
      console.error(e);
      alert("❌ Archivo inválido o corrupto.");
    }
  };

  const onPickFile = () => fileRef.current?.click();
  const onChangeFile = (e) => {
    const file = e.target.files?.[0];
    if (file) importJSON(file);
    e.target.value = "";
  };

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
        ⚙️ Configuración
      </h2>

      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-3">
          <label className="text-sm">
            Semanas:
            <input
              type="number"
              min={1}
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="ml-2 border p-1 rounded w-20"
            />
          </label>

          <Button onClick={regenerate}>Regenerar plan</Button>

          <Button
            variant="outline"
            className="border-red-500 text-red-600"
            onClick={clearAll}
          >
            Vaciar datos
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm">
            🎯 Meta semanal (min):
            <input
              type="number"
              min={0}
              className="ml-2 border p-1 rounded w-24"
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <div className="text-xs text-gray-500">
            * También puedes ajustarla en la tarjeta “Objetivo semanal”.
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={exportJSON}>
            Exportar JSON
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={onChangeFile}
          />
          <Button variant="outline" onClick={onPickFile}>
            Importar JSON
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* =========================
   App principal
   ========================= */
export default function App() {
  // Carga inicial
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem("sessions");
    const base = saved ? JSON.parse(saved) : seedPlan(24);
    return { sessions: base.map((s) => ({ realMinutes: 0, note: "", ...s })) };
  });

  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    const g = localStorage.getItem("weeklyGoal");
    return g ? Number(g) : 300; // por defecto 300 min/semana (5h)
  });

  // Filtros
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  // Cronómetro
  const [timer, setTimer] = useState(() => {
    const raw = localStorage.getItem("activeTimer");
    return raw ? JSON.parse(raw) : null;
  });

  // Ticker UI
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!timer?.running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer?.running]);

  // Persistencias
  useEffect(() => {
    localStorage.setItem("sessions", JSON.stringify(state.sessions));
  }, [state.sessions]);
  useEffect(() => {
    localStorage.setItem("weeklyGoal", String(weeklyGoal));
  }, [weeklyGoal]);
  useEffect(() => {
    if (timer) localStorage.setItem("activeTimer", JSON.stringify(timer));
    else localStorage.removeItem("activeTimer");
  }, [timer]);

  // Acciones: estado / edición / nota / cronómetro
  const updateSession = (id, status) => {
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((ss) => (ss.id === id ? { ...ss, status } : ss)),
    }));
  };
  const editSessionFields = (id, patch) => {
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((ss) => (ss.id === id ? { ...ss, ...patch } : ss)),
    }));
  };

  const startTimer = (sessionId) => {
    if (timer?.running) {
      const elapsed = timer.elapsedMs + (Date.now() - timer.startTs);
      setTimer({ ...timer, running: false, elapsedMs: elapsed });
    }
    setTimer({ sessionId, startTs: Date.now(), elapsedMs: 0, running: true });
  };
  const pauseTimer = () => {
    if (!timer || !timer.running) return;
    const elapsed = timer.elapsedMs + (Date.now() - timer.startTs);
    setTimer({ ...timer, running: false, elapsedMs: elapsed });
  };
  const resumeTimer = () => {
    if (!timer || timer.running) return;
    setTimer({ ...timer, running: true, startTs: Date.now() });
  };
  const stopTimer = (markDone = true) => {
    if (!timer) return;
    const totalMs = timer.elapsedMs + (timer.running ? Date.now() - timer.startTs : 0);
    const addMinutes = Math.max(0, Math.round(totalMs / 60000));
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((ss) =>
        ss.id === timer.sessionId
          ? {
              ...ss,
              realMinutes: Math.max(0, Math.round((ss.realMinutes || 0) + addMinutes)),
              status: markDone ? "done" : ss.status,
            }
          : ss
      ),
    }));
    setTimer(null);
  };

  // Filtros de vista
  const filteredSessions = useMemo(
    () => applyFilters(state.sessions, filterStatus, search),
    [state.sessions, filterStatus, search]
  );

  // Métricas globales
  const progress = useMemo(() => {
    const total = state.sessions.length || 1;
    const done = state.sessions.filter((s) => s.status === "done").length;
    return {
      plannedSessions: total,
      doneSessions: done,
      percent: (done / total) * 100,
    };
  }, [state.sessions]);

  // Meta semanal: minutos reales de la semana actual
  const weekly = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = getWeekStart(today);
    const real = state.sessions
      .filter((s) => getWeekStart(s.date) === weekStart)
      .reduce((acc, s) => acc + Math.round(s.realMinutes || 0), 0);
    return { goal: weeklyGoal, real };
  }, [state.sessions, weeklyGoal]);

  const projection = useMemo(
    () => ({ statusLabel: progress.percent >= 50 ? "Adelantado (+h)" : "Atrasado (-h)" }),
    [progress.percent]
  );

  return (
    <div className="p-4 space-y-4">
      <Header progress={progress} projection={projection} weekly={weekly} />

      <FiltersBar
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        search={search}
        setSearch={setSearch}
      />

      <WeeklyGoalBar
        goal={weeklyGoal}
        real={weekly.real}
        onChangeGoal={setWeeklyGoal}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna izquierda (ancha) */}
        <div className="lg:col-span-2 space-y-4">
          <TodayPanel
            sessions={state.sessions}
            onUpdate={updateSession}
            onEdit={editSessionFields}
            timer={timer}
            startTimer={startTimer}
            pauseTimer={pauseTimer}
            resumeTimer={resumeTimer}
            stopTimer={stopTimer}
          />
          <ProgressChart sessions={state.sessions} />
          <SummaryChart sessions={state.sessions} />
          <WeeklyProgress sessions={state.sessions} />
          <TopicSummary sessions={state.sessions} />
          <WeekCard
            sessions={filteredSessions}
            onUpdate={updateSession}
            onEdit={editSessionFields}
          />
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          <UpcomingList
            sessions={filteredSessions}
            onUpdate={updateSession}
            onEdit={editSessionFields}
          />
          <Settings
            setState={setState}
            weeklyGoal={weeklyGoal}
            setWeeklyGoal={setWeeklyGoal}
          />
        </div>
      </div>

      <footer className="text-xs text-center text-gray-500 mt-4">
        v1.6 · Notas por sesión · Objetivo semanal · Datos locales
      </footer>
    </div>
  );
}
