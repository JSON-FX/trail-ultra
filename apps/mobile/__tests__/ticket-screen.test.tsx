import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ registrationId: "r1abc999" }),
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock("react-native-qrcode-svg", () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => {
    const { Text } = require("react-native");
    return <Text>QR:{value}</Text>;
  },
}));
jest.mock("../lib/ticketCache", () => ({ getCachedTicket: jest.fn().mockResolvedValue(null), cacheTicket: jest.fn() }));

// Note: the brief's draft inlined this object literal directly in the mock factory. Every
// render then produced a brand-new `data` reference, so the screen's `useEffect(..., [reg.data])`
// (which calls setCached) re-fired on every render and infinite-looped ("Maximum update depth
// exceeded", ~4300 iterations before the process SIGABRT'd). Real react-query keeps `data`
// referentially stable across renders via structural sharing, so this never happens in
// production — the mock must model that stability. Hoisting to a `mock`-prefixed const (same
// idiom already used in pay-screen.test.tsx's `mockRegData` for this exact reason) fixes it.
const mockRegData = { id: "r1abc999", status: "paid", ticket_token: "tok.sig", eventName: "Apo Sky Ultra 2026", categoryLabel: "21K", org_id: "o1" };
jest.mock("../lib/registration", () => ({
  useRegistration: () => ({ data: mockRegData, isLoading: false }),
}));

import Ticket from "../app/ticket/[registrationId]";

describe("Ticket screen", () => {
  it("renders the event, category, and a QR of the ticket token", async () => {
    render(<Ticket />);
    expect(await screen.findByText("Apo Sky Ultra 2026")).toBeOnTheScreen();
    expect(screen.getByText("21K")).toBeOnTheScreen();
    expect(screen.getByText("QR:tok.sig")).toBeOnTheScreen();
  });
});
