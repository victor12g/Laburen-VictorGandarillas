import { SupabaseClient } from "@supabase/supabase-js";

interface CartArgs {
    cart_id?: string;
    conversation_id?: string; // Alternativa a cart_id
    product_id?: string;
    qty?: number;
}

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

    if (!productId || qty === undefined || qty <= 0) {
        return { content: [{ type: "text", text: "Error: necesito product_id y qty positivo." }], isError: true };
    }

    if (!cartId) {
        const newCartId = crypto.randomUUID();
        // Asegurar que el carrito existe
        const { error: cError } = await supabase.from("carts").upsert({ id: newCartId }, { onConflict: "id" });
        if (cError) {
            console.error("[CART-ERROR] add_to_cart (upsert cart):", cError.message);
            throw cError;
        }
    }

    // Consultar cantidad actual en el carrito
    const finalCartId = cartId || crypto.randomUUID();
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

export async function updateCart(supabase: SupabaseClient, args: CartArgs) {
    const cartId = getCartId(args);
    const productId = args.product_id;
    const qty = args.qty;

    if (!productId || qty === undefined) {
        return { content: [{ type: "text", text: "Error: necesito product_id y qty." }], isError: true };
    }

    if (!cartId) {
        return { content: [{ type: "text", text: "Error: necesito cart_id o conversation_id." }], isError: true };
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
