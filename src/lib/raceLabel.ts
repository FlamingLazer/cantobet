export function raceLabel(race: { week?: number | null; rung?: number | null; stage?: string | null }): string {
  if (race.stage) return race.stage
  return `W${race.week} · Rung ${race.rung}`
}
