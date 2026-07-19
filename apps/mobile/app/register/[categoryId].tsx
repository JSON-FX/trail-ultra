import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { customDataSchema, type FormField } from "@trail-ultra/shared";
import { useCategory, useFormFields } from "../../lib/events";
import { DynamicField } from "../../components/DynamicField";
import { theme } from "../../lib/theme";

export default function Register() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const router = useRouter();
  const cat = useCategory(categoryId);
  const eventId = cat.data?.event_id ?? "";
  const fields = useFormFields(eventId);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  if (cat.isLoading || (eventId && fields.isLoading)) return <View style={styles.center}><ActivityIndicator /></View>;

  const fieldRows = fields.data ?? [];
  const asFormFields: FormField[] = fieldRows.map((f) => ({
    key: f.key, label: f.label, type: f.type, required: f.required, options: f.options ?? undefined,
  }));

  function validate() {
    const parsed = customDataSchema(asFormFields).safeParse(values);
    if (!parsed.success) { setError("Please complete the required fields correctly."); return false; }
    setError(null);
    return true;
  }

  return (
    <ScrollView style={styles.c} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.h}>Register — {cat.data?.label}</Text>
      {fieldRows.map((f) => (
        <DynamicField key={f.id} field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
      ))}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {/* Add-ons, waiver, total, and Submit are wired in Task 5. */}
      <Pressable style={styles.btn} onPress={validate} accessibilityRole="button" accessibilityLabel="Validate">
        <Text style={styles.btnT}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  back: { color: theme.pine, marginBottom: 8, fontSize: 15 },
  h: { fontSize: 22, fontWeight: "700", color: theme.ink, marginBottom: 16 },
  err: { color: theme.stop, marginBottom: 8 },
  btn: { backgroundColor: theme.pine, borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  btnT: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
