import { serviceClient } from "../_shared/supabase.ts";
import { mintTicketToken } from "../_shared/ticket.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Dev/fake webhook: confirms a payment by registration_id.
// When PayMongo is wired, this parses + verifies the provider signature instead.
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const registrationId = body.registration_id as string | undefined;
    if (!registrationId) return json({ error: "registration_id_required" }, 400);

    const db = serviceClient();
    const { data: reg } = await db
      .from("registrations")
      .select("id,event_id,category_id,total_amount,status,organizations(commission_rate)")
      .eq("id", registrationId)
      .single();
    if (!reg) return json({ error: "not_found" }, 404);
    if (reg.status === "paid") return json({ ok: true, already: true });

    const rate = (reg.organizations as { commission_rate: number } | null)?.commission_rate ?? 0.10;
    const fee = Math.round(reg.total_amount * rate);
    const net = reg.total_amount - fee;

    const secret = Deno.env.get("TICKET_SIGNING_SECRET") ?? "dev-secret";
    const token = await mintTicketToken(
      { rid: reg.id, eid: reg.event_id, iat: Math.floor(Date.now() / 1000) },
      secret,
    );

    await db.from("payments").update({
      status: "paid", method: body.method ?? "gcash", platform_fee: fee, net_to_org: net, raw: body,
    }).eq("registration_id", reg.id);
    await db.from("registrations").update({ status: "paid", ticket_token: token }).eq("id", reg.id);
    await db.rpc("increment_slot", { p_category_id: reg.category_id });

    return json({ ok: true, registration_id: reg.id });
  } catch (e) {
    return json({ error: "server_error", details: String(e) }, 500);
  }
});
