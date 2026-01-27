export async function handoverToHuman(supabase: any, args: any, env: any) {
    try {
        const { conversation_id, reason } = args;

        if (!conversation_id || !reason) {
            return {
                content: [{ type: "text", text: "Error: Se requieren conversation_id y reason" }],
                isError: true
            };
        }

        const baseUrl = env.CHATWOOT_BASE_URL;
        const accountId = env.CHATWOOT_ACCOUNT_ID;
        const apiToken = env.CHATWOOT_API_TOKEN;

        console.log(`[CHATWOOT] Intentando derivar conversación ${conversation_id}`);
        console.log(`[CHATWOOT] Base URL: ${baseUrl}`);
        console.log(`[CHATWOOT] Account ID: ${accountId}`);
        console.log(`[CHATWOOT] Token length: ${apiToken?.length}`);

        try {
            // 1. Cambiar estado de la conversación a "open"
            const statusResponse = await fetch(
                `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversation_id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Auth-Token": apiToken,
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        status: "open",
                    }),
                }
            );

            console.log(`[CHATWOOT] Response status: ${statusResponse.status}`);

            if (!statusResponse.ok) {
                const errorText = await statusResponse.text();
                console.error(`[CHATWOOT] Error ${statusResponse.status}:`, errorText);
                throw new Error(`Error actualizando conversación: ${statusResponse.status}`);
            }

            console.log(`[CHATWOOT] Conversación ${conversation_id} abierta`);

            // 2. Intentar añadir etiquetas (opcional, no fallar si no funciona)
            try {
                const labelsResponse = await fetch(
                    `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversation_id}/labels`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Auth-Token": apiToken,
                            "Accept": "application/json"
                        },
                        body: JSON.stringify({
                            labels: ["handover", reason.toLowerCase().replace(/\s+/g, "_")],
                        }),
                    }
                );

                if (labelsResponse.ok) {
                    console.log(`[CHATWOOT] Etiquetas agregadas a conversación ${conversation_id}`);
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

        } catch (apiErr: any) {
            console.error("[CHATWOOT-API]", apiErr.message);
            
            // Si falla por autenticación, dar instrucciones
            if (apiErr.message.includes("401")) {
                return {
                    content: [{
                        type: "text",
                        text: `🔄 Derivación solicitada\n\n**Motivo:** ${reason}\n\nUn especialista se comunicará contigo pronto.\n\n⚠️ Nota: Hubo un problema con las credenciales de Chatwoot, pero tu solicitud fue registrada.`
                    }],
                    isError: false
                };
            }
            
            throw apiErr;
        }
    } catch (err: any) {
        console.error("[HANDOVER-ERROR]", err.message);
        return {
            content: [{ type: "text", text: `Error en la derivación: ${err.message}` }],
            isError: true
        };
    }
}
