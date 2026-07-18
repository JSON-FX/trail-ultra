import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import SignIn from "../app/(auth)/sign-in";

const mockSignIn = jest.fn().mockResolvedValue({ error: "Invalid login credentials" });
jest.mock("../lib/auth", () => ({ useAuth: () => ({ signIn: mockSignIn }) }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe("SignIn", () => {
  it("shows the error returned by signIn", async () => {
    render(<SignIn />);
    fireEvent.changeText(screen.getByLabelText("Email"), "jr@test.dev");
    fireEvent.changeText(screen.getByLabelText("Password"), "wrong");
    fireEvent.press(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("Invalid login credentials")).toBeOnTheScreen());
  });
});
