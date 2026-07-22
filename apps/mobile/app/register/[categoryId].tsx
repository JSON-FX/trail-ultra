import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customDataSchema, formatPeso, isProfileKey, BLOOD_TYPES, SHIRT_SIZES, GENDERS, type FormField } from "@race-pace/shared";
import { useCategory, useFormFields, useAddons } from "../../lib/events";
import { startCheckout } from "../../lib/registration";
import { getProfile, upsertProfile, type Profile } from "../../lib/profile";
import { useAuth } from "../../lib/auth";
import { DynamicField } from "../../components/DynamicField";
import { PillSelect } from "../../components/PillSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const FIELD_LABEL = "text-[11px] font-semibold tracking-[0.4px] text-muted-foreground mb-2";
const TOGGLE_ROW = "flex-row items-center gap-3 bg-muted rounded-[14px] p-[14px] mt-4";

export default function Register() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const cat = useCategory(categoryId);
  const eventId = cat.data?.event_id ?? "";
  const fields = useFormFields(eventId);
  const addons = useAddons(eventId);

  const [bibName, setBibName] = useState("");
  const [dob, setDob] = useState("");
  const [emergency, setEmergency] = useState("");
  const [gender, setGender] = useState("");
  const [shirtSize, setShirtSize] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [firstUltra, setFirstUltra] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const [waiver, setWaiver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => `${categoryId}:${Date.now()}`);
  const [loadedProfile, setLoadedProfile] = useState<Profile | null>(null);
  const [prefillDone, setPrefillDone] = useState(false);
  const [saveBack, setSaveBack] = useState(false);
  const [saveBackTouched, setSaveBackTouched] = useState(false);

  // Prefill the core fields from the runner's global profile. `prefillDone` only flips once
  // this settles (whether it found a profile or not), so submit() can gate the save-back
  // upsert on it — otherwise a fast submit could upsert still-blank fields as null and
  // clobber the runner's real saved passport values.
  useEffect(() => {
    if (session?.user.id) {
      getProfile(session.user.id)
        .then((p) => {
          if (p) {
            setBibName(p.bib_name ?? ""); setDob(p.date_of_birth ?? ""); setGender(p.gender ?? "");
            setShirtSize(p.shirt_size ?? ""); setBloodType(p.blood_type ?? ""); setEmergency(p.emergency_contact ?? "");
            setLoadedProfile(p);
          }
        })
        .finally(() => setPrefillDone(true));
    } else {
      setPrefillDone(true);
    }
  }, [session?.user.id]);

  const total = useMemo(() => {
    const base = cat.data?.base_price ?? 0;
    const addonTotal = (addons.data ?? []).filter((a) => selectedAddons[a.id]).reduce((s, a) => s + a.price, 0);
    return base + addonTotal;
  }, [cat.data, addons.data, selectedAddons]);

  // Passport diff + save-back default must run every render (hooks can't follow the loading-gate
  // return below, or the hook count changes once `cat`/`fields` finish loading and React throws).
  const passportPairs: [keyof Profile, string][] = [
    ["bib_name", bibName], ["date_of_birth", dob], ["gender", gender],
    ["shirt_size", shirtSize], ["blood_type", bloodType], ["emergency_contact", emergency],
  ];
  const prof = (k: keyof Profile) => (loadedProfile?.[k] as string | null) ?? "";
  const filledFromEmpty = passportPairs.some(([k, v]) => !prof(k) && v.trim() !== "");
  const editedExisting = passportPairs.some(([k, v]) => prof(k) !== "" && v.trim() !== "" && v !== prof(k));
  const showSaveBack = filledFromEmpty || editedExisting;

  useEffect(() => { if (!saveBackTouched) setSaveBack(filledFromEmpty); }, [filledFromEmpty, saveBackTouched]);

  if (cat.isLoading || (eventId && fields.isLoading)) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator className="text-primary" /></View>;

  const fieldRows = fields.data ?? [];
  const eventQuestions = fieldRows.filter((f) => !isProfileKey(f.key));
  const requested = new Set(fieldRows.filter((f) => isProfileKey(f.key)).map((f) => f.key));
  const eventFields: FormField[] = eventQuestions.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, options: f.options ?? undefined }));

  async function submit() {
    const parsed = customDataSchema(eventFields).safeParse(values);
    if (!parsed.success) { setError("Please complete the required fields correctly."); return; }
    const passport: Record<string, string> = { bib_name: bibName, date_of_birth: dob, gender, shirt_size: shirtSize, blood_type: bloodType, emergency_contact: emergency };
    for (const f of fieldRows) {
      if (isProfileKey(f.key) && f.required && !passport[f.key]?.trim()) { setError(`${f.label} is required.`); return; }
    }
    if (!bibName.trim()) { setError("Bib name is required."); return; }
    if (!emergency.trim()) { setError("Emergency contact is required."); return; }
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) { setError("Date of birth must be YYYY-MM-DD."); return; }
    if (!waiver) { setError("You must accept the waiver."); return; }
    setError(null); setBusy(true);
    try {
      if (saveBack && session?.user.id && prefillDone) {
        try {
          await upsertProfile({ id: session.user.id, bib_name: bibName, date_of_birth: dob || null, gender: gender || null, shirt_size: shirtSize || null, blood_type: bloodType || null, emergency_contact: emergency || null });
        } catch (e) { console.warn("profile save-back failed", e); }
      }
      const res = await startCheckout({
        event_id: eventId, category_id: categoryId,
        addon_ids: Object.keys(selectedAddons).filter((id) => selectedAddons[id]),
        custom_data: { bib_name: bibName, date_of_birth: dob, gender, shirt_size: shirtSize, blood_type: bloodType, emergency_contact: emergency, first_ultra: firstUltra, ...values },
        waiver_accepted: true, idempotency_key: idempotencyKey,
      });
      router.replace({ pathname: "/pay/[registrationId]", params: { registrationId: res.registration_id, checkoutUrl: res.checkout_url } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally { setBusy(false); }
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 4, paddingHorizontal: 22, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text className="text-primary text-[15px] font-medium">‹ {cat.data?.label ?? "Back"}</Text></Pressable>
        <Text className="text-[24px] font-bold tracking-[-0.4px] text-foreground mt-[10px] mb-[6px]">Register — {cat.data?.label}</Text>

        <View className="mt-[14px]"><Text className={FIELD_LABEL}>BIB NAME</Text><Input value={bibName} onChangeText={setBibName} placeholder="Name on your bib" autoCapitalize="characters" accessibilityLabel="Bib name" /></View>
        <View className="mt-[14px]"><Text className={FIELD_LABEL}>DATE OF BIRTH</Text><Input value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" autoCapitalize="none" accessibilityLabel="Date of birth" /></View>
        <View className="mt-[14px]">
          <Text className={cn(FIELD_LABEL, "text-destructive")}>EMERGENCY CONTACT · required</Text>
          <Input className={cn(error && !emergency.trim() && "border-destructive")} value={emergency} onChangeText={setEmergency} placeholder="Name & mobile number" accessibilityLabel="Emergency contact" />
        </View>
        {requested.has("gender") && <PillSelect label="GENDER" value={gender} options={GENDERS} onChange={setGender} />}
        {requested.has("shirt_size") && <PillSelect label="SHIRT SIZE" value={shirtSize} options={SHIRT_SIZES} onChange={setShirtSize} />}
        {requested.has("blood_type") && <PillSelect label="BLOOD TYPE" value={bloodType} options={BLOOD_TYPES} onChange={setBloodType} />}
        <Pressable className={TOGGLE_ROW} onPress={() => setFirstUltra((v) => !v)} accessibilityRole="button" accessibilityLabel="First ultra at this distance">
          <Text className="flex-1 text-[14px] text-foreground">First ultra at this distance?</Text>
          <View pointerEvents="none"><Switch checked={firstUltra} onCheckedChange={() => {}} accessible={false} importantForAccessibility="no-hide-descendants" /></View>
        </Pressable>

        {eventQuestions.map((f) => (
          <DynamicField key={f.id} field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
        ))}

        {(addons.data ?? []).length > 0 && <Text className="text-[15px] font-semibold text-foreground mt-[22px] mb-[10px]">Add-ons</Text>}
        {(addons.data ?? []).map((a) => {
          const on = !!selectedAddons[a.id];
          return (
            <Pressable key={a.id} className="flex-row items-center gap-3 border border-border rounded-[14px] py-[13px] px-[14px] mb-[10px]" onPress={() => setSelectedAddons((s) => ({ ...s, [a.id]: !s[a.id] }))} accessibilityRole="button" accessibilityLabel={a.name}>
              <View className="flex-1"><Text className="text-[14px] font-medium text-foreground">{a.name}</Text><Text className="text-[13px] text-primary font-semibold mt-[2px]">+{formatPeso(a.price)}</Text></View>
              <View pointerEvents="none"><Switch checked={on} onCheckedChange={() => {}} accessible={false} importantForAccessibility="no-hide-descendants" /></View>
            </Pressable>
          );
        })}

        {showSaveBack && (
          <Pressable className={TOGGLE_ROW} onPress={() => { setSaveBackTouched(true); setSaveBack((v) => !v); }}>
            <Text className="flex-1 text-[14px] text-foreground">Save these details to my profile?</Text>
            <Switch checked={saveBack} onCheckedChange={(v) => { setSaveBackTouched(true); setSaveBack(v); }} accessibilityLabel="Save details to profile" />
          </Pressable>
        )}

        <Pressable className="flex-row items-center gap-3 bg-muted rounded-[14px] p-[14px] mt-5" onPress={() => setWaiver((v) => !v)} accessibilityRole="button" accessibilityLabel="Accept waiver">
          <Text className="flex-1 text-[13px] text-foreground leading-[19px]">I accept the event <Text className="text-primary font-semibold">waiver</Text> and confirm I'm medically fit.</Text>
          <View pointerEvents="none"><Switch checked={waiver} onCheckedChange={() => {}} accessible={false} importantForAccessibility="no-hide-descendants" /></View>
        </Pressable>

        <View className="flex-row justify-between items-center mt-[18px]"><Text className="text-[15px] font-semibold text-foreground">Total</Text><Text className="text-[22px] font-bold text-primary">{formatPeso(total)}</Text></View>
        {error ? <Text className="text-destructive mt-3 text-[13px]">{error}</Text> : null}
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 px-[22px] pt-[14px] bg-background border-t border-divider" style={{ paddingBottom: insets.bottom + 16 }}>
        <Button className="h-auto py-[15px] sm:h-auto" disabled={busy} onPress={submit} accessibilityRole="button"><Text className="text-[16px] font-semibold text-primary-foreground">{busy ? "Submitting…" : "Register"}</Text></Button>
      </View>
    </View>
  );
}
