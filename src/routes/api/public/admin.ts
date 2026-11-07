import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-admin-password",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function hashesMatch(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const Route = createFileRoute("/api/public/admin")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const password = request.headers.get("x-admin-password") ?? "";
        if (!password) return json({ error: "Admin password required" }, 401);

        const db = await getDb();
        const { data: cfg } = await db
          .from("admin_config")
          .select("password_hash")
          .eq("id", 1)
          .maybeSingle();
        if (!cfg || !hashesMatch(sha256(password), cfg.password_hash)) {
          return json({ error: "Unauthorized" }, 401);
        }

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const action = String(body["action"] ?? "");

        if (action === "check") return json({ ok: true });

        if (action === "get-settings") {
          const { data, error } = await db
            .from("payment_settings")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) return json({ error: error.message }, 500);
          return json(data ?? {});
        }

        if (action === "save-settings") {
          const patch = {
            phone_number: String(body["phone_number"] ?? ""),
            account_name: String(body["account_name"] ?? ""),
            account_label: String(body["account_label"] ?? ""),
            amount: Number(body["amount"] ?? 0),
            whatsapp_link: String(body["whatsapp_link"] ?? ""),
            logo_url: (body["logo_url"] as string | null) ?? null,
            updated_at: new Date().toISOString(),
          };
          const { data: existing } = await db
            .from("payment_settings")
            .select("id")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const { error } = existing
            ? await db.from("payment_settings").update(patch).eq("id", existing.id)
            : await db.from("payment_settings").insert(patch);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        if (action === "list-screenshots") {
          const { data, error } = await db
            .from("payment_screenshots")
            .select("id, storage_path, user_phone, amount, created_at")
            .order("created_at", { ascending: false })
            .limit(200);
          if (error) return json({ error: error.message }, 500);
          const items = await Promise.all(
            (data ?? []).map(async (row) => {
              const { data: signed } = await db.storage
                .from("payment-screenshots")
                .createSignedUrl(row.storage_path, 60 * 60);
              return { ...row, public_url: signed?.signedUrl ?? "" };
            }),
          );
          return json({ items });
        }

        if (action === "delete-screenshot") {
          const query = db.from("payment_screenshots").select("id, storage_path");
          const { data: rows } = body["deleteAll"]
            ? await query
            : await query.eq("id", String(body["id"] ?? ""));
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
          return json({ ok: true, deleted: paths.length });
        }

        if (action === "change-password") {
          const next = String(body["newPassword"] ?? "");
          if (next.length < 4) return json({ error: "New password too short" }, 400);
          const { error } = await db
            .from("admin_config")
            .update({ password_hash: sha256(next), updated_at: new Date().toISOString() })
            .eq("id", 1);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        return json({ error: "Unknown action" }, 400);
      },
    },
  },
});
