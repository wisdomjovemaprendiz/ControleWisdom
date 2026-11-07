import { occupancyInfo } from "@/lib/class-appearance";
export function OccupancyBar({
  enrolled,
  capacity,
}: {
  enrolled: number;
  capacity: number;
}) {
  const state = occupancyInfo(enrolled, capacity);
  return (
    <span
      className={`occupancy-meter ${state.tone}`}
      style={
        { "--occupancy-color": state.color } as import("react").CSSProperties
      }
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, state.percent)}
      aria-label={`Ocupação: ${enrolled} de ${capacity} alunos. ${state.label}`}
      title={`${state.percent}% · ${state.label}`}
    >
      <span style={{ width: `${Math.min(100, state.percent)}%` }} />
    </span>
  );
}
export function OccupancyLegend() {
  return (
    <div className="occupancy-legend" aria-label="Legenda de ocupação">
      <span>
        <i style={{ background: "#C43B43" }} />
        Abaixo de 40%
      </span>
      <span>
        <i style={{ background: "#B98517" }} />
        40–69%
      </span>
      <span>
        <i style={{ background: "#63962E" }} />
        70–89%
      </span>
      <span>
        <i style={{ background: "#218361" }} />
        90–100%
      </span>
    </div>
  );
}
