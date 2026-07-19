import { serviceClient } from "./supabase.ts";
import { mintTicketToken } from "./ticket.ts";

export type ConfirmResult =
  | { ok: true; registration_id: string; already?: boolean }
  | { ok: false; error: string; status: number };

/** Mark a registration paid, mint its signed ticket, and increment the slot.
 *  Idempotent: a second call on an already-paid registration is a no-op. */
export async function confirmPayment(
  registrationId: string,
  method: string,
  raw: unknown = {},
): Promise<ConfirmResult> {
  const db = serviceClient();
  const { data: reg } = await db
    .from("registrations")
    .select("id,event_id,category_id,total_amount,status,organizations(commission_rate)")
    .eq("id", registrationId)
    .single();
  if (!reg) return { ok: false, error: "not_found", status: 404 };
  if (reg.status === "paid") return { ok: true, registration_id: reg.id, already: true };

  const rate = (reg.organizations as { commission_rate: number } | null)?.commission_rate ?? 0.10;
  const fee = Math.round(reg.total_amount * rate);
  const net = reg.total_amount - fee;

  const secret = Deno.env.get("TICKET_SIGNING_SECRET") ?? "dev-secret";
  const token = await mintTicketToken(
    { rid: reg.id, eid: reg.event_id, iat: Math.floor(Date.now() / 1000) },
    secret,
  );

  await db.from("payments").update({
    status: "paid", method, platform_fee: fee, net_to_org: net, raw,
  }).eq("registration_id", reg.id);
  await db.from("registrations").update({ status: "paid", ticket_token: token }).eq("id", reg.id);
  await db.rpc("increment_slot", { p_category_id: reg.category_id });

  return { ok: true, registration_id: reg.id };
}
