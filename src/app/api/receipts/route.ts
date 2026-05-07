import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/server/auth";
import { prisma } from "@/server/prisma";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  let orgId: string;
  try {
    ({ orgId } = await requireAuth());
  } catch (e) {
    return authErrorResponse(e);
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const form = await req.formData();
  const expenseId = String(form.get("expenseId") ?? "").trim();
  const file = form.get("file");

  if (!expenseId || !(file instanceof File)) {
    return NextResponse.json(
      { error: "expenseId and file required" },
      { status: 400 },
    );
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, orgId },
    select: { id: true },
  });
  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "Unsupported file type (use JPG, PNG, WebP)" },
      { status: 400 },
    );
  }

  const ext =
    mime === "image/jpeg"
      ? ".jpg"
      : mime === "image/png"
        ? ".png"
        : mime === "image/webp"
          ? ".webp"
          : ".bin";

  const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const relativeDir = path.join("public", "uploads", "receipts", orgId);
  const filename = `${safeBase}${ext}`;
  const diskPath = path.join(process.cwd(), relativeDir, filename);

  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, buf);

  const storageKey = `/uploads/receipts/${orgId}/${filename}`.replace(/\\/g, "/");

  const receipt = await prisma.receipt.create({
    data: {
      orgId,
      expenseId,
      storageKey,
      contentType: mime,
      fileSize: buf.length,
      ocrStatus: "pending",
      storageProvider: "local",
      extractedJson: {
        pipeline: "placeholder",
        note: "Wire OCR provider here — store extracted merchant/date/amount when ready.",
      },
    },
    select: {
      id: true,
      storageKey: true,
      contentType: true,
      fileSize: true,
      ocrStatus: true,
      uploadedAt: true,
    },
  });

  return NextResponse.json({ receipt }, { status: 201 });
}
