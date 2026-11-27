export type FieldKey = "name" | "email" | "password" | "terms";

// The backend sends plain messages without field names, so match by keyword
export function mapErrors(messages: string[]) {
  const fields: Partial<Record<FieldKey, string>> = {};
  const general: string[] = [];

  for (const m of messages) {
    const key: FieldKey | null = /terms/i.test(m)
      ? "terms"
      : /email/i.test(m)
        ? "email"
        : /password/i.test(m)
          ? "password"
          : /name/i.test(m)
            ? "name"
            : null;
    if (key && !fields[key]) fields[key] = m;
    else general.push(m);
  }
  return { fields, general };
}