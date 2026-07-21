import { render, screen, fireEvent } from "@testing-library/react";
import { PsgcAddressField } from "../components/PsgcAddressField";

let provinces: { data: { code: string; name: string }[]; isSuccess: boolean };
let cityLookup: { data: { code: string; name: string; province_code: string | null; region_code: string } | null };
vi.mock("../lib/psgc", () => ({
  usePsgcRegions: () => ({ data: [{ code: "13", name: "Davao Region" }] }),
  usePsgcProvinces: () => provinces,
  usePsgcCities: () => ({ data: [{ code: "112603", name: "City of Digos" }] }),
  usePsgcCity: () => cityLookup,
}));

beforeEach(() => {
  provinces = { data: [{ code: "1324", name: "Davao del Sur" }], isSuccess: true };
  cityLookup = { data: null };
});

it("cascades region → province → city and emits the address progressively", () => {
  const onChange = vi.fn();
  render(<PsgcAddressField value={null} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Region"), { target: { value: "13" } });
  expect(onChange).toHaveBeenLastCalledWith({ city_psgc_code: null, city_name: null, province_name: null, region_name: "Davao Region" });
  fireEvent.change(screen.getByLabelText("Province"), { target: { value: "1324" } });
  expect(onChange).toHaveBeenLastCalledWith({ city_psgc_code: null, city_name: null, province_name: "Davao del Sur", region_name: "Davao Region" });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "112603" } });
  expect(onChange).toHaveBeenLastCalledWith({ city_psgc_code: "112603", city_name: "City of Digos", province_name: "Davao del Sur", region_name: "Davao Region" });
});

it("skips province for a region with no provinces and filters city by region", () => {
  provinces = { data: [], isSuccess: true };
  const onChange = vi.fn();
  render(<PsgcAddressField value={null} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Region"), { target: { value: "13" } });
  expect(screen.getByLabelText("Province")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "112603" } });
  expect(onChange).toHaveBeenLastCalledWith({ city_psgc_code: "112603", city_name: "City of Digos", province_name: null, region_name: "Davao Region" });
});

it("pre-selects region/province/city from a stored city code (edit-seed)", () => {
  cityLookup = { data: { code: "112603", name: "City of Digos", province_code: "1324", region_code: "13" } };
  render(<PsgcAddressField value={{ city_psgc_code: "112603", city_name: "City of Digos", province_name: "Davao del Sur", region_name: "Davao Region" }} onChange={vi.fn()} />);
  expect((screen.getByLabelText("Region") as HTMLSelectElement).value).toBe("13");
  expect((screen.getByLabelText("Province") as HTMLSelectElement).value).toBe("1324");
  expect((screen.getByLabelText("City") as HTMLSelectElement).value).toBe("112603");
});
