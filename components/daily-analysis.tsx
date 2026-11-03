"use client";
import { useEffect, useState } from "react";
import { BarChart3, CalendarCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { displayDate } from "@/lib/domain";
interface Snapshot {
  unit_id: string;
  snapshot_date: string;
  active_students: number;
  new_enrollments: number;
  idle_classes: number;
  absent_count: number;
  incomplete_registrations: number;
  computed_at: string;
}
export function DailyAnalysis({
  unit,
  units,
}: {
  unit: string;
  units: { id: string; name: string }[];
}) {
  const [rows, setRows] = useState<Snapshot[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      let query = supabase
        .from("daily_analytics")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .order("unit_id")
        .limit(300);
      if (unit !== "all") query = query.eq("unit_id", unit);
      const { data, error } = await query;
      if (!active) return;
      setError(error ? "Não foi possível consultar a análise diária." : "");
      setRows(data || []);
    }
    void load();
    return () => {
      active = false;
    };
  }, [unit]);
  return (
    <section className="panel daily-analysis">
      <div className="panel-header">
        <div>
          <span className="index-label">ACOMPANHAMENTO AUTOMÁTICO</span>
          <h2>Análise diária das unidades</h2>
          <p>
            Indicadores consolidados pelo processamento diário. As datas de
            execução ficam registradas.
          </p>
        </div>
        <CalendarCheck size={24} />
      </div>
      {error ? (
        <div className="empty">
          <p>{error}</p>
        </div>
      ) : rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DATA / UNIDADE</th>
                <th>ATIVOS</th>
                <th>NOVAS MATRÍCULAS</th>
                <th>TURMAS OCIOSAS</th>
                <th>FALTAS NO DIA</th>
                <th>CADASTROS PENDENTES</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.unit_id + row.snapshot_date}>
                  <td>
                    <strong>{displayDate(row.snapshot_date)}</strong>
                    <small>
                      {units.find((u) => u.id === row.unit_id)?.name}
                    </small>
                  </td>
                  <td>{row.active_students}</td>
                  <td>{row.new_enrollments}</td>
                  <td>{row.idle_classes}</td>
                  <td>{row.absent_count}</td>
                  <td>{row.incomplete_registrations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <BarChart3 size={27} />
          <p>A primeira análise aparecerá após a execução da rotina diária.</p>
        </div>
      )}
    </section>
  );
}
