import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockStartCheckout = jest.fn().mockResolvedValue({ registration_id: "r1", checkout_url: "http://x/dev/pay/r1" });
const mockUpsert = jest.fn().mockResolvedValue({});
let mockProfile: any = null;
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ categoryId: "c3" }), useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../lib/auth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } } }) }));
jest.mock("../lib/profile", () => ({ getProfile: () => Promise.resolve(mockProfile), upsertProfile: (...a: unknown[]) => mockUpsert(...a) }));
jest.mock("../lib/registration", () => ({ startCheckout: (...a: unknown[]) => mockStartCheckout(...a) }));
jest.mock("../lib/events", () => ({
  useCategory: () => ({ data: { id: "c3", event_id: "e1", label: "21K", base_price: 150000 }, isLoading: false }),
  useFormFields: () => ({ data: [], isLoading: false }),
  useAddons: () => ({ data: [], isLoading: false }),
}));

import Register from "../app/register/[categoryId]";

beforeEach(() => { mockUpsert.mockClear(); mockStartCheckout.mockClear(); });

async function fillCoreAndSubmit() {
  fireEvent.changeText(screen.getByLabelText("Bib name"), "JR");
  fireEvent.changeText(screen.getByLabelText("Emergency contact"), "Jane 0917");
  fireEvent.press(screen.getByLabelText("Accept waiver"));
  fireEvent.press(screen.getByText("Register"));
}

describe("Register save-back", () => {
  it("empty profile: toggle shows ON, and submit upserts the passport then checks out", async () => {
    mockProfile = null;
    render(<Register />);
    fireEvent.changeText(screen.getByLabelText("Bib name"), "JR");
    await waitFor(() => expect(screen.getByLabelText("Save details to profile")).toBeOnTheScreen());
    expect(screen.getByRole("switch", { name: "Save details to profile", checked: true })).toBeOnTheScreen();
    await fillCoreAndSubmit();
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ id: "u1", bib_name: "JR", emergency_contact: "Jane 0917" });
  });

  it("editing an existing value defaults the toggle OFF (no upsert unless turned on)", async () => {
    mockProfile = { id: "u1", bib_name: "JR", emergency_contact: "Old 0900" };
    render(<Register />);
    await waitFor(() => expect(screen.getByDisplayValue("Old 0900")).toBeOnTheScreen());
    fireEvent.changeText(screen.getByLabelText("Emergency contact"), "New 0917");   // edit existing
    expect(screen.getByRole("switch", { name: "Save details to profile", checked: false })).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Accept waiver"));
    fireEvent.press(screen.getByText("Register"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("save-back failure never blocks checkout", async () => {
    mockProfile = null;
    mockUpsert.mockRejectedValueOnce(new Error("network"));
    render(<Register />);
    await fillCoreAndSubmit();
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());  // still reaches checkout
  });
});
