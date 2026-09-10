// src/workers/xlsxWorker.ts
/// <reference lib="webworker" />
import * as XLSX from "xlsx";

type SheetPreview = {
    name: string;
    rows: (string | number | null)[][];
};

type WorkerRequest = {
    buffer: ArrayBuffer;
};

type WorkerResponse =
    | { type: "success"; sheets: SheetPreview[] }
    | { type: "error"; message: string };

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
    try {
        const { buffer } = event.data;

        // Leggiamo il workbook dall'ArrayBuffer
        const workbook = XLSX.read(buffer, { type: "array" });

        const sheets: SheetPreview[] = workbook.SheetNames.map((sheetName) => {
            const sheet = workbook.Sheets[sheetName];

            const rawRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
                header: 1,
            }) as (string | number | null)[][];

            const maxCols =
                rawRows.length > 0 ? Math.max(...rawRows.map((r) => r.length)) : 0;

            const rows = rawRows.map((row) => {
                if (row.length < maxCols) {
                    return [...row, ...Array(maxCols - row.length).fill(null)];
                }
                return row;
            });

            return {
                name: sheetName,
                rows,
            };
        });

        const response: WorkerResponse = { type: "success", sheets };
        ctx.postMessage(response);
    } catch (err: any) {
        console.error("Worker XLSX – errore:", err);
        const response: WorkerResponse = {
            type: "error",
            message:
                err?.message ||
                "Si è verificato un errore durante il parsing del file Excel nel worker.",
        };
        ctx.postMessage(response);
    }
};
