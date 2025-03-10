import { pdfToPages } from "pdf-ts";
import { pdf as pdfToImages } from "pdf-to-img";
import Tesseract from "tesseract.js";
import type { ParsedFile } from "../type.js";
import { randomUUID } from "crypto";

export default async function parsePDF(file: File): Promise<ParsedFile> {
  const arrBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrBuf);

  const pages = await pdfToPages(buffer);
  const document = await pdfToImages(buffer, {
    scale: 3,
  });

  let texts: Array<{
    page: number;
    text: string;
  }> = [];

  const coverImage: Buffer<ArrayBufferLike> = await document.getPage(1);

  for (const page of pages) {
    if (page.text.trim() != "") {
      console.log("Page: ", page.page, " found text");
      texts.push({
        page: page.page,
        text: page.text.replace(/\s+/g, " ").trim(),
      });
    } else {
      console.log("Page: ", page.page, " not found text, using OCR");
      const image = await document.getPage(page.page);
      const reconize = await Tesseract.recognize(image, undefined);

      texts.push({
        page: page.page,
        text: reconize.data.text.replace(/\s+/g, " ").trim(),
      });
    }
  }

  const uniqueId = randomUUID();
  const fileImage = new File([coverImage], `${uniqueId}.jpeg`, {
    type: "image/jpeg",
  });

  return {
    texts: JSON.stringify(texts),
    fileImage,
  };
}
