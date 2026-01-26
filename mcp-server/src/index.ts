import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createClient } from "@supabase/supabase-js";

// --- CONFIGURACIÓN ---

interface Env {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
}

const sessions = new Map<string, (message: any) => void>();
// Helper para fuzzy search (ignorar acentos y mayúsculas)
function toFuzzy(text: string): string {
    return text.trim().replace(/[aeiouáéíóúAEIOUÁÉÍÓÚ]/g, "_");
}

const TOOLS = [
    {
        name: "list_products",
        description: "Lista productos filtrando por tipo, categoría, color o talla. Devuelve todos los detalles incluyendo PRECIO_100_U, DESCRIPCIÓN y STOCK.",
        inputSchema: {
            type: "object",
            properties: {
                tipo_prenda: { type: "string", description: "Tipo de prenda (Remera, Pantalon, Sudadera, Falda, etc.)" },
                category: { type: "string", description: "Categoría (Deportivo, Casual, Formal)" },
                color: { type: "string", description: "Color de la prenda" },
                talla: { type: "string", description: "Talle de la prenda" }
            }
        }
    },
    {
        name: "create_cart",
        description: "Crea un nuevo carrito de compras para la conversación actual.",
        inputSchema: {
            type: "object",
            properties: {
                conversation_id: { type: "string", description: "ID de la conversación (opcional si ya existe un carrito)" }
            }
        }
    },
    {
        name: "add_to_cart",
        description: "Añade un producto específico al carrito.",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito (alternativa a conversation_id)" },
                conversation_id: { type: "string", description: "ID de la conversación (alternativa a cart_id)" },
                product_id: { type: "string" },
                qty: { type: "number", default: 1 }
            },
            required: ["product_id"]
        }
    },
    {
        name: "update_cart",
        description: "Actualiza la cantidad de un producto en el carrito o lo elimina (qty=0).",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito (alternativa a conversation_id)" },
                conversation_id: { type: "string", description: "ID de la conversación (alternativa a cart_id)" },
                product_id: { type: "string", description: "ID del producto a actualizar" },
                qty: { type: "number", description: "Nueva cantidad (0 para eliminar)" }
            },
            required: ["product_id", "qty"]
        }
    },
    {
        name: "view_cart",
        description: "Muestra el contenido actual del carrito.",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito (alternativa a conversation_id)" },
                conversation_id: { type: "string", description: "ID de la conversación (alternativa a cart_id)" }
            }
        }
    },
    {
        name: "clear_cart",
        description: "Vacía todo el contenido del carrito. Usa esto cuando el usuario pida explícitamente vaciar o borrar todo el carrito.",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito a vaciar" },
                conversation_id: { type: "string", description: "ID de conversación (alternativa a cart_id)" }
            }
        }
    },
    {
        name: "handover_to_human",
        description: "Deriva la conversación a un humano para atención personalizada.",
        inputSchema: {
            type: "object",
            properties: { reason: { type: "string" } },
            required: ["reason"]
        }
    }
];

// Lógica de Negocio v2.2.0 (Búsqueda por Palabras + Cart Management)
export async function executeToolLogic(name: string, args: any, supabase: any): Promise<any> {
    console.log(`[MCP-LOGIC] Ejecutando tool: ${name}`);

    try {
        if (name === "list_products") {
            const { tipo_prenda, category, color, talla } = args as any;

            let dbQuery = supabase.from("products")
                .select("*")
                .ilike("DISPONIBLE", "%s_%"); // Fuzzy: Sí, Si, si, SI, sí, etc.

            // Búsqueda fuzzy en TIPO_PRENDA (ignora acentos y plurales)
            if (tipo_prenda) {
                // Convertir a fuzzy: reemplazar vocales por _ para ignorar acentos
                const fuzzyTerm = tipo_prenda
                    .trim()
                    .replace(/[aeiouáéíóúAEIOUÁÉÍÓÚ]/g, "_");

                console.log(`[SEARCH] Buscando "${tipo_prenda}" como fuzzy: "${fuzzyTerm}"`);
                dbQuery = dbQuery.ilike("TIPO_PRENDA", `%${fuzzyTerm}%`);
            }

            // Filtros específicos adicionales con fuzzy para categoría
            if (category) {
                const fuzzyCat = toFuzzy(category);
                console.log(`[SEARCH] Buscando categoría "${category}" como fuzzy: "${fuzzyCat}"`);
                dbQuery = dbQuery.ilike("CATEGORÍA", `%${fuzzyCat}%`);
            }
            if (color) {
                dbQuery = dbQuery.ilike("COLOR", `%${color}%`);
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

        if (name === "create_cart") {
            const cartId = args?.conversation_id || args?.cart_id || crypto.randomUUID();

            console.log(`[CART] Creando/reutilizando carrito: ${cartId}`);

            // Usar upsert para evitar duplicados
            const { error } = await supabase.from("carts")
                .upsert({ id: cartId }, { onConflict: "id" });

            if (error) {
                console.error("[CART-ERROR] create_cart:", error.message);
                throw error;
            }
            return { content: [{ type: "text", text: `Carrito listo. ID: ${cartId}` }] };
        }

        if (name === "add_to_cart") {
            const cartId = args?.cart_id || args?.conversation_id;
            const productId = args?.product_id;
            const qty = args?.qty || 1;

            if (!productId) {
                return { content: [{ type: "text", text: "Error: necesito el product_id." }], isError: true };
            }

            // --- VERIFICACIÓN DE EXISTENCIA Y STOCK ---
            const { data: product, error: pError } = await supabase
                .from("products")
                .select("ID, CANTIDAD_DISPONIBLE, TIPO_PRENDA, COLOR, TALLA")
                .eq("ID", productId)
                .single();

            if (pError || !product) {
                return {
                    content: [{ type: "text", text: `Error: El producto con ID "${productId}" no existe. Por favor, usa list_products para obtener el ID real.` }],
                    isError: true
                };
            }

            // Si no hay cart_id, crear uno nuevo
            const finalCartId = cartId || crypto.randomUUID();

            // Asegurar que el carrito existe
            const { error: cError } = await supabase.from("carts")
                .upsert({ id: finalCartId }, { onConflict: "id" });

            if (cError) {
                console.error("[CART-ERROR] add_to_cart (upsert cart):", cError.message);
                throw cError;
            }

            // Consultar cantidad actual en el carrito
            const { data: currentItem } = await supabase
                .from("cart_items")
                .select("qty")
                .eq("cart_id", finalCartId)
                .eq("product_id", productId)
                .single();

            const currentQty = currentItem?.qty || 0;
            const totalQty = currentQty + qty;

            console.log(`[CART] Stock Check: Actual=${currentQty}, Nuevo=${qty}, Total=${totalQty}, Disponible=${product.CANTIDAD_DISPONIBLE}`);

            // Validar stock con el TOTAL acumulado
            if (product.CANTIDAD_DISPONIBLE < totalQty) {
                return {
                    content: [{
                        type: "text",
                        text: `⚠️ Stock insuficiente. Tienes ${currentQty} en carrito y quieres sumar ${qty} (Total: ${totalQty}), pero solo hay ${product.CANTIDAD_DISPONIBLE} disponibles.`
                    }],
                    isError: true
                };
            }

            // Upsert (insertar o actualizar sumando)
            const { error: iError } = await supabase.from("cart_items").upsert({
                cart_id: finalCartId,
                product_id: productId,
                qty: totalQty // Guardamos el gran total
            }, { onConflict: "cart_id,product_id" });

            if (iError) {
                console.error("[CART-ERROR] add_to_cart (upsert item):", iError.message);
                throw iError;
            }

            return { content: [{ type: "text", text: `✅ Producto añadido/actualizado. Cart ID: ${finalCartId}` }] };
        }

        if (name === "update_cart") {
            const cartId = args?.cart_id || args?.conversation_id;
            const productId = args?.product_id;
            const qty = args?.qty;

            if (!productId || qty === undefined) {
                return { content: [{ type: "text", text: "Error: necesito product_id y qty." }], isError: true };
            }

            if (!cartId) {
                return { content: [{ type: "text", text: "Error: necesito cart_id o conversation_id." }], isError: true };
            }

            if (qty <= 0) {
                // Eliminar producto
                const { error } = await supabase
                    .from("cart_items")
                    .delete()
                    .eq("cart_id", cartId)
                    .eq("product_id", productId);

                if (error) throw error;
                return { content: [{ type: "text", text: `Producto eliminado del carrito.` }] };
            } else {
                // Actualizar cantidad
                const { error } = await supabase
                    .from("cart_items")
                    .update({ qty: qty })
                    .eq("cart_id", cartId)
                    .eq("product_id", productId);

                if (error) throw error;
                return { content: [{ type: "text", text: `Cantidad actualizada a ${qty}.` }] };
            }
        }

        if (name === "view_cart") {
            const cartId = args?.cart_id || args?.conversation_id;

            if (!cartId) {
                return { content: [{ type: "text", text: "Error: necesito cart_id o conversation_id para ver el carrito." }], isError: true };
            }

            console.log(`[CART] Consultando carrito: ${cartId}`);

            const { data, error } = await supabase
                .from("cart_items")
                .select(`
                    qty,
                    products (
                        TIPO_PRENDA,
                        TALLA,
                        COLOR,
                        PRECIO_50_U,
                        PRECIO_100_U,
                        PRECIO_200_U
                    )
                `)
                .eq("cart_id", cartId);

            if (error) throw error;

            if (!data || data.length === 0) {
                return { content: [{ type: "text", text: "El carrito está vacío." }] };
            }

            // Calcular totales
            let totalGeneral = 0;
            const itemsDetalle: string[] = [];

            for (const item of data) {
                const p = item.products as any;
                let unitPrice = p.PRECIO_50_U; // Precio base (mayorista mínimo)

                // Aplicar escala de precios
                if (item.qty >= 200) unitPrice = p.PRECIO_200_U;
                else if (item.qty >= 100) unitPrice = p.PRECIO_100_U;

                const subtotal = item.qty * unitPrice;
                totalGeneral += subtotal;

                itemsDetalle.push(`- ${item.qty}x ${p.TIPO_PRENDA} ${p.COLOR} (${p.TALLA}) a $${unitPrice} = $${subtotal}`);
            }

            const responseText = `🛒 *CARRITO ACTUAL*:\n\n${itemsDetalle.join("\n")}\n\n💰 *TOTAL ESTIMADO: $${totalGeneral}*`;
            return { content: [{ type: "text", text: responseText }] };
        }

        if (name === "clear_cart") {
            const cartId = args?.cart_id || args?.conversation_id;

            if (!cartId) {
                return { content: [{ type: "text", text: "Error: necesito cart_id o conversation_id para vaciar el carrito." }], isError: true };
            }

            console.log(`[CART] Vaciando carrito: ${cartId}`);

            const { error } = await supabase
                .from("cart_items")
                .delete()
                .eq("cart_id", cartId);

            if (error) {
                console.error("[CART-ERROR] clear_cart:", error.message);
                throw error;
            }

            return { content: [{ type: "text", text: "✅ Carrito vaciado correctamente." }] };
        }

        if (name === "handover_to_human") {
            return { content: [{ type: "text", text: `🔄 Derivando a un humano por: ${args?.reason}` }] };
        }

        return { content: [{ type: "text", text: "Herramienta no encontrada" }], isError: true };
    } catch (err: any) {
        console.error("[MCP-ERROR]", err.message);
        return { content: [{ type: "text", text: `Error en la operación: ${err.message}` }], isError: true };
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
        const server = new Server({ name: "clothes-agent-mcp", version: "2.1.0" }, { capabilities: { tools: {} } });

        if (url.pathname === "/") return new Response("Clothes Sales MCP v2.1.0 - Advanced Search Enabled");

        if (url.pathname.startsWith("/events")) {
            const sessionId = url.searchParams.get("sessionId") || url.pathname.split("/")[2];

            if (request.method === "GET") {
                const newSessionId = crypto.randomUUID();
                const { readable, writable } = new TransformStream();
                const writer = writable.getWriter();
                const encoder = new TextEncoder();
                const transport = {
                    start: async () => { },
                    onClose: () => sessions.delete(newSessionId),
                    onError: () => sessions.delete(newSessionId),
                    onMessage: () => { },
                    send: async (msg: any) => { try { await writer.write(encoder.encode(`event: message\ndata: ${JSON.stringify(msg)}\n\n`)); } catch (e) { } },
                    close: async () => { sessions.delete(newSessionId); }
                };
                await server.connect(transport as any);
                sessions.set(newSessionId, (msg) => (transport as any).onMessage(msg));
                const endpointUrl = new URL(request.url);
                endpointUrl.searchParams.set("sessionId", newSessionId);
                (async () => {
                    try {
                        await writer.write(encoder.encode(`event: endpoint\ndata: ${endpointUrl.toString()}\n\n`));
                        setInterval(() => { writer.write(encoder.encode(": heartbeat\n\n")).catch(() => { }); }, 15000);
                    } catch (e) { }
                })();
                return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" } });
            }

            if (request.method === "POST") {
                try {
                    // LOG COMPLETO DE LA PETICIÓN HTTP
                    console.log("=== PETICIÓN HTTP COMPLETA ===");
                    console.log("URL:", request.url);
                    console.log("Method:", request.method);
                    console.log("Headers:");
                    request.headers.forEach((value, key) => {
                        console.log(`  ${key}: ${value}`);
                    });

                    const body = await request.json() as any;

                    console.log("Body JSON:");
                    console.log(JSON.stringify(body, null, 2));
                    console.log("=== FIN PETICIÓN ===");

                    if (body.method === "initialize" || body.method === "tools/list") {
                        const result = (body.method === "initialize")
                            ? { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "clothes-agent-mcp", version: "2.2.0" } }
                            : { tools: TOOLS };
                        return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
                    }

                    // Flujo Híbrido: Intentar sesión -> Fallback Stateless
                    const onMessage = sessionId ? sessions.get(sessionId) : null;
                    if (onMessage) {
                        onMessage(body);
                        return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "accepted" }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
                    }

                    // Stateless Fallback (v2.2.0)
                    const result = await executeToolLogic(body.params.name, body.params.arguments, supabase);
                    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

                } catch (err: any) {
                    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 0, error: { code: -32603, message: err.message } }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
                }
            }
        }
        return new Response("Not Found", { status: 404 });
    }
};
