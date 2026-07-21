import { useEffect, useRef, useState } from "react";
import type { PsgcAddress } from "@race-pace/shared";
import { usePsgcRegions, usePsgcProvinces, usePsgcCities, usePsgcCity } from "../lib/psgc";

const label = { display: "block", fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "var(--ink-muted)", marginBottom: 6 } as const;
const input = { background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 11, padding: "12px 13px", color: "var(--ink)", fontSize: 14, width: "100%" } as const;

/** Cascading Region → Province → City selects. Emits a full PsgcAddress on each
 *  change (partial until a city is chosen). NCR-style regions with no provinces
 *  skip the Province step and filter cities by region. */
export function PsgcAddressField({ value, onChange }: { value: PsgcAddress | null; onChange: (a: PsgcAddress) => void }) {
  const [regionCode, setRegionCode] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const seeded = useRef(false);

  const regions = usePsgcRegions();
  const provinces = usePsgcProvinces(regionCode || undefined);
  const noProvinces = !!regionCode && provinces.isSuccess && (provinces.data?.length ?? 0) === 0;
  const cities = usePsgcCities({ provinceCode: provinceCode || undefined, regionCode: noProvinces ? regionCode : undefined });
  const seedCity = usePsgcCity(value?.city_psgc_code || undefined);

  // Edit-seed: recover region/province codes from the stored city code, once.
  useEffect(() => {
    if (!seeded.current && value?.city_psgc_code && seedCity.data) {
      seeded.current = true;
      setRegionCode(seedCity.data.region_code);
      setProvinceCode(seedCity.data.province_code ?? "");
    }
  }, [value?.city_psgc_code, seedCity.data]);

  const nameOf = (rows: { code: string; name: string }[] | undefined, code: string) => (rows ?? []).find((r) => r.code === code)?.name ?? null;
  const regionName = nameOf(regions.data, regionCode) ?? value?.region_name ?? null;
  const provinceName = nameOf(provinces.data, provinceCode) ?? value?.province_name ?? null;

  function pickRegion(code: string) {
    setRegionCode(code); setProvinceCode("");
    onChange({ city_psgc_code: null, city_name: null, province_name: null, region_name: code ? nameOf(regions.data, code) : null });
  }
  function pickProvince(code: string) {
    setProvinceCode(code);
    onChange({ city_psgc_code: null, city_name: null, province_name: code ? nameOf(provinces.data, code) : null, region_name: regionName });
  }
  function pickCity(code: string) {
    onChange({ city_psgc_code: code || null, city_name: code ? nameOf(cities.data, code) : null, province_name: provinceName, region_name: regionName });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      <div>
        <span style={label}>REGION</span>
        <select aria-label="Region" style={input} value={regionCode} onChange={(e) => pickRegion(e.target.value)}>
          <option value="">— Select —</option>
          {(regions.data ?? []).map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>
      </div>
      <div>
        <span style={label}>PROVINCE</span>
        <select aria-label="Province" style={input} value={provinceCode} disabled={!regionCode || noProvinces} onChange={(e) => pickProvince(e.target.value)}>
          <option value="">{noProvinces ? "— None —" : "— Select —"}</option>
          {(provinces.data ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <span style={label}>CITY / MUNICIPALITY</span>
        <select aria-label="City" style={input} value={value?.city_psgc_code ?? ""} disabled={!(provinceCode || noProvinces)} onChange={(e) => pickCity(e.target.value)}>
          <option value="">— Select —</option>
          {(cities.data ?? []).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>
    </div>
  );
}
