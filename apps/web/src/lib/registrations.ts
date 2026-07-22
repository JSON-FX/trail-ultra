import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type RegistrationRow = {
  id: string;
  user_id: string;
  category_id: string;
  category_label: string | null;
  full_name: string | null;
  bib_name: string | null;
  total_amount: number;
  payment_status: PaymentStatus | null;
  payment_method: string | null;
  created_at: string;
  custom_data: Record<string, unknown>;
  addons: { name: string | null; price: number }[];
};

// PostgREST returns an embedded to-one either as an object or a 1-element array
// depending on how it detects the relationship — normalize to the object.
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Record<string, unknown> | undefined;

export function useEventRegistrations(eventId?: string) {
  return useQuery<RegistrationRow[]>({
    queryKey: ["event-registrations", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("id,user_id,category_id,total_amount,created_at,custom_data,categories(label),payments(status,method),registration_addons(price,addons(name))")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const regs = (data ?? []) as Record<string, unknown>[];

      const ids = [...new Set(regs.map((r) => r.user_id as string))];
      let profiles: Record<string, { full_name: string | null; bib_name: string | null }> = {};
      if (ids.length) {
        const { data: profs, error: pErr } = await supabase.from("profiles").select("id,full_name,bib_name").in("id", ids);
        if (pErr) throw pErr;
        profiles = Object.fromEntries((profs ?? []).map((p: Record<string, unknown>) => [p.id as string, { full_name: (p.full_name as string) ?? null, bib_name: (p.bib_name as string) ?? null }]));
      }

      return regs.map((r): RegistrationRow => {
        const cat = one(r.categories);
        const pay = one(r.payments);
        const addons = ((r.registration_addons as Record<string, unknown>[]) ?? []).map((a) => ({ name: (one(a.addons)?.name as string) ?? null, price: a.price as number }));
        return {
          id: r.id as string,
          user_id: r.user_id as string,
          category_id: r.category_id as string,
          category_label: (cat?.label as string) ?? null,
          full_name: profiles[r.user_id as string]?.full_name ?? null,
          bib_name: profiles[r.user_id as string]?.bib_name ?? null,
          total_amount: r.total_amount as number,
          payment_status: (pay?.status as PaymentStatus) ?? null,
          payment_method: (pay?.method as string) ?? null,
          created_at: r.created_at as string,
          custom_data: (r.custom_data as Record<string, unknown>) ?? {},
          addons,
        };
      });
    },
  });
}

export function useEventRegistrationCounts(orgId?: string) {
  return useQuery<Record<string, number>>({
    queryKey: ["event-registration-counts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("registrations").select("event_id").eq("org_id", orgId!).order("event_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of (data ?? []) as { event_id: string }[]) counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
      return counts;
    },
  });
}

/** Issue a full refund via the admin-refund Edge Function. */
export async function refundRegistration(registrationId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.functions.invoke("admin-refund", { body: { registration_id: registrationId, note: note ?? null } });
  if (error) return { ok: false, error: "Refund failed. Please try again." };
  return { ok: true };
}

export type PaymentRow = {
  registration_id: string;
  event_id: string | null;
  event_name: string | null;
  user_id: string | null;
  full_name: string | null;
  amount: number;
  platform_fee: number;
  net_to_org: number;
  method: string | null;
  status: PaymentStatus;
  created_at: string;
};

export function usePayments(orgId?: string) {
  return useQuery<PaymentRow[]>({
    queryKey: ["org-payments", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("registration_id,amount,platform_fee,net_to_org,method,status,created_at,registrations(event_id,user_id,events(name))")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];

      const ids = [...new Set(rows.map((r) => one(r.registrations)?.user_id as string).filter(Boolean))];
      let profiles: Record<string, string | null> = {};
      if (ids.length) {
        const { data: profs, error: pErr } = await supabase.from("profiles").select("id,full_name").in("id", ids);
        if (pErr) throw pErr;
        profiles = Object.fromEntries((profs ?? []).map((p: Record<string, unknown>) => [p.id as string, (p.full_name as string) ?? null]));
      }

      return rows.map((r): PaymentRow => {
        const rg = one(r.registrations);
        const ev = one(rg?.events);
        const uid = (rg?.user_id as string) ?? null;
        return {
          registration_id: r.registration_id as string,
          event_id: (rg?.event_id as string) ?? null,
          event_name: (ev?.name as string) ?? null,
          user_id: uid,
          full_name: uid ? profiles[uid] ?? null : null,
          amount: r.amount as number,
          platform_fee: r.platform_fee as number,
          net_to_org: r.net_to_org as number,
          method: (r.method as string) ?? null,
          status: r.status as PaymentStatus,
          created_at: r.created_at as string,
        };
      });
    },
  });
}
