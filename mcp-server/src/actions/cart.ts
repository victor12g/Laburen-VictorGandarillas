import { SupabaseClient } from "@supabase/supabase-js";
import { ensureConversationExists } from "./chatwoot.js";

interface CartArgs {
    cart_id?: string;
    conversation_id?: string; // Alternativa a cart_id
    product_id?: string;
    qty?: number;
}

// ============ SECURITY VALIDATORS ============

/**
 * Validates that quantity is a positive integer (no decimals)
 * @returns { isValid: boolean, error?: string }
 */
export function validateQuantity(qty: any): { isValid: boolean; error?: string } {
    if (qty === undefined || qty === null) {
        return { isValid: false, error: "La cantidad es requerida." };
    }

    // Check if it's an integer
    if (!Number.isInteger(qty)) {
        return { 
            isValid: false, 
            error: "La cantidad debe ser un número entero (ej: 5, no 1,5). Los pantalones se venden por unidades completas." 
        };
    }

    // Check if it's positive
    if (qty <= 0) {
        return { isValid: false, error: "La cantidad debe ser mayor a 0." };
    }

    return { isValid: true };
}

/**
 * Sanitize and validate ID formats to prevent SQL injection
 * @returns { isValid: boolean, error?: string }
 */
export function validateId(id: any, idType: string = "ID"): { isValid: boolean; error?: string } {
    if (!id || typeof id !== "string") {
        return { isValid: false, error: `${idType} inválido.` };
    }

    if (id.trim().length === 0) {
        return { isValid: false, error: `${idType} no puede estar vacío.` };
    }

    // Allow alphanumeric, hyphens, and underscores (safe for IDs)
    const safeIdRegex = /^[\d\w-]+$/;
    if (!safeIdRegex.test(id)) {
        return { 
            isValid: false, 
            error: `${idType} contiene caracteres no permitidos. Intenta nuevamente.` 
        };
    }

    return { isValid: true };
}

/**
 * Sanitize reason/text input to prevent XSS
 * @returns { isValid: boolean, sanitized: string, error?: string }
 */
export function sanitizeText(text: any): { isValid: boolean; sanitized: string; error?: string } {
    if (!text || typeof text !== "string") {
        return { isValid: false, sanitized: "", error: "Texto inválido." };
    }

    // Remove potentially dangerous characters/sequences
    const sanitized = text
        .replace(/[<>\"';]/g, "") // Remove HTML/SQL special chars
        .trim();

    if (sanitized.length === 0) {
        return { isValid: false, sanitized: "", error: "El texto no puede estar vacío." };
    }

    if (sanitized.length > 500) {
        return { isValid: false, sanitized: "", error: "El texto es muy largo (máximo 500 caracteres)." };
    }

    return { isValid: true, sanitized };
}

// ============ HELPERS ============

// Helper para obtener ID de cart limpio
function getCartId(args: CartArgs): string | undefined {
    return args.cart_id || args.conversation_id;
}

export async function createCart(supabase: SupabaseClient, args: CartArgs) {
    const cartId = getCartId(args) || crypto.randomUUID();

    console.log(`[CART] Creando/reutilizando carrito: ${cartId}`);

    // Usar upsert para asegurar que exista sin fallar
    const { error } = await supabase
        .from("carts")
        .upsert({ id: cartId }, { onConflict: "id" })
        .select()
        .single();

    if (error) {
        console.error("[CART-ERROR] create_cart:", error.message);
        throw error;
    }

    return { content: [{ type: "text", text: `Carrito listo. ID: ${cartId}` }] };
}

export async function addToCart(supabase: SupabaseClient, args: CartArgs) {
    const cartId = getCartId(args);
    const productId = args.product_id;
    const qty = args.qty;

    // ✅ VALIDATE QUANTITY
    const qtyValidation = validateQuantity(qty);
    if (!qtyValidation.isValid) {
        return { content: [{ type: "text", text: `Error: ${qtyValidation.error}` }], isError: true };
    }

    // ✅ VALIDATE PRODUCT ID
    if (!productId) {
        return { content: [{ type: "text", text: "Error: product_id es requerido." }], isError: true };
    }
    const productIdValidation = validateId(productId, "product_id");
    if (!productIdValidation.isValid) {
        return { content: [{ type: "text", text: `Error: ${productIdValidation.error}` }], isError: true };
    }

    // ✅ VALIDATE CART ID (REQUIRED)
    if (!cartId) {
        return { 
            content: [{ 
                type: "text", 
                text: "Error: cart_id o conversation_id es requerido. Por favor, consulta el carrito actual primero o proporciona un identificador válido." 
            }], 
            isError: true 
        };
    }
    const cartIdValidation = validateId(cartId, "cart_id");
    if (!cartIdValidation.isValid) {
        return { content: [{ type: "text", text: `Error: ${cartIdValidation.error}` }], isError: true };
    }

    // Consultar cantidad actual en el carrito
    const finalCartId = cartId;
    const { data: currentItem } = await supabase
        .from("cart_items")
        .select("qty")
        .eq("cart_id", finalCartId)
        .eq("product_id", productId)
        .single();

    // Obtener stock y precios
    const { data: product, error: pError } = await supabase
        .from("products")
        .select("stock, name, color, size, price_50_u, price_100_u, price_200_u")
        .eq("id", productId)
        .single();

    if (pError || !product) {
        return { content: [{ type: "text", text: "Error: producto no encontrado." }], isError: true };
    }

    const currentQty = currentItem?.qty || 0;
    const totalQty = currentQty + qty;

    console.log(`[CART] Stock Check: Actual=${currentQty}, Nuevo=${qty}, Total=${totalQty}, Disponible=${product.stock}`);

    // Validar stock con el TOTAL acumulado
    if (product.stock < totalQty) {
        return {
            content: [{
                type: "text",
                text: `⚠️ Stock insuficiente. Tienes ${currentQty} en carrito y quieres sumar ${qty} (Total: ${totalQty}), pero solo hay ${product.stock} disponibles.`
            }],
            isError: true
        };
    }

    // Upsert (insertar o sumar)
    const { error: iError } = await supabase.from("cart_items").upsert({
        cart_id: finalCartId,
        product_id: productId,
        qty: totalQty, // Guardamos el gran total
        price: totalQty >= 200 ? product.price_200_u :
               totalQty >= 100 ? product.price_100_u :
               product.price_50_u
    }, { onConflict: "cart_id,product_id" });

    if (iError) {
        console.error("[CART-ERROR] add_to_cart (upsert item):", iError.message);
        throw iError;
    }

    // Recalcular total del carrito
    const { data: allItems } = await supabase
        .from("cart_items")
        .select("qty, price")
        .eq("cart_id", finalCartId);

    const newTotal = (allItems || []).reduce((sum, item) => sum + (item.qty * item.price), 0);

    await supabase
        .from("carts")
        .update({ total: newTotal, updated_at: new Date().toISOString() })
        .eq("id", finalCartId);

    return { content: [{ type: "text", text: `✅ Producto añadido. ${product.name} ${product.color}: ahora tienes ${totalQty} unidades. Total: $${newTotal}` }] };
}

export async function updateCart(supabase: SupabaseClient, args: CartArgs, env?: any) {
    const cartId = getCartId(args);
    const productId = args.product_id;
    const qty = args.qty;

    if (!productId || qty === undefined) {
        return { content: [{ type: "text", text: "Error: necesito product_id y qty." }], isError: true };
    }

    if (!cartId) {
        return { content: [{ type: "text", text: "Error: necesito cart_id o conversation_id." }], isError: true };
    }

    // VALIDAR QUE EL CARRITO NO ESTÉ RESERVADO
    const { data: cartData } = await supabase
        .from("carts")
        .select("status")
        .eq("id", cartId)
        .single();

    if (cartData?.status === "reserved") {
        return {
            content: [{
                type: "text",
                text: "⏳ Tu carrito está en proceso de compra y fue derivado a un agente humano. Por favor espera a que se comunique contigo para finalizar los detalles."
            }],
            isError: true
        };
    }

    // --- ELIMINAR ---
    if (qty <= 0) {
        // Primero verificar que el producto existe en el carrito con ese exact product_id
        const { data: existingItem, error: checkError } = await supabase
            .from("cart_items")
            .select("product_id, qty")
            .eq("cart_id", cartId)
            .eq("product_id", productId)
            .single();

        if (checkError || !existingItem) {
            console.error(`[CART-ERROR] remove_item: Product ID "${productId}" not found in cart ${cartId}`);
            return {
                content: [{
                    type: "text",
                    text: `❌ No encontré un producto con ID "${productId}" en tu carrito. Esto puede ocurrir si el ID es incorrecto. Por favor, verifica con list_products cuál es el ID exacto del producto que deseas eliminar.`
                }],
                isError: true
            };
        }

        // Ahora eliminar
        const { error } = await supabase
            .from("cart_items")
            .delete()
            .eq("cart_id", cartId)
            .eq("product_id", productId);

        if (error) {
            console.error("[CART-ERROR] remove_item (delete):", error.message);
            throw error;
        }

        // Recalcular total del carrito
        const { data: allItems } = await supabase
            .from("cart_items")
            .select("qty, price")
            .eq("cart_id", cartId);

        const newTotal = (allItems || []).reduce((sum, item) => sum + (item.qty * item.price), 0);

        await supabase
            .from("carts")
            .update({ total: newTotal, updated_at: new Date().toISOString() })
            .eq("id", cartId);

        return { content: [{ type: "text", text: "✅ Producto eliminado del carrito." }] };
    }

    // --- ACTUALIZAR/AGREGAR ---

    // 1. Verificar existencia y stock del producto
    const { data: product, error: pError } = await supabase
        .from("products")
        .select("id, stock, name, color, size, price_50_u, price_100_u, price_200_u")
        .eq("id", productId)
        .single();

    if (pError || !product) {
        return {
            content: [{ type: "text", text: `Error: El producto con ID "${productId}" no existe. Por favor, usa list_products para obtener el ID real.` }],
            isError: true
        };
    }

    // 2. Asegurar carrito
    await supabase.from("carts").upsert({ id: cartId }, { onConflict: "id" });

    // 3. Obtener cantidad ACTUAL en carrito para validar stock correctamente
    const { data: currentItem } = await supabase
        .from("cart_items")
        .select("qty")
        .eq("cart_id", cartId)
        .eq("product_id", productId)
        .single();

    const currentQty = currentItem?.qty || 0;

    // VALIDACIÓN DE STOCK: El stock "disponible real" es (stock total - lo que ya hay en carrito)
    // Necesitamos validar que la NUEVA cantidad no supere: stock_total
    if (product.stock < qty) {
        const availableAfterCurrent = Math.max(0, product.stock - currentQty);
        const couldAdd = currentQty + availableAfterCurrent;
        return {
            content: [{
                type: "text",
                text: `⚠️ Stock insuficiente. Actualmente tienes ${currentQty} en carrito. El stock total disponible es ${product.stock}, así que podrías tener máximo ${couldAdd} unidades de ${product.name} ${product.color}.`
            }],
            isError: true
        };
    }

    // 4. Guardar (Upsert con la nueva cantidad fija)
    const { error: iError } = await supabase.from("cart_items").upsert({
        cart_id: cartId,
        product_id: productId,
        qty: qty,
        price: product.stock < qty ? 0 : (
            qty >= 200 ? product.price_200_u :
            qty >= 100 ? product.price_100_u :
            product.price_50_u
        )
    }, { onConflict: "cart_id,product_id" });
    if (iError) {
        console.error("[CART-ERROR] update_cart:", iError.message);
        throw iError;
    }

    // 5. Recalcular y actualizar total del carrito
    const { data: allItems } = await supabase
        .from("cart_items")
        .select("qty, price")
        .eq("cart_id", cartId);

    const newTotal = (allItems || []).reduce((sum, item) => sum + (item.qty * item.price), 0);

    await supabase
        .from("carts")
        .update({ total: newTotal, updated_at: new Date().toISOString() })
        .eq("id", cartId);

    // 6. AGREGAR LABEL A CHATWOOT (solo si es primer item)
    if (env && currentQty === 0) {
        try {
            const conversationId = await ensureConversationExists(supabase, cartId, env);
            
            if (conversationId) {
                const label = `${product.id} ${product.name} ${product.color} ${product.size}`;
                console.log(`[CART-LABEL] Agregando label "${label}" a conversación ${conversationId}`);

                await fetch(`${env.CHATWOOT_BASE_URL}/api/v1/accounts/${env.CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/labels`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "api_access_token": env.CHATWOOT_API_TOKEN
                    },
                    body: JSON.stringify({ labels: [label] })
                }).catch(err => console.log(`[CART-LABEL-ERROR]`, err.message));
            }
        } catch (err) {
            console.log("[CART-LABEL-SILENT] Skipping label:", (err as any).message);
        }
    }

    return { content: [{ type: "text", text: `✅ Carrito actualizado. ${product.name}: ${qty} unidades. Total: $${newTotal}` }] };
}

export async function clearCart(supabase: SupabaseClient, args: CartArgs) {
    const cartId = getCartId(args);

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

    // Resetear total a 0
    await supabase
        .from("carts")
        .update({ total: 0, updated_at: new Date().toISOString() })
        .eq("id", cartId);

    return { content: [{ type: "text", text: "✅ Carrito vaciado correctamente." }] };
}

export async function viewCart(supabase: SupabaseClient, args: CartArgs) {
    const cartId = getCartId(args);

    if (!cartId) {
        return { content: [{ type: "text", text: "Error: necesito cart_id o conversation_id para ver el carrito." }], isError: true };
    }

    console.log(`[CART] Consultando carrito: ${cartId}`);

    // Obtener datos del carrito (incluyendo total)
    const { data: cartData, error: cartError } = await supabase
        .from("carts")
        .select("total")
        .eq("id", cartId)
        .single();

    if (cartError && cartError.code !== 'PGRST116') throw cartError; // PGRST116 = no rows found

    // Obtener items del carrito
    const { data, error } = await supabase
        .from("cart_items")
        .select(`
            qty,
            price,
            products (
                name,
                size,
                color
            )
        `)
        .eq("cart_id", cartId);

    if (error) throw error;

    if (!data || data.length === 0) {
        return { content: [{ type: "text", text: "El carrito está vacío." }] };
    }

    // Construir detalle de items
    const itemsDetalle: string[] = [];
    for (const item of data) {
        const p = item.products as any;
        const subtotal = item.qty * item.price;
        itemsDetalle.push(`- ${item.qty}x ${p.name} ${p.color} (${p.size}) a $${item.price}/u = $${subtotal}`);
    }

    const cartTotal = cartData?.total || 0;
    const responseText = `🛒 *CARRITO ACTUAL*:\n\n${itemsDetalle.join("\n")}\n\n💰 *TOTAL: $${cartTotal}*`;
    return { content: [{ type: "text", text: responseText }] };
}
