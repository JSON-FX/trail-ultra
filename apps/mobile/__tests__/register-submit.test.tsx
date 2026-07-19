import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import Register from "../app/register/[categoryId]";

const mockReplace = jest.fn();
const mockStartCheckout = jest.fn().mockResolvedValue({ registration_id: "r1", checkout_url: "http://x/dev/pay/r1" });
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ categoryId: "c3" }), useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));
jest.mock("../lib/registration", () => ({ startCheckout: (...a: unknown[]) => mockStartCheckout(...a) }));
jest.mock("../lib/events", () => ({
  useCategory: () => ({ data: { id: "c3", event_id: "e1", label: "21K", base_price: 150000 }, isLoading: false }),
  useFormFields: () => ({ data: [
    { id: "f1", key: "blood_type", label: "Blood type", type: "select", required: true, options: ["A", "O"], sort_order: 1 },
  ], isLoading: false }),
  useAddons: () => ({ data: [{ id: "d1", name: "Singlet", price: 60000 }], isLoading: false }),
}));

describe("Register submit", () => {
  it("blocks without waiver, then submits valid data to checkout", async () => {
    render(<Register />);
    fireEvent.press(screen.getByText("O"));                 // pick blood type
    fireEvent.press(screen.getByText("Register"));          // waiver not accepted yet
    await waitFor(() => expect(screen.getByText("You must accept the waiver.")).toBeOnTheScreen());
    fireEvent(screen.getByLabelText("Accept waiver"), "valueChange", true);
    fireEvent.press(screen.getByText("Register"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());
    const arg = mockStartCheckout.mock.calls[0][0];
    expect(arg).toMatchObject({ event_id: "e1", category_id: "c3", custom_data: { blood_type: "O" }, waiver_accepted: true });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/pay/[registrationId]",
      params: { registrationId: "r1", checkoutUrl: "http://x/dev/pay/r1" },
    });
  });
});
