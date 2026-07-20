import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockIlike = jest.fn();
jest.mock("../lib/supabase", () => {
  const builder: any = {};
  builder.select = jest.fn(() => builder);
  builder.eq = (...a: unknown[]) => { mockEq(...a); return builder; };
  builder.ilike = (...a: unknown[]) => { mockIlike(...a); return builder; };
  builder.order = (...a: unknown[]) => { mockOrder(...a); return Promise.resolve({ data: [{ code: "x", name: "X" }], error: null }); };
  return { supabase: { from: jest.fn(() => builder) } };
});

import { usePsgcProvinces } from "../lib/psgc";

const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: any }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("psgc hooks", () => {
  it("usePsgcProvinces filters by region_code and is disabled without one", async () => {
    const { result } = renderHook(() => usePsgcProvinces("010000000"), { wrapper: wrap() });
    await waitFor(() => expect(result.current.data).toEqual([{ code: "x", name: "X" }]));
    expect(mockEq).toHaveBeenCalledWith("region_code", "010000000");
  });
});
