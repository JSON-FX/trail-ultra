const mockEq = jest.fn().mockResolvedValue({ error: null });
const mockDelete = jest.fn(() => ({ eq: mockEq }));
jest.mock("../lib/supabase", () => ({
  supabase: { from: jest.fn(() => ({ delete: mockDelete })) },
  FunctionsHttpError: class {},
}));

import { cancelRegistration } from "../lib/registration";
import { supabase } from "../lib/supabase";

describe("cancelRegistration", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes the registration row by id", async () => {
    await cancelRegistration("r1");
    expect(supabase.from).toHaveBeenCalledWith("registrations");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("id", "r1");
  });

  it("throws when Supabase returns an error", async () => {
    mockEq.mockResolvedValueOnce({ error: { message: "denied" } });
    await expect(cancelRegistration("r1")).rejects.toBeTruthy();
  });
});
