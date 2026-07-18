import { supabase } from "../lib/supabase";

describe("supabase client", () => {
  it("is configured with auth + from()", () => {
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(typeof supabase.from).toBe("function");
  });
});
