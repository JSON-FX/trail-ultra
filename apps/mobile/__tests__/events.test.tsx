import { render, screen } from "@testing-library/react-native";
import Events from "../app/(tabs)/events";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));
jest.mock("../lib/org", () => ({ useOrg: () => ({ selectedOrgId: "org-1" }) }));
jest.mock("../lib/events", () => ({
  useEvents: () => ({
    data: [],
    isLoading: false, isError: false, refetch: jest.fn(),
  }),
}));

describe("Events tab", () => {
  it("renders empty state when no events", () => {
    render(<Events />);
    expect(screen.getByText("No events yet.")).toBeOnTheScreen();
  });
});
