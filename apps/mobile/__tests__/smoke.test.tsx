import { render } from "@testing-library/react-native";
import { Text } from "react-native";

describe("harness", () => {
  it("renders", () => {
    const { getByText } = render(<Text>hello race-pace</Text>);
    expect(getByText("hello race-pace")).toBeOnTheScreen();
  });
});
