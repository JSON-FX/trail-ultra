import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMarketplaceEvents } from "../lib/events";

const mockOrder = jest.fn().mockResolvedValue({
  data: [{ id: "e1", org_id: "o1", name: "Apo Sky Ultra 2026", status: "open", gallery: null, organizations: { name: "Run With Point", brand_color: "#159A55" } }],
  error: null,
});
const mockSelect = jest.fn(() => ({ order: mockOrder }));
jest.mock("../lib/supabase", () => ({ supabase: { from: jest.fn(() => ({ select: mockSelect })) } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useMarketplaceEvents", () => {
  it("fetches all events and flattens org name + color + gallery default", async () => {
    const { result } = renderHook(() => useMarketplaceEvents(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({ id: "e1", org_name: "Run With Point", org_color: "#159A55", gallery: [] });
  });
});
