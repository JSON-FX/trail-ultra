import { cn } from "@/lib/utils";

test("@/ alias + cn merge works in jest", () => {
  expect(cn("p-2", "p-4")).toBe("p-4");
});
