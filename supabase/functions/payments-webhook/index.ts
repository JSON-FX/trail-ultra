import { confirmPayment } from "../_shared/confirm.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Dev/fake webhook: confirms a payment by registration_id.
// When PayMongo is wired, this parses + verifies the provider signature, then calls confirmPayment.
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const registrationId = body.registration_id as string | undefined;
    if (!registrationId) return json({ error: "registration_id_required" }, 400);

    const r = await confirmPayment(registrationId, body.method ?? "gcash", body);
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ ok: true, registration_id: r.registration_id, already: r.already });
  } catch (e) {
    return json({ error: "server_error", details: String(e) }, 500);
  }
});
