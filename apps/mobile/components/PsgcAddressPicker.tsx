import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { usePsgcCities, usePsgcCity, usePsgcProvinces, usePsgcRegions } from "@/lib/psgc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import type { PsgcAddress } from "@race-pace/shared";

type Option = { value: string; label: string } | undefined;

const nameOf = (rows: { code: string; name: string }[] | undefined, code: string) =>
  (rows ?? []).find((r) => r.code === code)?.name ?? null;

/** Cascading Region → Province → City selects, one RNR `Select` per level —
 *  mirrors apps/web's PsgcAddressField (Plan 12): a region that resolves to
 *  zero provinces (NCR) skips the Province step entirely and filters cities
 *  by region instead of province. Unlike the web field, `onChange` here only
 *  fires once a City is chosen — that's this component's pre-redesign
 *  contract, kept as-is so existing callers (e.g. the profile screen) don't
 *  need to change. */
export function PsgcAddressPicker({ value, onChange, label = "LOCATION" }: {
  value: PsgcAddress | null; onChange: (a: PsgcAddress) => void; label?: string;
}) {
  const [regionCode, setRegionCode] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState(value?.city_psgc_code ?? "");
  const seeded = useRef(false);

  const regions = usePsgcRegions();
  const provinces = usePsgcProvinces(regionCode || undefined);
  const provincesLoading = !!regionCode && !provinces.isSuccess;
  const noProvinces = !!regionCode && provinces.isSuccess && (provinces.data?.length ?? 0) === 0;
  const cities = usePsgcCities({ provinceCode: provinceCode || undefined, regionCode: noProvinces ? regionCode : undefined });
  const citiesLoading = (!!provinceCode || noProvinces) && !cities.isSuccess;
  const seedCity = usePsgcCity(value?.city_psgc_code || undefined);

  // Edit-seed: recover the region/province codes from the stored city code,
  // once — PsgcAddress only carries display names, not codes, so Province
  // and City can't otherwise be driven without this reverse lookup.
  useEffect(() => {
    if (!seeded.current && value?.city_psgc_code && seedCity.data) {
      seeded.current = true;
      setRegionCode(seedCity.data.region_code);
      setProvinceCode(seedCity.data.province_code ?? "");
    }
  }, [value?.city_psgc_code, seedCity.data]);

  const regionName = nameOf(regions.data, regionCode) ?? value?.region_name ?? null;
  const provinceName = nameOf(provinces.data, provinceCode) ?? value?.province_name ?? null;
  const cityName = nameOf(cities.data, cityCode) ?? value?.city_name ?? null;

  function pickRegion(option: Option) {
    setRegionCode(option?.value ?? "");
    setProvinceCode("");
    setCityCode("");
  }
  function pickProvince(option: Option) {
    setProvinceCode(option?.value ?? "");
    setCityCode("");
  }
  function pickCity(option: Option) {
    if (!option) return;
    setCityCode(option.value);
    onChange({ city_psgc_code: option.value, city_name: option.label, province_name: provinceName, region_name: regionName });
  }

  const cityEnabled = !!provinceCode || noProvinces;
  const regionValue: Option = regionCode ? { value: regionCode, label: regionName ?? "" } : undefined;
  const provinceValue: Option = provinceCode ? { value: provinceCode, label: provinceName ?? "" } : undefined;
  const cityValue: Option = cityCode ? { value: cityCode, label: cityName ?? "" } : undefined;

  return (
    <View>
      <Text className="text-[11px] font-semibold tracking-[0.4px] text-muted-foreground mb-2">{label}</Text>
      <View className="gap-2">
        <Select value={regionValue} onValueChange={pickRegion}>
          <SelectTrigger accessibilityLabel="Region">
            <SelectValue placeholder="Select region" />
          </SelectTrigger>
          <SelectContent>
            {(regions.data ?? []).map((r) => (
              <SelectItem key={r.code} value={r.code} label={r.name} />
            ))}
          </SelectContent>
        </Select>

        {!noProvinces && (
          // key={regionCode}: RNR's Select falls back to its own internal
          // uncontrolled state whenever `value` is `undefined` (it only
          // treats itself as controlled when `value !== undefined`), so
          // passing `value={undefined}` to clear a previous pick doesn't
          // visually clear it. Remounting on region change forces a fresh,
          // genuinely-empty internal state instead.
          <Select key={regionCode} value={provinceValue} onValueChange={pickProvince}>
            <SelectTrigger accessibilityLabel="Province" disabled={!regionCode || provincesLoading}>
              <SelectValue placeholder={provincesLoading ? "Loading…" : "Select province"} />
            </SelectTrigger>
            <SelectContent>
              {(provinces.data ?? []).map((p) => (
                <SelectItem key={p.code} value={p.code} label={p.name} />
              ))}
            </SelectContent>
          </Select>
        )}

        {/* key remounts on region OR province change, for the same reason as Province above. */}
        <Select key={`${regionCode}:${provinceCode}`} value={cityValue} onValueChange={pickCity}>
          <SelectTrigger accessibilityLabel="City" disabled={!cityEnabled || citiesLoading}>
            <SelectValue placeholder={citiesLoading ? "Loading…" : "Select city or municipality"} />
          </SelectTrigger>
          <SelectContent>
            {(cities.data ?? []).map((c) => (
              <SelectItem key={c.code} value={c.code} label={c.name} />
            ))}
          </SelectContent>
        </Select>
      </View>
    </View>
  );
}
