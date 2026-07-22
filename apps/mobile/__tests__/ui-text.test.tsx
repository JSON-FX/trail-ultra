import { render, screen } from "@testing-library/react-native";
import { Text } from "@/components/ui/text";

test("ui Text renders children", () => {
  render(<Text>hello</Text>);
  expect(screen.getByText("hello")).toBeOnTheScreen();
});
