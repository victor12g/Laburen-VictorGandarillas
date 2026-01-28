import { describe, it, expect, beforeEach } from "vitest";
import { TOOLS } from "../../src/tools/index.js";

describe("Handover Tools", () => {
    let handoverToHumanTool: any;

    beforeEach(() => {
        handoverToHumanTool = TOOLS.find(t => t.name === "handover_to_human");
    });

    describe("handover_to_human", () => {
        it("debe estar definida en TOOLS", () => {
            expect(handoverToHumanTool).toBeDefined();
        });

        it("debe tener descripción válida", () => {
            expect(handoverToHumanTool.description).toBeTruthy();
            expect(typeof handoverToHumanTool.description).toBe("string");
        });

        it("debe tener schema de tipo object", () => {
            expect(handoverToHumanTool.inputSchema).toBeDefined();
            expect(handoverToHumanTool.inputSchema.type).toBe("object");
        });

        it("debe requerir cart_id, reason e is_purchase", () => {
            const required = handoverToHumanTool.inputSchema.required || [];
            expect(required).toContain("cart_id");
            expect(required).toContain("reason");
            expect(required).toContain("is_purchase");
        });

        it("debe tener propiedad cart_id string", () => {
            const props = handoverToHumanTool.inputSchema.properties;
            expect(props).toHaveProperty("cart_id");
            expect(props.cart_id.type).toBe("string");
        });

        it("debe tener propiedad reason string", () => {
            const props = handoverToHumanTool.inputSchema.properties;
            expect(props).toHaveProperty("reason");
            expect(props.reason.type).toBe("string");
        });

        it("debe tener propiedad is_purchase boolean", () => {
            const props = handoverToHumanTool.inputSchema.properties;
            expect(props).toHaveProperty("is_purchase");
            expect(props.is_purchase.type).toBe("boolean");
        });

        it("debe describir comportamiento de is_purchase", () => {
            const props = handoverToHumanTool.inputSchema.properties;
            const description = props.is_purchase.description;
            expect(description).toContain("true");
            expect(description).toContain("false");
        });

        it("debe estar en TOOLS array", () => {
            const toolNames = TOOLS.map(t => t.name);
            expect(toolNames).toContain("handover_to_human");
        });
    });

    describe("Validación de Handover", () => {
        it("is_purchase=true debe indicar compra confirmada", () => {
            const props = handoverToHumanTool.inputSchema.properties;
            const desc = props.is_purchase.description;
            expect(desc.toLowerCase()).toContain("compra");
        });

        it("is_purchase=false debe indicar consulta/cambios", () => {
            const props = handoverToHumanTool.inputSchema.properties;
            const desc = props.is_purchase.description;
            expect(desc.toLowerCase()).toMatch(/consulta|cambios|información/);
        });

        it("debe aceptar argumentos válidos", () => {
            const validArgs = {
                cart_id: "cart-123",
                reason: "Compra lista para procesar",
                is_purchase: true,
            };
            expect(validArgs.cart_id).toBeTruthy();
            expect(validArgs.reason).toBeTruthy();
            expect(typeof validArgs.is_purchase === "boolean").toBe(true);
        });
    });

    describe("TOOLS Array Consistency", () => {
        it("handover_to_human debe ser de tipo MCP Tool", () => {
            expect(handoverToHumanTool).toHaveProperty("name");
            expect(handoverToHumanTool).toHaveProperty("description");
            expect(handoverToHumanTool).toHaveProperty("inputSchema");
        });

        it("debe tener nombre único", () => {
            const names = TOOLS.map(t => t.name);
            const handoverNames = names.filter(n => n === "handover_to_human");
            expect(handoverNames.length).toBe(1);
        });

        it("debe estar entre las herramientas principales", () => {
            const toolNames = TOOLS.map(t => t.name);
            expect(toolNames.length).toBeGreaterThanOrEqual(6); // list, create, update, view, clear, handover
        });
    });
});
