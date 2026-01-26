import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import { TOOLS } from "./tools/index.js";
import { listProducts } from "./actions/products.js";
import {
    createCart,
    addToCart,
    updateCart,
    clearCart,
    viewCart
} from "./actions/cart.js";

// --- CONFIGURACIÓN ---
interface Env {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
}

const sessions = new Map<string, (message: any) => void>();

// --- HANDLER DE HERRAMIENTAS ---
async function handleToolCall(name: string, args: any, supabase: any) {
    try {
        switch (name) {
            case "list_products":
                return await listProducts(supabase, args);
            case "create_cart":
                return await createCart(supabase, args);
            case "add_to_cart":
                return await addToCart(supabase, args);
            case "update_cart":
                return await updateCart(supabase, args);
            case "view_cart":
                return await viewCart(supabase, args);
            case "clear_cart":
                return await clearCart(supabase, args);
            case "handover_to_human":
                return { content: [{ type: "text", text: `🔄 Derivando a un humano por: ${args?.reason}` }] };
            default:
                return { content: [{ type: "text", text: "Herramienta no encontrada" }], isError: true };
        }
    } catch (err: any) {
        console.error("[MCP-ERROR]", err.message);
        return { content: [{ type: "text", text: `Error en la operación: ${err.message}` }], isError: true };
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Cliente Supabase
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

        const server = new Server({ name: "clothes-agent-mcp", version: "2.2.0" }, { capabilities: { tools: {} } });

        if (url.pathname === "/") return new Response("Clothes Sales MCP v2.2.0 - Modularized");

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
                    // LOG COMPLETO DE LA PETICIÓN HTTP (Para diagnóstico)
                    console.log("=== PETICIÓN HTTP COMPLETA ===");
                    console.log("URL:", request.url);
                    console.log("Method:", request.method);
                    const body = await request.json() as any;
                    console.log("Body JSON:", JSON.stringify(body, null, 2));

                    if (body.method === "initialize" || body.method === "tools/list") {
                        const result = (body.method === "initialize")
                            ? { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "clothes-agent-mcp", version: "2.2.0" } }
                            : { tools: TOOLS };
                        return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), {
                            status: 200,
                            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                        });
                    }

                    // Flujo Híbrido: Intentar sesión -> Fallback Stateless
                    const onMessage = sessionId ? sessions.get(sessionId) : null;
                    if (onMessage) {
                        onMessage(body);
                        return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: "accepted" }), {
                            status: 200,
                            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                        });
                    }

                    // Stateless Fallback
                    if (body.method === "tools/call") {
                        const { name, arguments: args } = body.params;
                        console.log(`[MCP-STATELESS] Ejecutando tool directa: ${name}`);
                        const result = await handleToolCall(name, args, supabase) as any;
                        return new Response(JSON.stringify({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: {
                                content: result.content,
                                isError: result.isError || false
                            }
                        }), {
                            status: 200,
                            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                        });
                    }

                    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "Session not found" } }), {
                        status: 200,
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });

                } catch (err: any) {
                    console.error("[POST-ERROR]", err.message);
                    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 0, error: { code: -32603, message: err.message } }), {
                        status: 200,
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }
            }
        }

        // Configurar handlers del servidor MCP (solo para cuando SÍ hay sesión activa en memoria)
        server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
        server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
            const { name, arguments: args } = request.params;
            return await handleToolCall(name, args, supabase);
        });

        return new Response("Not found", { status: 404 });
    }
};
