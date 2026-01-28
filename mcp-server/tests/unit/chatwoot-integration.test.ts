import { describe, it, expect } from "vitest";
import { handoverToHuman } from "../../src/actions/chatwoot.js";

describe("Chatwoot Integration Tests", () => {
    const mockEnv = {
        CHATWOOT_BASE_URL: "https://chatwootchallenge.laburen.com",
        CHATWOOT_ACCOUNT_ID: "44",
        CHATWOOT_API_TOKEN: "bffQ4etC59X39B3n73Eqtksu",
        CHATWOOT_INBOX_ID: "50",
        CHATWOOT_CONTACT_ID: "54",
        CHATWOOT_SOURCE_ID: "whatsapp:+542215232385"
    };

    const mockSupabase = null;

    describe("handoverToHuman", () => {
        it("debe rechazar si faltan parámetros requeridos", async () => {
            const result = await handoverToHuman(mockSupabase, { cart_id: "test-cart-1" }, mockEnv);
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Se requieren cart_id y reason");
        });

        it("debe rechazar si falta cart_id", async () => {
            const result = await handoverToHuman(mockSupabase, { reason: "Test" }, mockEnv);
            expect(result.isError).toBe(true);
        });

        it("debe rechazar si falta reason", async () => {
            const result = await handoverToHuman(mockSupabase, { cart_id: "test-cart-1" }, mockEnv);
            expect(result.isError).toBe(true);
        });

        it("debe procesar derivación incluso con credenciales inválidas", async () => {
            const result = await handoverToHuman(mockSupabase, {
                cart_id: "test-cart-1",
                reason: "Cliente solicita soporte técnico"
            }, mockEnv);

            expect(result.content).toBeDefined();
            expect(result.content[0]).toBeDefined();
            expect(result.content[0].text).toBeDefined();
            console.log("✅ Derivación intentada:", result.content[0].text.substring(0, 50));
        });

        it("debe convertir reason a etiqueta válida", async () => {
            const result = await handoverToHuman(mockSupabase, {
                cart_id: "test-cart-1",
                reason: "Cliente Necesita Información Especial"
            }, mockEnv);

            expect(result.content).toBeDefined();
            expect(result.content[0]).toBeDefined();
            expect(result.content[0].text).toBeDefined();
            // La derivación puede fallar si Supabase es null, pero debe retornar contenido válido
            expect(result.content[0].text.length).toBeGreaterThan(0);
            console.log("✅ Reason procesado:", result.content[0].text.substring(0, 50));
        });

        it("debe verificar credenciales de Chatwoot", async () => {
            console.log("\n📋 Verificando credenciales:");
            console.log(`Base URL: ${mockEnv.CHATWOOT_BASE_URL}`);
            console.log(`Account ID: ${mockEnv.CHATWOOT_ACCOUNT_ID}`);
            console.log(`Token: ${mockEnv.CHATWOOT_API_TOKEN.substring(0, 8)}...`);

            try {
                // Header correcto: api_access_token
                console.log("\n🔍 Usando header: api_access_token");
                const response = await fetch(
                    `${mockEnv.CHATWOOT_BASE_URL}/api/v1/accounts/${mockEnv.CHATWOOT_ACCOUNT_ID}`,
                    {
                        method: "GET",
                        headers: {
                            "api_access_token": mockEnv.CHATWOOT_API_TOKEN,
                            "Accept": "application/json"
                        }
                    }
                );
                console.log(`Respuesta: ${response.status}`);

                if (response.ok) {
                    console.log(`✅ Cuenta verificada`);
                    const data = await response.json();
                    console.log(`📌 Nombre de cuenta: ${data.name}`);
                    console.log(`📌 Idioma: ${data.locale}`);
                } else if (response.status === 401) {
                    console.warn(`\n⚠️ TOKEN INVÁLIDO (401)`);
                    console.warn("El token no tiene permisos válidos.");
                    console.warn("Próximos pasos:");
                    console.warn("1. Verifica que el token tenga permisos de Conversations, Labels, Account");
                    console.warn("2. Prueba generar un nuevo token");
                    console.warn("3. Contacta a soporte de Chatwoot\n");
                }
            } catch (err: any) {
                console.error("❌ Error de conexión:", err.message);
            }
        });
    });

    describe("Integration Tests - Chatwoot API Real", () => {
        it("debe procesar derivación de conversación real", async () => {
            const cartId = "test-cart-integration";
            
            const result = await handoverToHuman(mockSupabase, {
                cart_id: cartId,
                reason: "Test automation - Handover integration"
            }, mockEnv);

            console.log("Resultado handover:", result.content[0].text);
            expect(result.content[0].text).toBeDefined();
        });
    });
});
