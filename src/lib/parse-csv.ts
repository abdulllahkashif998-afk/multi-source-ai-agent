import { parse } from "csv-parse/sync";

export function parseCSV(content: string) {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[];
}