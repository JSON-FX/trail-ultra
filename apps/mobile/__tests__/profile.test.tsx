import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockUpsert = jest.fn().mockResolvedValue({});
jest.mock("../lib/auth", () => ({ useAuth: () => ({ session: { user: { id: "u1", email: "jr@x.test" } }, signOut: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../lib/profile", () => ({
  getProfile: jest.fn().mockResolvedValue({ id: "u1", full_name: "JR Dela Cruz", bib_name: "JR", city: "Davao", blood_type: "O+", shirt_size: "M", emergency_contact: "Jane 0917" }),
  upsertProfile: (...a: unknown[]) => mockUpsert(...a),
}));

import Profile from "../app/(tabs)/profile";

describe("Profile", () => {
  it("loads existing values incl. race details", async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByDisplayValue("JR Dela Cruz")).toBeOnTheScreen());
    expect(screen.getByDisplayValue("Davao")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("Jane 0917")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "O+", selected: true })).toBeOnTheScreen();
  });
  it("saves the widened passport payload", async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByDisplayValue("JR Dela Cruz")).toBeOnTheScreen());
    fireEvent.press(screen.getByRole("button", { name: "L" }));      // change shirt size
    fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({
      id: "u1", full_name: "JR Dela Cruz", bib_name: "JR", city: "Davao",
      blood_type: "O+", shirt_size: "L", emergency_contact: "Jane 0917",
    });
  });
});
