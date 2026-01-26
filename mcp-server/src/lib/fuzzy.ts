export function toFuzzy(text: string): string {
    return text.trim().replace(/[aeiouáéíóúAEIOUÁÉÍÓÚ]/g, "_");
}
