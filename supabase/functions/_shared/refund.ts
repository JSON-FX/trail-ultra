import { serviceClient } from "./supabase.ts";

export type RefundResult =
  | { ok: true; registration_id: string; already?: boolean }
  | { ok: false; error: string; status: number };

/** Refund a paid registration: flip payment + registration to 'refunded' and
 *  release the category slot. Idempotent — a second call on an already-refunded
 *  registration is a no-op. Caller authorization is the endpoint's responsibility. */
export async function refundRegistration(
  registrationId: string,
  refundedBy: string,
  note: string | null = null,
): Promise<RefundResult> {
  const db = serviceClient();
  const { data: reg } = await db
    .from("registrations")
    .select("id,category_id,status")
    .eq("id", registrationId)
    .single();
  if (!reg) return { ok: false, error: "not_found", status: 404 };
  if (reg.status === "refunded") return { ok: true, registration_id: reg.id, already: true };
  if (reg.status !== "paid") return { ok: false, error: "not_refundable", status: 409 };

  // PayMongo refund call goes here at the swap point (no-op for the fake provider).
  const { data: pay } = await db.from("payments").select("raw").eq("registration_id", reg.id).single();
  const raw = { ...((pay?.raw as Record<string, unknown>) ?? {}), refunded_at: new Date().toISOString(), refunded_by: refundedBy, note };

  await db.from("payments").update({ status: "refunded", raw }).eq("registration_id", reg.id);
  await db.from("registrations").update({ status: "refunded" }).eq("id", reg.id);
  await db.rpc("decrement_slot", { p_category_id: reg.category_id });

  return { ok: true, registration_id: reg.id };
}
