import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type PsgcRow = { code: string; name: string };

export function usePsgcRegions() {
  return useQuery({ queryKey: ["psgc-regions"], queryFn: async (): Promise<PsgcRow[]> => {
    const { data, error } = await supabase.from("psgc_regions").select("code,name").order("name");
    if (error) throw error; return (data ?? []) as PsgcRow[];
  }});
}

export function usePsgcProvinces(regionCode?: string) {
  return useQuery({ queryKey: ["psgc-provinces", regionCode], enabled: !!regionCode, queryFn: async (): Promise<PsgcRow[]> => {
    const { data, error } = await supabase.from("psgc_provinces").select("code,name").eq("region_code", regionCode!).order("name");
    if (error) throw error; return (data ?? []) as PsgcRow[];
  }});
}

export function usePsgcCities({ provinceCode, regionCode, search }: { provinceCode?: string; regionCode?: string; search?: string }) {
  return useQuery({ queryKey: ["psgc-cities", provinceCode, regionCode, search], enabled: !!(provinceCode || regionCode), queryFn: async (): Promise<PsgcRow[]> => {
    let q = supabase.from("psgc_cities").select("code,name");
    if (provinceCode) q = q.eq("province_code", provinceCode);
    else if (regionCode) q = q.eq("region_code", regionCode);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q.order("name");
    if (error) throw error; return (data ?? []) as PsgcRow[];
  }});
}
