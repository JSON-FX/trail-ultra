import { describe, it, expect } from "vitest";
import { customDataSchema, formatPeso, registrationInputSchema, type FormField } from "./index";

describe("customDataSchema", () => {
  const fields: FormField[] = [
    { key: "blood_type", label: "Blood type", type: "select", required: true, options: ["A", "O"] },
    { key: "running_club", label: "Club", type: "text", required: false },
  ];
  it("accepts valid data and rejects a bad select value", () => {
    expect(customDataSchema(fields).safeParse({ blood_type: "O" }).success).toBe(true);
    expect(customDataSchema(fields).safeParse({ blood_type: "Z" }).success).toBe(false);
  });
  it("requires required fields", () => {
    expect(customDataSchema(fields).safeParse({}).success).toBe(false);
  });
});

describe("formatPeso", () => {
  it("formats centavos as pesos", () => {
    expect(formatPeso(150000)).toBe("₱1,500.00");
  });
});

describe("registrationInputSchema", () => {
  it("rejects an empty idempotency key", () => {
    const bad = registrationInputSchema.safeParse({
      event_id: "00000000-0000-0000-0000-0000000000e1",
      category_id: "00000000-0000-0000-0000-0000000000c1",
      waiver_accepted: true,
      idempotency_key: "",
    });
    expect(bad.success).toBe(false);
  });
});
