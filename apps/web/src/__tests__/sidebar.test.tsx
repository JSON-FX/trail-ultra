import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";

let mockRoles: { data?: { isSuperAdmin: boolean } } = {};
vi.mock("../lib/roles", () => ({ useMyRoles: () => mockRoles }));
vi.mock("../lib/auth", () => ({
  useAuth: () => ({ signOut: vi.fn(), session: { user: { email: "admin@runwithpoint.test" } } }),
}));

function renderSidebar() {
  return render(<MemoryRouter><Sidebar /></MemoryRouter>);
}

it("org admin sees 6 nav items, not the platform ones", () => {
  mockRoles = { data: { isSuperAdmin: false } };
  renderSidebar();
  expect(screen.getByText("Events")).toBeInTheDocument();
  expect(screen.queryByText("Payouts")).not.toBeInTheDocument();
});

it("super_admin also sees the platform items", () => {
  mockRoles = { data: { isSuperAdmin: true } };
  renderSidebar();
  expect(screen.getByText("Organizations")).toBeInTheDocument();
  expect(screen.getByText("Payouts")).toBeInTheDocument();
});
