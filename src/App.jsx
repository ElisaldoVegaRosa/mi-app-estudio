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
  BarChart,
  Bar,
} from "recharts";
import { Calendar, CheckCircle2, Clock, XCircle, Upload, Database } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { auth, db } from "./firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

/* =========================
   Generador de plan (seed)
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
        });
        sessions.push({
          id: `${w}-${d}-pm`,
          date,
          start: "19:00",
          end: "20:00",
          topic: "Estudio",
          status: "planned",
        });
      } else {
        sessions.push({
          id: `${w}-${d}-pm`,
          date,
          start: "19:00",
          end: "20:00",
          topic: "Estudio",
          status: "planned",
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
   Barra de filtros
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
function Header({ progress, projection }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl sm:text-3xl font-extrabold"
      >
        Seguimiento de Estudio v1.3
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
          Tendencia: <b>{projection.statusLabel}</b>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Panel de hoy
   ========================= */
function TodayPanel({ sessions, onUpdate }) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter((s) => s.date === today);

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-2">
        <Calendar size={18} /> Hoy — {today}
      </h2>

      {todaySessions.length > 0 ? (
        todaySessions.map((s) => (
          <div
            key={s.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg mb-2"
          >
            <div>
              <div className="font-medium">{s.topic}</div>
              <div className="text-sm text-gray-500">
                {timeRangeShort(s.start, s.end)} · Plan: 60 min
              </div>
            </div>

            <div className="flex gap-2 mt-2 sm:mt-0">
              <Button
                variant="outline"
                className="border-green-500 text-green-600"
                onClick={() => onUpdate(s.id, "done")}
              >
                <CheckCircle2 size={16} className="mr-1" />
                Hecho
              </Button>

              <Button variant="outline">
                <Clock size={16} className="mr-1" />
                Cronómetro
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
        ))
      ) : (
        <p className="text-sm text-gray-500">
          No hay sesiones planificadas hoy.
        </p>
      )}
    </Card>
  );
}

/* =========================
   Próximas 10 (filtradas)
   ========================= */
function UpcomingList({ sessions, onUpdate }) {
  const upcoming = sessions.slice(0, 10);

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
            <div key={s.id} className="border rounded-lg p-2 flex flex-col gap-1">
              <div className="text-sm font-medium">
                {new Date(s.date).toDateString()} · {timeRangeShort(s.start, s.end)}
              </div>
              <div className="text-xs text-gray-500">{s.topic} · 60 min</div>

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
                  className="border-red-500 text-red-600"
                  onClick={() => onUpdate(s.id, "missed")}
                  variant="outline"
                >
                  Omitir
                </Button>
              </div>
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
        Real: sessions.slice(0, i + 1).filter((x) => x.status === "done")
          .length,
      })),
    [sessions]
  );

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
        📈 Acumulado de horas — Plan vs Real
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

function WeeklyBarChart({ sessions }) {
  // agrupar por semana calendario (ISO week)
  const weekKey = (isoDate) => {
    const d = new Date(isoDate + "T00:00:00");
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  };

  const grouped = useMemo(() => {
    const acc = {};
    sessions.forEach((s) => {
      const k = weekKey(s.date);
      acc[k] ??= { week: k, hechas: 0, total: 0 };
      acc[k].total += 1;
      if (s.status === "done") acc[k].hechas += 1;
    });
    return Object.values(acc).sort((a, b) => (a.week < b.week ? -1 : 1));
  }, [sessions]);

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-3">📊 Avance semanal</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={grouped}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="total" fill="#93c5fd" name="Total" />
          <Bar dataKey="hechas" fill="#22c55e" name="Hechas" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/* =========================
   Semana en curso
   ========================= */
function WeekCard({ sessions, onUpdate }) {
  const grouped = useMemo(() => {
    const acc = {};
    for (const s of sessions) (acc[s.date] ??= []).push(s);
    return Object.fromEntries(
      Object.entries(acc).sort(([a], [b]) => (a < b ? -1 : 1))
    );
  }, [sessions]);

  const first7 = Object.entries(grouped).slice(0, 7);

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
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-2 rounded border"
                >
                  <div className="text-xs leading-tight truncate">
                    <div className="font-medium">
                      {timeRangeShort(s.start, s.end)}
                    </div>
                    <div className="text-gray-500">{s.topic}</div>
                  </div>

                  <Switch
                    checked={s.status === "done"}
                    onCheckedChange={(v) =>
                      onUpdate(s.id, v ? "done" : "planned")
                    }
                  />
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
   Configuración + Subida seed
   ========================= */
function Settings({ setState, user }) {
  const [weeks, setWeeks] = useState(24);
  const fileRef = useRef(null);

  const regenerateLocal = () =>
    setState((s) => ({ ...s, sessions: seedPlan(Math.max(1, weeks)) }));

  // Exportar/Importar local (opcional)
  const exportJSON = () => {
    try {
      const data = localStorage.getItem("sessions");
      const payload = data ? JSON.parse(data) : [];
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
      alert("❌ No se pudo exportar el JSON.");
    }
  };
  const importJSON = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("El archivo no es un array.");
      const ok = data.every(
        (x) =>
          x &&
          typeof x.id === "string" &&
          typeof x.date === "string" &&
          typeof x.start === "string" &&
          typeof x.end === "string" &&
          typeof x.topic === "string" &&
          typeof x.status === "string"
      );
      if (!ok) throw new Error("Formato inválido.");
      localStorage.setItem("sessions", JSON.stringify(data));
      setState((s) => ({ ...s, sessions: data }));
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

  // 🔼 SUBIR PLAN INICIAL A LA NUBE
  const uploadSeedPlanToCloud = async () => {
    try {
      if (!user?.uid) {
        alert("Primero necesitas estar autenticado (anónimo).");
        return;
      }
      const confirm = window.confirm(
        `Se crearán ~${weeks * 7}–${weeks * 14} sesiones en tu nube.\n¿Continuar?`
      );
      if (!confirm) return;

      const seed = seedPlan(Math.max(1, weeks));
      const batch = writeBatch(db);
      const sessionsCol = collection(db, "users", user.uid, "sessions");

      seed.forEach((s) => {
        const ref = doc(sessionsCol, s.id);
        batch.set(ref, { ...s, createdAt: serverTimestamp() });
      });

      await batch.commit();
      alert("✅ Plan inicial subido a Firestore. La app se sincronizará sola.");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo subir el plan. Revisa la consola.");
    }
  };

  // Vaciar nube (cuidado)
  const clearCloud = async () => {
    try {
      if (!user?.uid) return;
      const sure = window.confirm(
        "Esto borrará TODAS tus sesiones en la nube. ¿Continuar?"
      );
      if (!sure) return;

      const qCol = collection(db, "users", user.uid, "sessions");
      const q = query(qCol, orderBy("date", "asc"));
      const unsubDocs = await new Promise((resolve) => {
        const rows = [];
        const unsub = onSnapshot(
          q,
          (snap) => {
            snap.docs.forEach((d) => rows.push(d));
            resolve({ rows, unsub });
          },
          () => resolve({ rows: [], unsub })
        );
      });
      const { rows, unsub } = unsubDocs;
      unsub?.();

      const batch = writeBatch(db);
      rows.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      alert("✅ Nube vaciada.");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo vaciar.");
    }
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

          <Button onClick={regenerateLocal}>
            <Database size={16} className="mr-2" />
            Regenerar local
          </Button>

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

        <div className="flex items-center gap-3">
          <Button onClick={uploadSeedPlanToCloud} className="bg-blue-600">
            <Upload size={16} className="mr-2" />
            Subir plan inicial a la nube
          </Button>

          <Button variant="outline" className="border-red-500 text-red-600" onClick={clearCloud}>
            Vaciar nube
          </Button>
        </div>

        <p className="text-xs text-gray-500">
          Tus datos se guardan automáticamente en Firestore (y cache local).
          El botón “Subir plan inicial a la nube” genera un plan base y lo crea
          en <code>users/&lt;uid&gt;/sessions</code>.
        </p>
      </div>
    </Card>
  );
}

/* =========================
   App principal (sync nube)
   ========================= */
export default function App() {
  const [user, setUser] = useState(null);
  const [state, setState] = useState({ sessions: [] });

  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  // Sign-in anónimo + suscripción
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        await signInAnonymously(auth);
        return;
      }
      setUser(u);

      const qCol = collection(db, "users", u.uid, "sessions");
      const qy = query(qCol, orderBy("date", "asc"));
      const unsubData = onSnapshot(qy, (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setState({ sessions: rows });
        localStorage.setItem("sessions", JSON.stringify(rows));
      });
      return () => unsubData();
    });
    return () => unsubAuth();
  }, []);

  // Actualizar una sesión (nube + local cache)
  const updateSession = async (id, status) => {
    try {
      if (!user?.uid) return;
      const ref = doc(db, "users", user.uid, "sessions", id);
      await setDoc(ref, { status }, { merge: true });

      setState((s) => ({
        ...s,
        sessions: s.sessions.map((ss) =>
          ss.id === id ? { ...ss, status } : ss
        ),
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const filteredSessions = useMemo(
    () => applyFilters(state.sessions, filterStatus, search),
    [state.sessions, filterStatus, search]
  );

  const progress = useMemo(() => {
    const total = state.sessions.length || 1;
    const done = state.sessions.filter((s) => s.status === "done").length;
    return {
      plannedSessions: total,
      doneSessions: done,
      percent: (done / total) * 100,
    };
  }, [state.sessions]);

  const projection = useMemo(
    () => ({
      statusLabel: progress.percent >= 50 ? "Adelantado (+h)" : "Atrasado (-h)",
    }),
    [progress.percent]
  );

  return (
    <div className="p-4 space-y-4">
      <Header progress={progress} projection={projection} />

      <FiltersBar
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        search={search}
        setSearch={setSearch}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <TodayPanel sessions={state.sessions} onUpdate={updateSession} />
          <ProgressChart sessions={state.sessions} />
          <WeeklyBarChart sessions={state.sessions} />
          <WeekCard sessions={filteredSessions} onUpdate={updateSession} />
        </div>

        <div className="space-y-4">
          <UpcomingList sessions={filteredSessions} onUpdate={updateSession} />
          <Settings setState={setState} user={user} />
        </div>
      </div>

      <footer className="text-xs text-center text-gray-500 mt-4">
        v1.3 · Firestore + caché local · Optimizado para móvil y laptop
      </footer>
    </div>
  );
}
