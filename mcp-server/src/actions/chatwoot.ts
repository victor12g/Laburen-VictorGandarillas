// Helper: Crear o obtener conversación en Chatwoot
export async function ensureConversationExists(supabase: any, cartId: string, env: any): Promise<number | null> {
    try {
        const baseUrl = env.CHATWOOT_BASE_URL;
        const accountId = env.CHATWOOT_ACCOUNT_ID;
        const apiToken = env.CHATWOOT_API_TOKEN;
        const inboxId = parseInt(env.CHATWOOT_INBOX_ID);
        const contactId = parseInt(env.CHATWOOT_CONTACT_ID);
        const sourceId = env.CHATWOOT_SOURCE_ID;

        let realConversationId: number | null = null;

        // 0. Extraer ID real de Chatwoot en múltiples formatos:
        // Formato 1: "chatwoot_xxxxx_accountId_inboxId_conversationId" → extrae conversationId
        const chatwootMatch = cartId.match(/_(\d+)_(\d+)_(\d+)$/);
        if (chatwootMatch) {
            const [, , , conversationIdStr] = chatwootMatch;
            realConversationId = parseInt(conversationIdStr);
            console.log(`[CHATWOOT-ENSURE] Formato Chatwoot completo detectado → conversation ID: ${realConversationId}`);
        }
        
        // Formato 2: Solo número "14" → úsalo directo
        if (!realConversationId && /^\d+$/.test(cartId)) {
            realConversationId = parseInt(cartId);
            console.log(`[CHATWOOT-ENSURE] Formato número detectado → conversation ID: ${realConversationId}`);
        }

        // Si extrajimos un ID válido, verificarlo en Chatwoot
        if (realConversationId) {
            console.log(`[CHATWOOT-ENSURE] Verificando conversación ${realConversationId} en Chatwoot...`);
            const verifyResp = await fetch(
                `${baseUrl}/api/v1/accounts/${accountId}/conversations/${realConversationId}`,
                {
                    method: "GET",
                    headers: {
                        "api_access_token": apiToken,
                        "Accept": "application/json"
                    }
                }
            );
            
            if (verifyResp.ok) {
                console.log(`[CHATWOOT-ENSURE] Conversación Chatwoot verificada: ${realConversationId}`);
                // Guardar en DB para futuras referencias
                await supabase
                    .from("carts")
                    .update({
                        chatwoot_conversation_id: realConversationId,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", cartId)
                    .then(() => console.log(`[CHATWOOT-ENSURE] Conversation ID ${realConversationId} guardado en DB`));
                return realConversationId;
            } else {
                console.warn(`[CHATWOOT-ENSURE] Conversación ${realConversationId} no válida o no accesible`);
                realConversationId = null;
            }
        }

        // 1. Fallback: Verificar si ya existe conversación para este carrito en DB
        const { data: cartData } = await supabase
            .from("carts")
            .select("chatwoot_conversation_id")
            .eq("id", cartId)
            .single();

        if (cartData?.chatwoot_conversation_id) {
            console.log(`[CHATWOOT-ENSURE] Conversación existente en DB: ${cartData.chatwoot_conversation_id}`);
            return cartData.chatwoot_conversation_id;
        }

        // 2. Si no existe conversación, verificar si está habilitado el fallback
        const createFallback = env.CREATE_CONVERSATION_FALLBACK === 'true';
        if (!createFallback) {
            console.warn(`[CHATWOOT-ENSURE] No se encontró conversación y CREATE_CONVERSATION_FALLBACK está deshabilitado`);
            return null;
        }

        // 3. Crear nueva conversación (solo si fallback está habilitado)
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
        const conversationId = createData.data?.id;

        if (!conversationId) {
            console.error("[CHATWOOT-ENSURE] No se devolvió conversation ID");
            return null;
        }

        // 4. Guardar conversation ID en la tabla carts
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
// Helper: Agregar labels a una conversación SIN borrar las existentes
export async function addLabelsToConversation(conversationId: number, newLabels: string[], env: any) {
    try {
        const baseUrl = env.CHATWOOT_BASE_URL;
        const accountId = env.CHATWOOT_ACCOUNT_ID;
        const apiToken = env.CHATWOOT_API_TOKEN;

        // 1. Obtener las etiquetas EXISTENTES de la conversación
        const getResponse = await fetch(
            `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}`,
            {
                method: "GET",
                headers: {
                    "api_access_token": apiToken,
                    "Accept": "application/json"
                }
            }
        );

        if (!getResponse.ok) {
            console.warn(`[CHATWOOT-LABEL] No se pudieron obtener etiquetas existentes, agregando solo las nuevas`);
        }

        const convData = await getResponse.json();
        const existingLabels = convData.data?.labels || [];
        console.log(`[CHATWOOT-LABEL] Etiquetas existentes: ${existingLabels.join(", ")}`);

        // 2. Combinar etiquetas (viejas + nuevas, sin duplicados)
        const allLabels = [...new Set([...existingLabels, ...newLabels])];
        console.log(`[CHATWOOT-LABEL] Etiquetas combinadas: ${allLabels.join(", ")}`);

        // 3. POST con TODAS las etiquetas
        const postResponse = await fetch(
            `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/labels`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api_access_token": apiToken
                },
                body: JSON.stringify({ labels: allLabels })
            }
        );

        if (!postResponse.ok) {
            const error = await postResponse.text();
            console.error(`[CHATWOOT-LABEL] Error al agregar labels: ${postResponse.status} - ${error}`);
            return;
        }

        console.log(`[CHATWOOT-LABEL] Labels agregados correctamente: ${allLabels.join(", ")}`);
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

        // 1. Usar ensureConversationExists para extraer/verificar/crear conversation ID
        const conversationId = await ensureConversationExists(supabase, cart_id, env);

        if (!conversationId) {
            return {
                content: [{ type: "text", text: "Error: No se pudo obtener conversación en Chatwoot" }],
                isError: true
            };
        }

        console.log(`[CHATWOOT] Conversation ID asegurado: ${conversationId}`);

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

        // 4. Agregar etiquetas (SIN borrar las existentes)
        try {
            await addLabelsToConversation(conversationId, ["handover", reason.toLowerCase().replace(/\s+/g, "_")], env);
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

        // 6. CREAR ETIQUETAS DE COMPRA CON DETALLES DE CADA PRODUCTO
        // Construir resumen de compra: "compra 200u 094 pantalon gris xl + 100u 2gfzzqze remera azul l"
        let purchaseSummary = "compra ";
        const productLabels = [];
        
        for (let i = 0; i < cartItems.length; i++) {
            const item = cartItems[i];
            const { data: product } = await supabase
                .from("products")
                .select("id, name, color, size")
                .eq("id", item.product_id)
                .single();
            
            if (product) {
                const productLabel = `${item.qty}u ${product.id} ${product.name} ${product.color} ${product.size}`
                    .toLowerCase();
                productLabels.push(productLabel);
                purchaseSummary += productLabel;
                if (i < cartItems.length - 1) {
                    purchaseSummary += " + ";
                }
            }
        }

        // 7. DERIVAR A HUMANO PARA PROCESAR PAGO CON ETIQUETAS DETALLADAS
        const handoverResult = await handoverToHuman(supabase, {
            cart_id,
            reason: purchaseSummary
        }, env);

        // 8. RESPUESTA FINAL
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
