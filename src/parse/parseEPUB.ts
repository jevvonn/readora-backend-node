import { randomUUID } from "crypto";
import Epub from "epub";
import * as fs from "fs";

import { stripHtml } from "string-strip-html";
import type { ParsedFile } from "../type.js";

const parseEpub = (file: File) =>
  new Promise<ParsedFile>(async (resolve, reject) => {
    const arrBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrBuf);
    const uniqueId = randomUUID();
    const fileName = `./tmp/${uniqueId}.epub`;
    fs.writeFileSync(fileName, buffer);

    const epub = new Epub(fileName);
    epub.on("end", async () => {
      try {
        let coverId = "";
        for (const id in epub.manifest) {
          //@ts-ignore
          const item = epub.manifest[id];
          if (
            item["media-type"]?.startsWith("image/") &&
            /cover/i.test(item.id || item.href)
          ) {
            coverId = id;
            break;
          }
        }

        // Extract Cover Image
        const coverImage: Buffer | null = await new Promise((res, rej) => {
          epub.getImage(coverId, (err, data) => {
            if (err) rej(err);
            else res(data);
          });
        });

        if (!coverImage) {
          return reject(new Error("Failed to extract cover"));
        }

        // Extract Chapters
        const chapterPromises: Promise<{
          chapterId: string;
          text: string;
        }>[] = epub.flow.map(
          (chapter) =>
            new Promise((res, rej) => {
              epub.getChapter(chapter.id, (err, text) => {
                if (err) rej(err);
                else
                  res({
                    chapterId: chapter.id,
                    text: stripHtml(text).result.replace(/\s+/g, " ").trim(),
                  });
              });
            })
        );

        const texts = await Promise.all(chapterPromises);

        if (!texts.length) {
          return reject(new Error("Failed to parse chapters"));
        }

        const fileImage = new File([coverImage], `${uniqueId}.jpeg`, {
          type: "image/jpeg",
        });

        fs.unlinkSync(fileName);
        resolve({
          texts: JSON.stringify(texts),
          fileImage,
        });
      } catch (error) {
        reject(error);
      }
    });

    epub.parse();
  });

export default parseEpub;
