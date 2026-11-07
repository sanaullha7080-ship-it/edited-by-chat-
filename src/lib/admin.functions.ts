import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

type AdminSession = { admin?: boolean };

function sessionConfig() {
  return {
    password: process.env["ADMIN_SESSION_SECRET"]!,
    name: "admin-session",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function hashesMatch(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireAdmin() {
  const session = await useSession<AdminSession>(sessionConfig());
  if (!session.data.admin) throw new Error("NOT_AUTHENTICATED");
  return session;
}

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  return { authenticated: Boolean(session.data.admin) };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("admin_config")
      .select("password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (error || !row) return { ok: false as const };
    if (!hashesMatch(sha256(data.password), row.password_hash)) return { ok: false as const };
    const session = await useSession<AdminSession>(sessionConfig());
    await session.update({ admin: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const changeAdminPassword = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(4) }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { data: row } = await db
      .from("admin_config")
      .select("password_hash")
      .eq("id", 1)
      .maybeSingle();
    if (!row || !hashesMatch(sha256(data.currentPassword), row.password_hash)) {
      return { ok: false as const, error: "Current password is incorrect" };
    }
    const { error } = await db
      .from("admin_config")
      .update({ password_hash: sha256(data.newPassword), updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const getAdminSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const db = await admin();
  const { data, error } = await db
    .from("payment_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const saveAdminSettings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      phone_number: z.string().min(1),
      account_name: z.string().min(1),
      account_label: z.string().min(1),
      amount: z.number().min(0),
      whatsapp_link: z.string(),
      logo_url: z.string().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();
    const { data: existing } = await db
      .from("payment_settings")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await db
        .from("payment_settings")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return { ok: false as const, error: error.message };
    } else {
      const { error } = await db.from("payment_settings").insert(data);
      if (error) return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

export const listScreenshots = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const db = await admin();
  const { data, error } = await db
    .from("payment_screenshots")
    .select("id, storage_path, user_phone, amount, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const items = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await db.storage
        .from("payment-screenshots")
        .createSignedUrl(row.storage_path, 60 * 60);
      return { ...row, url: signed?.signedUrl ?? null };
    }),
  );
  return items;
});

export const deleteScreenshot = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = await admin();

    const query = db.from("payment_screenshots").select("id, storage_path");
    const { data: rows } = data.all ? await query : await query.eq("id", data.id!);
    const paths = (rows ?? []).map((r) => r.storage_path);
    if (paths.length) {
      await db.storage.from("payment-screenshots").remove(paths);
      await db
        .from("payment_screenshots")
        .delete()
        .in(
          "id",
          (rows ?? []).map((r) => r.id),
        );
    }
    return { ok: true as const, deleted: paths.length };
  });
