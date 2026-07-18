import { render, screen } from "@testing-library/react-native";
import Events from "../app/(tabs)/events";

describe("Events tab", () => {
  it("renders the placeholder", () => {
    render(<Events />);
    expect(screen.getByText("Events")).toBeOnTheScreen();
  });
});
