import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockStartCheckout = jest.fn().mockResolvedValue({ registration_id: "r1", checkout_url: "http://x/dev/pay/r1" });
const mockUpsert = jest.fn().mockResolvedValue({});
const mockGetProfile = jest.fn();
let mockProfile: any = null;
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ categoryId: "c3" }), useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../lib/auth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } } }) }));
jest.mock("../lib/profile", () => ({ getProfile: (...a: unknown[]) => mockGetProfile(...a), upsertProfile: (...a: unknown[]) => mockUpsert(...a) }));
jest.mock("../lib/registration", () => ({ startCheckout: (...a: unknown[]) => mockStartCheckout(...a) }));
jest.mock("../lib/events", () => ({
  useCategory: () => ({ data: { id: "c3", event_id: "e1", label: "21K", base_price: 150000 }, isLoading: false }),
  useEvent: () => ({ data: { id: "e1", name: "Apo Sky Ultra", event_date: "2026-11-14", end_date: null, org_name: "Race Pace" }, isLoading: false }),
  useFormFields: () => ({ data: [], isLoading: false }),
  useAddons: () => ({ data: [], isLoading: false }),
}));

import Register from "../app/register/[categoryId]";

beforeEach(() => {
  mockUpsert.mockClear();
  mockStartCheckout.mockClear();
  mockGetProfile.mockClear();
  mockGetProfile.mockImplementation(() => Promise.resolve(mockProfile));
});

// Bib/DOB/emergency are no longer on the form; shirt size is the passport field that now drives
// save-back. Picking a size = the editable "core" detail these tests exercise.
describe("Register save-back", () => {
  it("empty profile: picking a shirt size shows the toggle ON, and submit upserts the passport then checks out", async () => {
    mockProfile = null;
    render(<Register />);
    fireEvent.press(await screen.findByRole("radio", { name: "L" }));   // shirt size, filled from empty
    await waitFor(() => expect(screen.getByLabelText("Save details to profile")).toBeOnTheScreen());
    expect(screen.getByRole("switch", { name: "Save details to profile", checked: true })).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Accept waiver"));
    fireEvent.press(screen.getByLabelText("Register"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ id: "u1", shirt_size: "L" });
  });

  it("editing an existing value defaults the toggle OFF (no upsert unless turned on)", async () => {
    mockProfile = { id: "u1", shirt_size: "M" };
    render(<Register />);
    await waitFor(() => expect(screen.getByRole("radio", { name: "M", checked: true })).toBeOnTheScreen());  // prefilled
    fireEvent.press(screen.getByRole("radio", { name: "L" }));           // edit existing M -> L
    expect(screen.getByRole("switch", { name: "Save details to profile", checked: false })).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Accept waiver"));
    fireEvent.press(screen.getByLabelText("Register"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("save-back failure never blocks checkout", async () => {
    mockProfile = null;
    mockUpsert.mockRejectedValueOnce(new Error("network"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    render(<Register />);
    fireEvent.press(await screen.findByRole("radio", { name: "L" }));
    await waitFor(() => expect(screen.getByLabelText("Save details to profile")).toBeOnTheScreen()); // let the (null) prefill settle before submitting
    fireEvent.press(screen.getByLabelText("Accept waiver"));
    fireEvent.press(screen.getByLabelText("Register"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());  // still reaches checkout
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  // Important-fix regression guard: if the runner submits before the profile fetch resolves,
  // save-back must be skipped (not run with the still-blank passport fields), so it can never
  // clobber the runner's real saved profile with nulls.
  it("submitting before profile prefill resolves skips save-back instead of clobbering it", async () => {
    mockProfile = { id: "u1", shirt_size: "M" };
    mockGetProfile.mockImplementation(() => new Promise(() => {})); // never resolves in this test — simulates a slow prefill
    render(<Register />);
    fireEvent.press(screen.getByRole("radio", { name: "L" }));
    fireEvent.press(screen.getByLabelText("Accept waiver"));
    fireEvent.press(screen.getByLabelText("Register"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());  // registration itself still proceeds
    expect(mockUpsert).not.toHaveBeenCalled();                          // but save-back is skipped, not run with still-blank fields
  });
});
