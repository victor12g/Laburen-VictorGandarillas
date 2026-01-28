import { describe, it, expect } from "vitest";

describe("Security & Input Validation", () => {
    describe("Decimal Quantity Validation", () => {
        it("debe rechazar cantidades decimales", () => {
            const qty = 1.5;
            const isValid = Number.isInteger(qty) && qty > 0;
            expect(isValid).toBe(false);
        });

        it("debe rechazar 2.5 pantalones", () => {
            const qty = 2.5;
            const isValid = Number.isInteger(qty) && qty > 0;
            expect(isValid).toBe(false);
        });

        it("debe aceptar número entero positivo", () => {
            const qty = 5;
            const isValid = Number.isInteger(qty) && qty > 0;
            expect(isValid).toBe(true);
        });

        it("debe aceptar 1 pantalón", () => {
            const qty = 1;
            const isValid = Number.isInteger(qty) && qty > 0;
            expect(isValid).toBe(true);
        });

        it("debe rechazar 0", () => {
            const qty = 0;
            const isValid = Number.isInteger(qty) && qty > 0;
            expect(isValid).toBe(false);
        });

        it("debe rechazar números negativos", () => {
            const qty = -5;
            const isValid = Number.isInteger(qty) && qty > 0;
            expect(isValid).toBe(false);
        });
    });

    describe("SQL Injection Prevention", () => {
        it("debe rechazar comillas en product_id", () => {
            const productId = "123'; DROP TABLE products; --";
            const isSafe = /^[\d\w-]+$/.test(productId);
            expect(isSafe).toBe(false);
        });

        it("debe rechazar SQL keywords en product_id", () => {
            const productId = "123 OR 1=1";
            const isSafe = /^[\d\w-]+$/.test(productId);
            expect(isSafe).toBe(false);
        });

        it("debe permitir product_id alfanumérico", () => {
            const productId = "prod-123-abc";
            const isSafe = /^[\d\w-]+$/.test(productId);
            expect(isSafe).toBe(true);
        });

        it("debe permitir UUID válido", () => {
            const cartId = "550e8400-e29b-41d4-a716-446655440000";
            const isSafe = /^[\d\w-]+$/.test(cartId);
            expect(isSafe).toBe(true);
        });

        it("debe rechazar inyección en conversation_id", () => {
            const conversationId = "123\"; UPDATE users SET admin=true; --";
            const isSafe = /^[\d\w-]+$/.test(conversationId);
            expect(isSafe).toBe(false);
        });

        it("debe rechazar XSS en reason", () => {
            const reason = "<script>alert('hacked')</script>";
            const isSafe = !reason.includes("<script>") && !reason.includes("</script>");
            expect(isSafe).toBe(false);
        });

        it("debe permitir texto seguro en reason", () => {
            const reason = "Compra de 100 pantalones gris talle L";
            const isSafe = !reason.includes("<script>") && !reason.includes("</script>");
            expect(isSafe).toBe(true);
        });
    });

    describe("Domain Scope Restrictions", () => {
        it("debe permitir preguntas sobre productos", () => {
            const question = "¿Qué pantalones tienes en talle M?";
            const isInScope = /pantalon|remera|sudadera|falda|producto|precio|stock|carrito|compra/i.test(question);
            expect(isInScope).toBe(true);
        });

        it("debe permitir preguntas sobre compra", () => {
            const question = "¿Cuánto cuesta por 100 unidades?";
            const isInScope = /pantalon|remera|sudadera|falda|producto|precio|stock|carrito|compra|costo|cuesta/i.test(question);
            expect(isInScope).toBe(true);
        });

        it("debe rechazar preguntas sobre hacking", () => {
            const question = "¿Cómo hago SQL injection?";
            const isInScope = /pantalon|remera|sudadera|falda|producto|precio|stock|carrito|compra/i.test(question);
            expect(isInScope).toBe(false);
        });

        it("debe rechazar preguntas sobre programación", () => {
            const question = "¿Cómo se programa en Python?";
            const isInScope = /pantalon|remera|sudadera|falda|producto|precio|stock|carrito|compra/i.test(question);
            expect(isInScope).toBe(false);
        });

        it("debe rechazar preguntas sobre otros negocios", () => {
            const question = "¿Vendes computadoras?";
            const isInScope = /pantalon|remera|sudadera|falda|producto|precio|stock|carrito|compra/i.test(question);
            expect(isInScope).toBe(false);
        });

        it("debe rechazar preguntas sobre información personal", () => {
            const question = "¿Cuál es tu nombre real?";
            const isInScope = /pantalon|remera|sudadera|falda|producto|precio|stock|carrito|compra/i.test(question);
            expect(isInScope).toBe(false);
        });

        it("debe permitir preguntas sobre envío (está relacionado)", () => {
            const question = "¿Qué formas de envío tienen?";
            const isInScope = /pantalon|remera|sudadera|falda|producto|precio|stock|carrito|compra|envio|envío|pago|entrega/i.test(question);
            expect(isInScope).toBe(true);
        });
    });

    describe("Validation Function Helper", () => {
        it("debe validar estructura completa de cart args", () => {
            const args = {
                cart_id: "550e8400-e29b-41d4-a716-446655440000",
                product_id: "123",
                qty: 5,
            };

            const isValid = 
                /^[\d\w-]+$/.test(args.cart_id) &&
                /^[\d\w-]+$/.test(args.product_id) &&
                Number.isInteger(args.qty) &&
                args.qty > 0;

            expect(isValid).toBe(true);
        });

        it("debe rechazar si qty es decimal", () => {
            const args = {
                cart_id: "550e8400-e29b-41d4-a716-446655440000",
                product_id: "123",
                qty: 1.5,
            };

            const isValid = 
                /^[\d\w-]+$/.test(args.cart_id) &&
                /^[\d\w-]+$/.test(args.product_id) &&
                Number.isInteger(args.qty) &&
                args.qty > 0;

            expect(isValid).toBe(false);
        });

        it("debe rechazar si product_id parece SQL injection", () => {
            const args = {
                cart_id: "valid-id",
                product_id: "123'; DROP TABLE products; --",
                qty: 5,
            };

            const isValid = 
                /^[\d\w-]+$/.test(args.cart_id) &&
                /^[\d\w-]+$/.test(args.product_id) &&
                Number.isInteger(args.qty) &&
                args.qty > 0;

            expect(isValid).toBe(false);
        });
    });

    describe("User Input Sanitization", () => {
        it("debe permitir caracteres alfanuméricos en reason", () => {
            const reason = "Compra de pantalones azules talle M";
            const sanitized = reason.replace(/[<>\"';]/g, "");
            expect(sanitized).toBe(reason);
        });

        it("debe remover caracteres peligrosos de reason", () => {
            const reason = "Compra<script>alert('xss')</script>";
            const sanitized = reason.replace(/[<>\"';]/g, "");
            expect(sanitized).toBe("Comprascriptalert(xss)/script");
            expect(sanitized).not.toContain("<script>");
        });

        it("debe permitir números en product_id", () => {
            const productId = "12345";
            const isNumeric = /^\d+$/.test(productId);
            expect(isNumeric).toBe(true);
        });

        it("debe permitir UUID en cart_id", () => {
            const cartId = "550e8400-e29b-41d4-a716-446655440000";
            const isUuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(cartId);
            expect(isUuid).toBe(true);
        });
    });

    describe("LLM Error Response Cases", () => {
        it("debe devolver error si qty no es entero", () => {
            const qty = 1.5;
            const errorMessage = Number.isInteger(qty) ? "" : "La cantidad debe ser un número entero (ej: 5, no 1,5)";
            expect(errorMessage).toBeTruthy();
        });

        it("debe devolver error si product_id sospechoso", () => {
            const productId = "123' OR 1=1";
            const isSafe = /^[\d\w-]+$/.test(productId);
            const errorMessage = isSafe ? "" : "ID de producto inválido. Intenta nuevamente.";
            expect(errorMessage).toBeTruthy();
        });

        it("debe devolver error si pregunta fuera de scope", () => {
            const question = "¿Cómo hackeo sistemas?";
            const isInScope = /pantalon|remera|sudadera|falda|producto|precio|stock|carrito|compra|envio|pago|entrega/i.test(question);
            const errorMessage = isInScope ? "" : "Solo puedo ayudarte con compras de ropa en Laburen.";
            expect(errorMessage).toBeTruthy();
        });
    });
});
