import type { Data } from "./model";
import { completedSets, volume } from "./model";
export function trainingSummary(data: Data, input: unknown) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length
  )
    throw new Error("Gunakan objek kosong tanpa parameter.");
  return {
    sessions: data.sessions.length,
    completedSets: data.sessions.reduce((n, s) => n + completedSets(s), 0),
    volumeKg: data.sessions.reduce((n, s) => n + volume(s), 0),
    activeSession: data.draft
      ? { name: data.draft.name, completedSets: completedSets(data.draft) }
      : null,
  };
}
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export function registerSummary(getData: () => Data) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: Tool,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: "get_training_summary",
          title: "Ringkasan latihan",
          description:
            "Membaca jumlah sesi selesai, total set, volume latihan, dan ringkasan draf milik pengguna pada halaman ini. Tidak mengubah data.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input) => trainingSummary(getData(), input),
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {}
  return () => lifecycle.abort();
}
