// Helper: Crear o obtener conversación en Chatwoot
export async function ensureConversationExists(supabase: any, cartId: string, env: any): Promise<number | null> {
    try {
        const baseUrl = env.CHATWOOT_BASE_URL;
        const accountId = env.CHATWOOT_ACCOUNT_ID;
        const apiToken = env.CHATWOOT_API_TOKEN;
        const inboxId = parseInt(env.CHATWOOT_INBOX_ID);
        const contactId = parseInt(env.CHATWOOT_CONTACT_ID);
        const sourceId = env.CHATWOOT_SOURCE_ID;

        // 1. Verificar si ya existe conversación para este carrito en BD
        const { data: cartData } = await supabase
            .from("carts")
            .select("chatwoot_conversation_id")
            .eq("id", cartId)
            .single();

        if (cartData?.chatwoot_conversation_id) {
            console.log(`[CHATWOOT-ENSURE] Conversación existente: ${cartData.chatwoot_conversation_id}`);
            return cartData.chatwoot_conversation_id;
        }

        // 2. EXTRAER conversation_id embebido en el cart_id
        // Formato: chatwoot_<id_hash>_<num1>_<num2>_<conversationId>
        // Ejemplo: chatwoot_cmkrh42x605q011mugkc9sji9_34_44_14 → conversationId = 14 (último)
        let conversationId: number | null = null;
        if (cartId.startsWith("chatwoot_")) {
            const parts = cartId.replace("chatwoot_", "").split("_");
            const extracted = parseInt(parts[parts.length - 1]); // ÚLTIMO número
            if (!isNaN(extracted) && extracted > 0) {
                conversationId = extracted;
                console.log(`[CHATWOOT-ENSURE] Conversation ID extraído del cart_id: ${conversationId}`);

                // Guardar en BD para futuras referencias
                await supabase
                    .from("carts")
                    .update({
                        chatwoot_conversation_id: conversationId,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", cartId);

                return conversationId;
            }
        }

        // 3. Si CREATE_CONVERSATION_FALLBACK está desactivado, no crear nueva
        if (env.CREATE_CONVERSATION_FALLBACK === "false") {
            console.log(`[CHATWOOT-ENSURE] CREATE_CONVERSATION_FALLBACK=false: No se creará conversación nueva`);
            return null;
        }

        // 4. Fallback: Crear nueva conversación (solo si está habilitado)
        console.log(`[CHATWOOT-ENSURE] Creando nueva conversación para carrito ${cartId}...`);
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
            const error = await createResp.text();
            console.error(`[CHATWOOT-ENSURE] Error creando conversación: ${createResp.status} - ${error}`);
            return null;
        }

        const createData = await createResp.json();
        conversationId = createData.data?.id;

        if (!conversationId) {
            console.error("[CHATWOOT-ENSURE] No se devolvió conversation ID");
            return null;
        }

        // 5. Guardar conversation ID en la tabla carts
        await supabase
            .from("carts")
            .update({
                chatwoot_conversation_id: conversationId,
                updated_at: new Date().toISOString()
            })
            .eq("id", cartId);

        console.log(`[CHATWOOT-ENSURE] Conversación creada y guardada: ${conversationId}`);
        return conversationId;
    } catch (err: any) {
        console.error("[CHATWOOT-ENSURE-ERROR]", err.message);
        return null;
    }
}

// Helper: Agregar labels a una conversación en Chatwoot
async function addLabelsToConversation(conversationId: number, labels: string[], env: any) {
    try {
        const baseUrl = env.CHATWOOT_BASE_URL;
        const accountId = env.CHATWOOT_ACCOUNT_ID;
        const apiToken = env.CHATWOOT_API_TOKEN;

        const response = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api_access_token": apiToken
            },
            body: JSON.stringify({ labels })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`[CHATWOOT-LABEL] Error al agregar labels: ${response.status} - ${error}`);
            return;
        }

        console.log(`[CHATWOOT-LABEL] Labels agregados a conversación ${conversationId}: ${labels.join(", ")}`);
    } catch (err: any) {
        console.error("[CHATWOOT-LABEL-ERROR]", err.message);
    }
}

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

        console.log(`[CHATWOOT] Iniciando derivación para carrito: ${cart_id}`);

        // 1. Obtener conversación (extrayendo del cart_id o usando fallback)
        const conversationId = await ensureConversationExists(supabase, cart_id, env);
        
        if (!conversationId) {
            return {
                content: [{
                    type: "text",
                    text: "❌ Error: No se pudo obtener la conversación de soporte. Por favor, intenta nuevamente o contacta a soporte."
                }],
                isError: true
            };
        }

        // 2. Cambiar estado de la conversación a "open"
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

        // 3. Agregar etiquetas (opcional)
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
                        labels: ["handover", reason]
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

        // 1. VALIDAR QUE EL CARRITO NO ESTÉ YA RESERVADO
        const { data: cartData, error: cartError } = await supabase
            .from("carts")
            .select("status")
            .eq("id", cart_id)
            .single();

        if (cartError && cartError.code !== 'PGRST116') {
            console.error("[HANDOVER-PURCHASE] Error al validar carrito:", cartError.message);
        }

        console.log(`[HANDOVER-PURCHASE] Estado del carrito: ${cartData?.status || 'no encontrado'}`);

        if (cartData?.status === "reserved") {
            console.log(`[HANDOVER-PURCHASE] Carrito ya está en estado reserved, bloqueando intento`);
            return {
                content: [{
                    type: "text",
                    text: "⏳ **Tu carrito fue pasado a proceso de compra con anterioridad y fue derivado a un agente humano.** Por favor espera a que se comunique contigo para finalizar los detalles. No puedes proceder nuevamente."
                }],
                isError: true
            };
        }

        // 2. LIMPIEZA PREVENTIVA: por si el cron no ejecutó
        await cleanupExpiredReservations(supabase);

        // 3. OBTENER ITEMS DEL CARRITO
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
        const handoverResult = await handoverToHuman(supabase, {
            cart_id,
            reason: `Compra: ${reason}`
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
