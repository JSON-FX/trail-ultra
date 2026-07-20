import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CancelModal } from "../components/CancelModal";

const mockCancel = vi.fn().mockResolvedValue({});
vi.mock("../lib/eventWrites", () => ({ cancelEvent: (id: string, note: string) => mockCancel(id, note) }));

it("cancel modal calls cancelEvent then onDone", async () => {
  const onClose = vi.fn(), onDone = vi.fn();
  render(<CancelModal event={{ id: "e1", name: "Apo Sky Ultra" }} onClose={onClose} onDone={onDone} />);
  expect(screen.getByText(/Cancel “Apo Sky Ultra”/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Cancel note"), { target: { value: "weather" } });
  fireEvent.click(screen.getByText("Cancel event"));
  await waitFor(() => expect(mockCancel).toHaveBeenCalledWith("e1", "weather"));
  expect(onDone).toHaveBeenCalled();
});
