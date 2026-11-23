export interface ShellStatus {
  readonly api: "up" | "down";
}

/** Placeholder shell until the first screens land (003, Dig). */
export function shellHtml(status: ShellStatus): string {
  const apiText = status.api === "up" ? "Backend reachable" : "Backend unreachable";
  return `<main>
  <h1>Riviera Dig</h1>
  <p>Foundation build. Screens arrive with the first features.</p>
  <p role="status">${apiText}</p>
</main>`;
}

/** Maps a `/api/healthz` fetch outcome to the shell status. */
export async function probeApi(fetchFn: typeof fetch): Promise<ShellStatus> {
  try {
    const res = await fetchFn("/api/healthz");
    return { api: res.ok ? "up" : "down" };
  } catch {
    return { api: "down" };
  }
}
