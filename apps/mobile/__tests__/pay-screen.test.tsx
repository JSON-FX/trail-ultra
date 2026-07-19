import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

// Note: the brief's draft used bare `replace`/`openAuth`/`regData` consts closed over by
// jest.mock() factories. babel-plugin-jest-hoist statically rejects any out-of-scope
// identifier in a mock factory unless it's prefixed with `mock` (case-insensitive) — so
// these are renamed to the `mock`-prefixed idiom already used in register-submit.test.tsx.
const mockReplace = jest.fn();
const mockOpenAuth = jest.fn().mockResolvedValue({ type: "dismiss" });
jest.mock("expo-web-browser", () => ({ openAuthSessionAsync: (...a: unknown[]) => mockOpenAuth(...a) }));
jest.mock("expo-linking", () => ({ createURL: (p: string) => `trailultra://${p}` }));
jest.mock("../lib/ticketCache", () => ({ cacheTicket: jest.fn() }));

let mockRegData: any = {
  id: "r1", status: "pending", total_amount: 210000, ticket_token: null, org_id: "o1",
  eventName: "Apo Sky Ultra 2026", categoryLabel: "21K", checkoutUrl: "http://x/functions/v1/fake-checkout?rid=r1",
};
jest.mock("../lib/registration", () => ({ useRegistration: () => ({ data: mockRegData, refetch: jest.fn() }) }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ registrationId: "r1" }),
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
}));

import Pay from "../app/pay/[registrationId]";

describe("Pay screen", () => {
  it("opens the sandbox checkout with the return url appended, without trusting the result", async () => {
    render(<Pay />);
    fireEvent.press(screen.getByText("Pay now"));
    await waitFor(() => expect(mockOpenAuth).toHaveBeenCalled());
    const [full, redirect] = mockOpenAuth.mock.calls[0];
    expect(full).toContain("http://x/functions/v1/fake-checkout?rid=r1");
    expect(full).toContain("return=");
    expect(redirect).toBe("trailultra://pay-callback");
    // still shows the pending state (not "confirmed") because status is still pending
    expect(screen.getByText("Waiting for payment confirmation…")).toBeOnTheScreen();
  });

  it("shows Confirmed + View ticket when the registration is paid", () => {
    mockRegData = { ...mockRegData, status: "paid", ticket_token: "a.b" };
    render(<Pay />);
    expect(screen.getByText("Payment confirmed")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("View ticket"));
    expect(mockReplace).toHaveBeenCalledWith("/ticket/r1");
  });
});
