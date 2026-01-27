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
