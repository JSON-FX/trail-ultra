import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EventEditor } from "../routes/EventEditor";

vi.mock("../lib/roles", () => ({ useMyRoles: () => ({ data: { orgId: "a1" } }) }));
vi.mock("../lib/events", () => ({ useEventForEditor: () => ({ data: null, isLoading: false }) }));
const mockSave = vi.fn().mockResolvedValue({ eventId: "e1", childErrors: [] });
vi.mock("../lib/eventWrites", async (orig) => ({ ...(await orig()), saveEvent: (a: unknown) => mockSave(a) }));
const mockNav = vi.fn();
vi.mock("react-router-dom", async (orig) => ({ ...(await orig()), useNavigate: () => mockNav, useParams: () => ({}) }));

it("blocks save on an empty name, then saves a valid new event", async () => {
  render(<MemoryRouter><EventEditor /></MemoryRouter>);
  fireEvent.click(screen.getByText("Save event"));
  expect(await screen.findByText(/Fix the event fields/)).toBeInTheDocument();
  expect(mockSave).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Event name"), { target: { value: "Apo Sky Ultra" } });
  fireEvent.click(screen.getByText("Save event"));
  await waitFor(() => expect(mockSave).toHaveBeenCalled());
  expect(mockSave.mock.calls[0]![0].event).toMatchObject({ name: "Apo Sky Ultra", org_id: "a1", status: "draft" });
});
