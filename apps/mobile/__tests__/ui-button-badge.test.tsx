import { render, screen } from "@testing-library/react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";

test("Button renders label", () => {
  render(<Button><Text>Go</Text></Button>);
  expect(screen.getByText("Go")).toBeOnTheScreen();
});
test("Badge renders label", () => {
  render(<Badge><Text>Open</Text></Badge>);
  expect(screen.getByText("Open")).toBeOnTheScreen();
});
