import { SupabaseClient } from "@supabase/supabase-js";
import { toFuzzy } from "../lib/fuzzy.js";

interface ProductArgs {
    tipo_prenda?: string;
    category?: string;
    color?: string;
    talla?: string;
}

export async function listProducts(supabase: SupabaseClient, args: ProductArgs) {
    const { tipo_prenda, category, color, talla } = args;

    let dbQuery = supabase.from("products")
        .select("*")
        .ilike("DISPONIBLE", "%s_%"); // Solo productos disponibles ("Sí", "Si", etc.)

    // Búsqueda en TIPO_PRENDA con manejo de plurales básicos (remeras -> remera, pantalones -> pantalon)
    if (tipo_prenda) {
        let cleanType = tipo_prenda.trim().toLowerCase();

        // Normalización básica de plurales en español
        if (cleanType.endsWith("es")) {
            cleanType = cleanType.slice(0, -2);
        } else if (cleanType.endsWith("s")) {
            cleanType = cleanType.slice(0, -1);
        }

        // Convertir a fuzzy: reemplazar vocales por _ para ignorar acentos
        const fuzzyTerm = cleanType.replace(/[aeiouáéíóúAEIOUÁÉÍÓÚ]/g, "_");

        console.log(`[SEARCH] Buscando "${tipo_prenda}" (normalizado: "${cleanType}") como fuzzy: "${fuzzyTerm}"`);

        // Buscamos en TIPO_PRENDA OR DESCRIPCIÓN
        dbQuery = dbQuery.or(`"TIPO_PRENDA".ilike.*${fuzzyTerm}*,"DESCRIPCIÓN".ilike.*${fuzzyTerm}*`);
    }

    // Filtros específicos adicionales con fuzzy para categoría y color
    if (category) {
        const fuzzyCat = toFuzzy(category);
        console.log(`[SEARCH] Buscando categoría "${category}" como fuzzy: "${fuzzyCat}"`);
        dbQuery = dbQuery.ilike("CATEGORÍA", `%${fuzzyCat}%`);
    }
    if (color) {
        const fuzzyColor = color.replace(/[aeiouáéíóúAEIOUÁÉÍÓÚ]/g, "_");
        dbQuery = dbQuery.ilike("COLOR", `%${fuzzyColor}%`);
    }
    if (talla) {
        const t = talla.trim().toUpperCase();
        dbQuery = dbQuery.or(`"TALLA".eq.${t},"TALLA".ilike.*${t}*`);
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
