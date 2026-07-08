import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfPages(
  pdfBytes: ArrayBuffer
): Promise<{ pages: string[]; totalPages: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return { pages: text, totalPages };
}
