// Helper: Limpiar reservas expiradas (> 24h)
export async function cleanupExpiredReservations(supabase: any) {
    try {
        console.log("[CLEANUP] Iniciando limpieza de reservas expiradas...");

        // 1. Encontrar carritos con reserva expirada
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: expiredCarts, error: selectError } = await supabase
            .from("carts")
            .select("id")
            .eq("status", "reserved")
            .lt("reserved_at", oneDayAgo);

        if (selectError) {
            console.error("[CLEANUP] Error al buscar reservas expiradas:", selectError);
            return;
        }

        if (!expiredCarts || expiredCarts.length === 0) {
            console.log("[CLEANUP] No hay reservas expiradas");
            return;
        }

        console.log(`[CLEANUP] Encontradas ${expiredCarts.length} reservas expiradas`);

        // 2. Para cada carrito expirado, restaurar stock
        for (const cart of expiredCarts) {
            const { data: cartItems } = await supabase
                .from("cart_items")
                .select("product_id, qty")
                .eq("cart_id", cart.id);

            if (cartItems && cartItems.length > 0) {
                for (const item of cartItems) {
                    // Restaurar stock
                    const { data: product } = await supabase
                        .from("products")
                        .select("stock")
                        .eq("id", item.product_id)
                        .single();

                    if (product) {
                        await supabase
                            .from("products")
                            .update({ stock: product.stock + item.qty })
                            .eq("id", item.product_id);

                        console.log(`[CLEANUP] Restaurado stock de ${item.product_id}: +${item.qty}`);
                    }
                }
            }

            // 3. Marcar carrito como activo de nuevo (no terminal)
            await supabase
                .from("carts")
                .update({ status: "active", reserved_at: null, updated_at: new Date().toISOString() })
                .eq("id", cart.id);

            console.log(`[CLEANUP] Carrito ${cart.id} devuelto a active`);
        }

        console.log("[CLEANUP] Limpieza completada");
    } catch (err: any) {
        console.error("[CLEANUP-ERROR]", err.message);
    }
}

export async function handoverToHuman(supabase: any, args: any, env: any) {
    try {
        const { cart_id, reason } = args;

        if (!cart_id || !reason) {
            return {
                content: [{ type: "text", text: "Error: Se requieren cart_id y reason" }],
                isError: true
            };
        }

        const baseUrl = env.CHATWOOT_BASE_URL;
        const accountId = env.CHATWOOT_ACCOUNT_ID;
        const apiToken = env.CHATWOOT_API_TOKEN;
        const inboxId = parseInt(env.CHATWOOT_INBOX_ID);
        const contactId = parseInt(env.CHATWOOT_CONTACT_ID);
        const sourceId = env.CHATWOOT_SOURCE_ID;

        console.log(`[CHATWOOT] Iniciando derivación para carrito: ${cart_id}`);
        console.log(`[CHATWOOT] Inbox: ${inboxId}, Contact: ${contactId}`);

        let conversationId: number;

        // 1. Verificar si ya existe conversación para este carrito
        const { data: cartData } = await supabase
            .from("carts")
            .select("chatwoot_conversation_id")
            .eq("id", cart_id)
            .single();

        if (cartData?.chatwoot_conversation_id) {
            conversationId = cartData.chatwoot_conversation_id;
            console.log(`[CHATWOOT] Usando conversación existente: ${conversationId}`);
        } else {
            // 2. Crear nueva conversación en Chatwoot
            console.log(`[CHATWOOT] Creando nueva conversación...`);
            const createResp = await fetch(
                `${baseUrl}/api/v1/accounts/${accountId}/conversations`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "api_access_token": apiToken,
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        inbox_id: inboxId,
                        contact_id: contactId,
                        source_id: sourceId
                    })
                }
            );

            if (!createResp.ok) {
                const errorText = await createResp.text();
                console.error(`[CHATWOOT] Error creando conversación:`, errorText);
                throw new Error(`Error creando conversación: ${createResp.status}`);
            }

            const createData = await createResp.json();
            conversationId = createData.id;
            console.log(`[CHATWOOT] Conversación creada: ${conversationId}`);

            // Guardar en BD
            await supabase
                .from("carts")
                .update({ chatwoot_conversation_id: conversationId })
                .eq("id", cart_id);
        }

        // 3. Cambiar estado de la conversación a "open"
        const statusResponse = await fetch(
            `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "api_access_token": apiToken,
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    status: "open"
                })
            }
        );

        if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            console.error(`[CHATWOOT] Error al abrir conversación:`, errorText);
            throw new Error(`Error abriendo conversación: ${statusResponse.status}`);
        }

        console.log(`[CHATWOOT] Conversación ${conversationId} abierta`);

        // 4. Agregar etiquetas (opcional)
        try {
            const labelsResponse = await fetch(
                `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "api_access_token": apiToken,
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        labels: ["handover", reason.toLowerCase().replace(/\s+/g, "_")]
                    })
                }
            );

            if (labelsResponse.ok) {
                console.log(`[CHATWOOT] Etiquetas agregadas`);
            }
        } catch (labelErr) {
            console.warn(`[CHATWOOT] Advertencia al agregar etiquetas (no crítico)`);
        }

        return {
            content: [{
                type: "text",
                text: `🔄 **Derivando a un agente humano...**\n\n**Motivo:** ${reason}\n\nUn especialista se comunicará contigo pronto para ayudarte.`
            }]
        };

    } catch (err: any) {
        console.error("[HANDOVER-ERROR]", err.message);
        return {
            content: [{ type: "text", text: `Error en la derivación: ${err.message}` }],
            isError: true
        };
    }
}

export async function handoverForPurchase(supabase: any, args: any, env: any) {
    try {
        const { cart_id, reason } = args;

        if (!cart_id || !reason) {
            return {
                content: [{ type: "text", text: "Error: Se requieren cart_id y reason" }],
                isError: true
            };
        }

        console.log(`[HANDOVER-PURCHASE] Iniciando compra para carrito: ${cart_id}`);

        // 1. LIMPIEZA PREVENTIVA: por si el cron no ejecutó
        await cleanupExpiredReservations(supabase);

        // 2. OBTENER ITEMS DEL CARRITO
        const { data: cartItems, error: itemsError } = await supabase
            .from("cart_items")
            .select("product_id, qty, price")
            .eq("cart_id", cart_id);

        if (itemsError || !cartItems || cartItems.length === 0) {
            return {
                content: [{ type: "text", text: "❌ El carrito está vacío o no existe." }],
                isError: true
            };
        }

        // 3. VALIDAR STOCK DISPONIBLE
        for (const item of cartItems) {
            const { data: product } = await supabase
                .from("products")
                .select("stock, name")
                .eq("id", item.product_id)
                .single();

            if (!product) {
                return {
                    content: [{ type: "text", text: `❌ Producto ${item.product_id} no encontrado.` }],
                    isError: true
                };
            }

            // Calcular stock reservado por otros carritos
            const { data: otherReserved } = await supabase
                .from("cart_items")
                .select("qty", { count: "exact" })
                .eq("product_id", item.product_id)
                .in("cart_id", (
                    await supabase
                        .from("carts")
                        .select("id")
                        .eq("status", "reserved")
                ).data?.map((c: any) => c.id) || []);

            const totalReservedByOthers = otherReserved?.reduce((sum: number, i: any) => sum + i.qty, 0) || 0;
            const availableStock = product.stock - totalReservedByOthers;

            if (availableStock < item.qty) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ Stock insuficiente para "${product.name}". Necesitás ${item.qty} unidades pero solo hay ${availableStock} disponibles.`
                    }],
                    isError: true
                };
            }
        }

        console.log("[HANDOVER-PURCHASE] Validación de stock OK");

        // 4. DESCONTAR STOCK
        for (const item of cartItems) {
            const { data: product } = await supabase
                .from("products")
                .select("stock")
                .eq("id", item.product_id)
                .single();

            if (product) {
                await supabase
                    .from("products")
                    .update({ stock: product.stock - item.qty })
                    .eq("id", item.product_id);

                console.log(`[HANDOVER-PURCHASE] Stock descontado: ${item.product_id} -${item.qty}`);
            }
        }

        // 5. MARCAR CARRITO COMO RESERVADO
        const now = new Date().toISOString();
        await supabase
            .from("carts")
            .update({
                status: "reserved",
                reserved_at: now,
                updated_at: now
            })
            .eq("id", cart_id);

        console.log(`[HANDOVER-PURCHASE] Carrito ${cart_id} marcado como reservado`);

        // 6. DERIVAR A HUMANO PARA PROCESAR PAGO
        const labelReason = `PAGO: ${reason}`.replace(/\s+/g, "_").toLowerCase();
        const handoverResult = await handoverToHuman(supabase, {
            cart_id,
            reason: labelReason
        }, env);

        // 7. RESPUESTA FINAL
        return {
            content: [{
                type: "text",
                text: `✅ **Compra Confirmada**\n\n${reason}\n\nTu pedido está reservado por **24 horas**. Un agente se comunicará pronto para confirmar el pago.\n\n${handoverResult.content[0].text}`
            }]
        };

    } catch (err: any) {
        console.error("[HANDOVER-PURCHASE-ERROR]", err.message);
        return {
            content: [{ type: "text", text: `Error en la compra: ${err.message}` }],
            isError: true
        };
    }
}
