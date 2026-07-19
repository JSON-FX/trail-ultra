import { View, Text, TextInput, Switch, Pressable, StyleSheet } from "react-native";
import type { FormFieldRow } from "../lib/events";
import { theme } from "../lib/theme";

export function DynamicField({ field, value, onChange }: {
  field: FormFieldRow; value: unknown; onChange: (v: unknown) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{field.label}{field.required ? " *" : ""}</Text>
      {(field.type === "text" || field.type === "date") && (
        <TextInput
          style={styles.input}
          value={(value as string) ?? ""}
          onChangeText={onChange}
          placeholder={field.type === "date" ? "YYYY-MM-DD" : ""}
          autoCapitalize="none"
          accessibilityLabel={field.label}
        />
      )}
      {field.type === "number" && (
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={value != null ? String(value) : ""}
          onChangeText={(t) => onChange(t === "" ? undefined : Number(t))}
          accessibilityLabel={field.label}
        />
      )}
      {field.type === "checkbox" && (
        <Switch value={!!value} onValueChange={onChange} accessibilityLabel={field.label} />
      )}
      {field.type === "select" && (
        <View style={styles.options}>
          {(field.options ?? []).map((opt) => (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.opt, value === opt && styles.optActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.optText, value === opt && styles.optTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {field.type === "file" && (
        <Text style={styles.note}>File uploads aren't supported yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: theme.ink, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.line, borderRadius: 10, padding: 12, fontSize: 16 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opt: { borderWidth: 1, borderColor: theme.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  optActive: { backgroundColor: theme.pine, borderColor: theme.pine },
  optText: { color: theme.ink }, optTextActive: { color: "#fff", fontWeight: "600" },
  note: { color: theme.inkSoft, fontStyle: "italic" },
});
