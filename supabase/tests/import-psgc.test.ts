import { describe, it, expect } from "vitest";
import { mapRegion, mapProvince, mapCity } from "../../scripts/import-psgc.mjs";

describe("PSGC field mapping", () => {
  it("maps a region", () => {
    expect(mapRegion({ code: "010000000", name: "Ilocos Region", regionName: "Region I", islandGroupCode: "luzon" }))
      .toEqual({ code: "010000000", name: "Ilocos Region", region_name: "Region I", island_group_code: "luzon" });
  });
  it("maps a province with its region parent", () => {
    expect(mapProvince({ code: "012800000", name: "Ilocos Norte", regionCode: "010000000", islandGroupCode: "luzon" }))
      .toEqual({ code: "012800000", name: "Ilocos Norte", region_code: "010000000", island_group_code: "luzon" });
  });
  it("maps a city and coerces boolean provinceCode false → null", () => {
    expect(mapCity({ code: "012801000", name: "Adams", isCity: false, isMunicipality: true, provinceCode: "012800000", regionCode: "010000000", islandGroupCode: "luzon" }))
      .toEqual({ code: "012801000", name: "Adams", is_city: false, province_code: "012800000", region_code: "010000000", island_group_code: "luzon" });
    const ncr = mapCity({ code: "133900000", name: "City of Manila", isCity: true, provinceCode: false, regionCode: "130000000", islandGroupCode: "luzon" });
    expect(ncr.province_code).toBeNull();
    expect(ncr.is_city).toBe(true);
  });
});
