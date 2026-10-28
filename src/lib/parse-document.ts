import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export async function parseDocument(
  buffer: Buffer,
  extension: string
): Promise<string> {
  if (extension === ".pdf") {
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({
      buffer,
    });

    return result.value.trim();
  }

  throw new Error("Unsupported document type");
}