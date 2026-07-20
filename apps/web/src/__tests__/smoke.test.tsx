import { render, screen } from "@testing-library/react";
import { App } from "../App";

it("renders the admin app title", () => {
  render(<App />);
  expect(screen.getByText("Race Pace Admin")).toBeInTheDocument();
});
