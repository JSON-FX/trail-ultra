import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../../test/env";

const { url, anonKey, serviceKey } = loadEnv();
const anon = () => createClient(url, anonKey, { auth: { persistSession: false } });
const service = () => createClient(url, serviceKey, { auth: { persistSession: false } });
const authed = (token: string) =>
  createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });

async function makeUser(email: string) {
  const svc = service();
  const created = await svc.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  const signedIn = await anon().auth.signInWithPassword({ email, password: "password123" });
  return { id: created.data.user!.id, token: signedIn.data.session!.access_token };
}
const RWP = "00000000-0000-0000-0000-0000000000a1";

describe("user_roles RLS", () => {
  it("a user reads only their own role rows", async () => {
    const svc = service();
    const alice = await makeUser(`ur_alice_${Date.now()}@test.dev`);
    const bob = await makeUser(`ur_bob_${Date.now()}@test.dev`);
    await svc.from("user_roles").insert([
      { user_id: alice.id, role: "admin", org_id: RWP },
      { user_id: bob.id, role: "admin", org_id: RWP },
    ]);

    const { data } = await authed(alice.token).from("user_roles").select("user_id, role");
    expect(data).toEqual([{ user_id: alice.id, role: "admin" }]);

    await svc.from("user_roles").delete().in("user_id", [alice.id, bob.id]);
  });
});
