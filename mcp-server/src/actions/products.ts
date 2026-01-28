import { SupabaseClient } from "@supabase/supabase-js";
import { toFuzzy } from "../lib/fuzzy.js";

interface ProductArgs {
    name?: string;
    category?: string;
    color?: string;
    size?: string;
}

export async function listProducts(supabase: SupabaseClient, args: ProductArgs) {
    const { name, category, color, size } = args;

    let dbQuery = supabase.from("products")
        .select("*")
        .ilike("available", "%s_%"); // Solo productos disponibles ("Sí", "Si", etc.)

    // Búsqueda en name con manejo de plurales básicos (remeras -> remera, pantalones -> pantalon)
    if (name) {
        let cleanType = name.trim().toLowerCase();

        // Normalización básica de plurales en español
        if (cleanType.endsWith("es")) {
            cleanType = cleanType.slice(0, -2);
        } else if (cleanType.endsWith("s")) {
            cleanType = cleanType.slice(0, -1);
        }

        // Convertir a fuzzy: reemplazar vocales por _ para ignorar acentos
        const fuzzyTerm = cleanType.replace(/[aeiouáéíóúAEIOUÁÉÍÓÚ]/g, "_");

        console.log(`[SEARCH] Buscando "${name}" (normalizado: "${cleanType}") como fuzzy: "${fuzzyTerm}"`);

        // Buscamos en name OR description
        dbQuery = dbQuery.or(`name.ilike.*${fuzzyTerm}*,description.ilike.*${fuzzyTerm}*`);
    }

    // Filtros específicos adicionales con fuzzy para categoría y color
    if (category) {
        const fuzzyCat = toFuzzy(category);
        console.log(`[SEARCH] Buscando categoría "${category}" como fuzzy: "${fuzzyCat}"`);
        dbQuery = dbQuery.ilike("category", `%${fuzzyCat}%`);
    }
    if (color) {
        const fuzzyColor = color.replace(/[aeiouáéíóúAEIOUÁÉÍÓÚ]/g, "_");
        dbQuery = dbQuery.ilike("color", `%${fuzzyColor}%`);
    }
    if (size) {
        const t = size.trim().toUpperCase();
        dbQuery = dbQuery.or(`size.eq.${t},size.ilike.*${t}*`);
    }

    const { data, error } = await dbQuery.limit(20);
    if (error) {
        console.error("[SEARCH-ERROR]", error);
        throw error;
    }

    console.log(`[SEARCH] Encontrados: ${data?.length || 0} productos`);

    if (!data || data.length === 0) {
        return { content: [{ type: "text", text: "No encontré productos con esos filtros." }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(data) }] };
}
