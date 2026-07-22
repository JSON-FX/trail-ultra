import { render, screen } from "@testing-library/react-native";
import { Search } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";

// Guards the jest transformIgnorePatterns allowlist: rendering any Lucide icon
// through the RNR Icon wrapper must work under jest-expo. lucide-react-native
// ships untransformed syntax, so it must be in the allowlist or this throws.
test("Icon renders a Lucide icon", () => {
  render(<Icon as={Search} testID="lucide-icon" />);
  expect(screen.getByTestId("lucide-icon")).toBeOnTheScreen();
});
