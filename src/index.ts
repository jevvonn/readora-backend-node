import { Hono } from "hono";
import { cors } from "hono/cors";
import dotenv from "dotenv";
import { serve } from "@hono/node-server";
import supClient from "./pkg/supabase.js";
import parseEpub from "./parse/parseEPUB.js";
import parsePDF from "./parse/parsePDF.js";
import type { ParsedFile } from "./type.js";
import fs from "fs";

dotenv.config();

const app = new Hono();

app.use("/service/*", cors());

if (!fs.existsSync("./tmp")) {
  fs.mkdirSync("./tmp");
}

// Book parsing endpoint
app.post("/service/books/parse", async (c) => {
  let filePublicUrl: string | null = null;
  let coverPublicUrl: string | null = null;

  try {
    const body = await c.req.formData();

    if (!body.has("file") || !body.has("bookId")) {
      return c.json(
        { message: "Missing required fields: file and bookId" },
        422
      );
    }

    const fileData = body.get("file");
    if (typeof fileData === "string") {
      return c.json({ message: "File must be a file object, not string" }, 422);
    }

    const file = fileData as File;
    console.log("File type:", file.type);
    if (
      file.type !== "application/pdf" &&
      file.type !== "application/epub+zip" &&
      file.type !== "application/zip"
    ) {
      return c.json({ message: "File must be a PDF or EPUB file" }, 422);
    }

    const bookId = body.get("bookId");
    if (typeof bookId !== "string") {
      return c.json({ message: "bookId must be a string" }, 422);
    }

    // Parse file based on type
    let parsed: ParsedFile | null = null;
    try {
      if (file.type === "application/pdf") {
        parsed = await parsePDF(file);
      } else {
        parsed = await parseEpub(file);
      }
    } catch (error) {
      console.error("Parsing error:", error);
      return c.json({ message: "Failed to parse file" }, 500);
    }

    if (!parsed) {
      return c.json({ message: "File parsing returned no results" }, 500);
    }

    // Upload text content
    try {
      const fileName = `${bookId}.txt`;
      const { error: textUploadError } = await supClient.storage
        .from("texts")
        .upload(fileName, JSON.stringify(parsed.texts), {
          contentType: "text/plain",
          upsert: true,
        });

      if (textUploadError) {
        throw textUploadError;
      }

      const { data: textData } = supClient.storage
        .from("texts")
        .getPublicUrl(fileName);
      filePublicUrl = textData.publicUrl;
    } catch (error) {
      console.error("Text upload error:", error);
      return c.json({ message: "Failed to upload text content" }, 500);
    }

    // Upload cover image
    try {
      const fileName = `${bookId}.jpeg`;
      const { error: imageUploadError } = await supClient.storage
        .from("images")
        .upload(fileName, parsed.fileImage, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (imageUploadError) {
        throw imageUploadError;
      }

      const { data: imageData } = supClient.storage
        .from("images")
        .getPublicUrl(fileName);
      coverPublicUrl = imageData.publicUrl;
    } catch (error) {
      console.error("Cover upload error:", error);
      return c.json({ message: "Failed to upload cover image" }, 500);
    }

    // Return success with URLs
    return c.json(
      {
        message: "File uploaded and processed successfully",
        filePublicUrl,
        coverPublicUrl,
      },
      200
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return c.json(
      {
        message: "Request body is not properly formatted, it must be form-data",
      },
      422
    );
  }
});

// Start server
serve(
  {
    fetch: app.fetch,
    port: Number(process.env.APP_PORT) || 3001,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
