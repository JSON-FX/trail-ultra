import { supabase } from "./supabase";
import type { RegistrationInput } from "@trail-ultra/shared";

export type CheckoutResult = { registration_id: string; checkout_url: string };

export async function startCheckout(input: RegistrationInput): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke("registrations-checkout", { body: input });
  if (error) throw new Error(error.message ?? "Checkout failed");
  if (!data || (data as { error?: string }).error) {
    throw new Error((data as { error?: string })?.error ?? "Checkout failed");
  }
  return data as CheckoutResult;
}
