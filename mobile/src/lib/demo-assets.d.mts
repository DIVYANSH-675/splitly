export function decodeDemoFile(value: string): Uint8Array<ArrayBuffer>;
export function encodeDemoFile(value: Uint8Array): string;
export function sampleFile(body: Record<string, unknown>): { id: string; name: string; mime: string; size: number };
