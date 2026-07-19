import { render, screen, fireEvent } from "@testing-library/react-native";
import EventDetail from "../app/event/[id]";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ id: "e1" }), useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock("../lib/events", () => ({
  useEvent: () => ({ data: { name: "Apo Sky Ultra 2026", place: "Mt Apo", region: "Davao" }, isLoading: false }),
  useCategories: () => ({ data: [
    { id: "c3", label: "21K", base_price: 150000, slots_total: 200, slots_taken: 0 },
    { id: "c4", label: "10K", base_price: 100000, slots_total: 200, slots_taken: 200 },
  ], isLoading: false }),
}));

describe("EventDetail", () => {
  it("shows categories with peso prices and sold-out state, and routes to register", () => {
    render(<EventDetail />);
    expect(screen.getByText("21K")).toBeOnTheScreen();
    expect(screen.getByText("₱1,500.00")).toBeOnTheScreen();
    expect(screen.getByText("Sold out")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("21K"));
    expect(mockPush).toHaveBeenCalledWith("/register/c3");
  });
});
