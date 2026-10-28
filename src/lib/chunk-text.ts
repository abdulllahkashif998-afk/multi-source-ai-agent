export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 100
): string[] {
  if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new Error("Invalid chunk settings");
  }

  const chunks: string[] = [];
  const normalized = text.trim();

  if (!normalized) return chunks;

  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const section = normalized.slice(start, end);
      const boundary = Math.max(
        section.lastIndexOf("\n\n"),
        section.lastIndexOf(". "),
        section.lastIndexOf(" ")
      );

      if (boundary > chunkSize / 2) {
        end = start + boundary + 1;
      }
    }

    chunks.push(normalized.slice(start, end).trim());

    if (end === normalized.length) break;

    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}