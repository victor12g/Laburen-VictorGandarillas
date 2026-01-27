import { describe, it, expect } from "vitest";
import { TOOLS } from "./index.js";

describe("TOOLS Schema Validation", () => {
    it("debe exportar un array de herramientas", () => {
        expect(Array.isArray(TOOLS)).toBe(true);
        expect(TOOLS.length).toBeGreaterThan(0);
    });

    it("debe contener todas las herramientas requeridas", () => {
        const toolNames = TOOLS.map(t => t.name);
        expect(toolNames).toContain("list_products");
        expect(toolNames).toContain("create_cart");
        expect(toolNames).toContain("update_cart");
        expect(toolNames).toContain("view_cart");
        expect(toolNames).toContain("clear_cart");
        expect(toolNames).toContain("handover_to_human");
    });

    describe("list_products", () => {
        it("debe tener descripción y schema válido", () => {
            const tool = TOOLS.find(t => t.name === "list_products");
            expect(tool).toBeDefined();
            expect(tool?.description).toBeTruthy();
            expect(tool?.inputSchema).toBeDefined();
            expect(tool?.inputSchema.type).toBe("object");
        });

        it("debe tener propiedades de filtrado opcionales", () => {
            const tool = TOOLS.find(t => t.name === "list_products");
            const props = tool?.inputSchema.properties;
            expect(props).toHaveProperty("name");
            expect(props).toHaveProperty("category");
            expect(props).toHaveProperty("color");
            expect(props).toHaveProperty("size");
        });
    });

    describe("create_cart", () => {
        it("debe tener schema válido", () => {
            const tool = TOOLS.find(t => t.name === "create_cart");
            expect(tool).toBeDefined();
            expect(tool?.inputSchema.properties).toHaveProperty("conversation_id");
        });
    });

    describe("update_cart", () => {
        it("debe requerir product_id y qty", () => {
            const tool = TOOLS.find(t => t.name === "update_cart");
            expect(tool?.inputSchema.required).toContain("product_id");
            expect(tool?.inputSchema.required).toContain("qty");
        });

        it("debe tener alternativas de identificación (cart_id o conversation_id)", () => {
            const tool = TOOLS.find(t => t.name === "update_cart");
            const props = tool?.inputSchema.properties;
            expect(props).toHaveProperty("cart_id");
            expect(props).toHaveProperty("conversation_id");
        });
    });

    describe("view_cart", () => {
        it("debe aceptar cart_id o conversation_id", () => {
            const tool = TOOLS.find(t => t.name === "view_cart");
            const props = tool?.inputSchema.properties;
            expect(props).toHaveProperty("cart_id");
            expect(props).toHaveProperty("conversation_id");
        });
    });

    describe("clear_cart", () => {
        it("debe aceptar cart_id o conversation_id", () => {
            const tool = TOOLS.find(t => t.name === "clear_cart");
            const props = tool?.inputSchema.properties;
            expect(props).toHaveProperty("cart_id");
            expect(props).toHaveProperty("conversation_id");
        });
    });

    describe("handover_to_human", () => {
        it("debe requerir conversation_id y reason", () => {
            const tool = TOOLS.find(t => t.name === "handover_to_human");
            expect(tool?.inputSchema.required).toContain("conversation_id");
            expect(tool?.inputSchema.required).toContain("reason");
        });

        it("debe tener descripción de derivación a Chatwoot", () => {
            const tool = TOOLS.find(t => t.name === "handover_to_human");
            expect(tool?.description).toContain("Chatwoot");
        });
    });

    it("cada herramienta debe tener nombre, descripción y schema", () => {
        TOOLS.forEach(tool => {
            expect(tool.name).toBeTruthy();
            expect(tool.description).toBeTruthy();
            expect(tool.inputSchema).toBeDefined();
            expect(tool.inputSchema.type).toBe("object");
        });
    });
});
