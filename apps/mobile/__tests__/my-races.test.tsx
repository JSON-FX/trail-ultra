import { render, screen, fireEvent } from "@testing-library/react-native";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../lib/org", () => ({ useOrg: () => ({ selectedOrgId: "o1" }) }));
jest.mock("../lib/ticketCache", () => ({ cacheMyRaces: jest.fn() }));
jest.mock("../lib/registration", () => ({
  useMyRegistrations: () => ({
    data: [
      { id: "r1", status: "paid", ticket_token: "a.b", eventName: "Apo Sky Ultra 2026", categoryLabel: "21K", org_id: "o1", total_amount: 150000 },
      { id: "r2", status: "pending", ticket_token: null, eventName: "Apo Sky Ultra 2026", categoryLabel: "10K", org_id: "o1", total_amount: 100000 },
    ],
    isLoading: false, isError: false, refetch: jest.fn(),
  }),
}));

import MyRaces from "../app/(tabs)/races";

describe("My Races", () => {
  it("lists entries with status and routes to ticket (paid) or pay (pending)", () => {
    render(<MyRaces />);
    expect(screen.getByText("Paid")).toBeOnTheScreen();
    expect(screen.getByText("Pending")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("21K"));
    expect(mockPush).toHaveBeenCalledWith("/ticket/r1");
    fireEvent.press(screen.getByText("10K"));
    expect(mockPush).toHaveBeenCalledWith("/pay/r2");
  });
});
