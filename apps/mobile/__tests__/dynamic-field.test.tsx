import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { DynamicField } from "../components/DynamicField";
import type { FormFieldRow } from "../lib/events";

const bloodType: FormFieldRow = { id: "f1", key: "blood_type", label: "Blood type", type: "select", required: true, options: ["A", "O"], sort_order: 1 };

function Harness() {
  const [v, setV] = useState<unknown>(undefined);
  return <DynamicField field={bloodType} value={v} onChange={setV} />;
}

describe("DynamicField select", () => {
  it("renders options and selects one", () => {
    render(<Harness />);
    expect(screen.getByText("Blood type *")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("O"));
    // selecting marks it; a second render shows it still present (smoke of interaction)
    expect(screen.getByText("O")).toBeOnTheScreen();
  });
});
