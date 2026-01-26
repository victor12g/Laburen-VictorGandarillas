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

    // Obtener stock
    const { data: product, error: pError } = await supabase
        .from("products")
        .select("CANTIDAD_DISPONIBLE, TIPO_PRENDA, COLOR, TALLA")
        .eq("ID", productId)
        .single();

    if (pError || !product) {
        return { content: [{ type: "text", text: "Error: producto no encontrado." }], isError: true };
    }

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

    // Upsert (insertar o sumar)
    const { error: iError } = await supabase.from("cart_items").upsert({
        cart_id: finalCartId,
        product_id: productId,
        qty: totalQty // Guardamos el gran total
    }, { onConflict: "cart_id,product_id" });

    if (iError) {
        console.error("[CART-ERROR] add_to_cart (upsert item):", iError.message);
        throw iError;
    }

    return { content: [{ type: "text", text: `✅ Producto añadido. ${product.TIPO_PRENDA} ${product.COLOR}: ahora tienes ${totalQty} unidades.` }] };
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
        const { error } = await supabase
            .from("cart_items")
            .delete()
            .eq("cart_id", cartId)
            .eq("product_id", productId);

        if (error) {
            console.error("[CART-ERROR] remove_item:", error.message);
            throw error;
        }
        return { content: [{ type: "text", text: "✅ Producto eliminado del carrito." }] };
    }

    // --- ACTUALIZAR/AGREGAR ---

    // 1. Verificar existencia y stock del producto
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

    // 2. Asegurar carrito
    await supabase.from("carts").upsert({ id: cartId }, { onConflict: "id" });

    // 3. Consultar item actual (si existe) para saber total acumulado si estuviéramos sumando... 
    // PERO update_cart típicamente "fija" la cantidad. 
    // Si queremos que funcione como "agregador" inteligente (sumar):
    // El LLM suele decir "agrega 5". Si hay 10, espera que sean 15.
    // Si dice "quita 2", espera que sean X-2.
    // Para simplificar, asumiremos que el LLM está enviando la cantidad FINAL deseada o la cantidad a agregar.
    // DADO QUE eliminamos add_to_cart, lo mejor es que update_cart SIEMPRE SUME si el producto ya existe, 
    // salvo que el LLM explícitamente diga "poner en X".
    // PERO esto es ambiguo.
    // MEJOR ESTRATEGIA: update_cart = FIJAR CANTIDAD (Override).
    // Si el usuario dice "agrega 5 más", el LLM debe leer view_cart (tiene 10) -> calcular 15 -> mandar qty=15.
    // ESTO ES LO MÁS SEGURO y evita la lógica de "suma oculta".

    // VALIDACIÓN DE STOCK CONTRA LA CANTIDAD SOLICITADA (qty es el target)
    if (product.CANTIDAD_DISPONIBLE < qty) {
        return {
            content: [{
                type: "text",
                text: `⚠️ Stock insuficiente. Quieres ${qty} unidades, pero solo quedan ${product.CANTIDAD_DISPONIBLE} disponibles de ${product.TIPO_PRENDA} ${product.COLOR}.`
            }],
            isError: true
        };
    }

    // 4. Guardar (Upsert con la nueva cantidad fija)
    const { error: iError } = await supabase.from("cart_items").upsert({
        cart_id: cartId,
        product_id: productId,
        qty: qty
    }, { onConflict: "cart_id,product_id" });

    if (iError) {
        console.error("[CART-ERROR] update_cart:", iError.message);
        throw iError;
    }

    return { content: [{ type: "text", text: `✅ Carrito actualizado. ${product.TIPO_PRENDA}: ${qty} unidades.` }] };
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

    return { content: [{ type: "text", text: "✅ Carrito vaciado correctamente." }] };
}

export async function viewCart(supabase: SupabaseClient, args: CartArgs) {
    const cartId = getCartId(args);

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
