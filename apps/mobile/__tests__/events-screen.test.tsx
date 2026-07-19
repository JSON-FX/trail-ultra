import { render, screen, fireEvent } from "@testing-library/react-native";
import Events from "../app/(tabs)/events";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));
jest.mock("../lib/org", () => ({ useOrg: () => ({ selectedOrgId: "org-1" }) }));
jest.mock("../lib/events", () => ({
  useEvents: () => ({
    data: [{ id: "e1", name: "Apo Sky Ultra 2026", place: "Mt Apo", region: "Davao", event_date: "2026-11-14", elevation_gain_m: 4200 }],
    isLoading: false, isError: false, refetch: jest.fn(),
  }),
}));

describe("Events list", () => {
  it("renders events and navigates to detail on tap", () => {
    render(<Events />);
    expect(screen.getByText("Apo Sky Ultra 2026")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Apo Sky Ultra 2026"));
    expect(mockPush).toHaveBeenCalledWith("/event/e1");
  });
});
