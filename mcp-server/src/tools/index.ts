// Definición de las herramientas (SCHEMA)
export const TOOLS = [
    {
        name: "list_products",
        description: "Lista productos filtrando por tipo, categoría, color o talla. Devuelve todos los detalles incluyendo PRECIO_100_U, DESCRIPCIÓN y STOCK.",
        inputSchema: {
            type: "object",
            properties: {
                tipo_prenda: { type: "string", description: "Tipo de prenda (Remera, Pantalon, Sudadera, Falda, etc.)" },
                category: { type: "string", description: "Categoría (Deportivo, Casual, Formal)" },
                color: { type: "string", description: "Color de la prenda" },
                talla: { type: "string", description: "Talle de la prenda" }
            }
        }
    },
    {
        name: "create_cart",
        description: "Crea un nuevo carrito de compras para la conversación actual.",
        inputSchema: {
            type: "object",
            properties: {
                conversation_id: { type: "string", description: "ID de la conversación (opcional si ya existe un carrito)" }
            }
        }
    },
    {
        name: "add_to_cart",
        description: "Añade un producto específico al carrito (SUMA cantidad).",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito (alternativa a conversation_id)" },
                conversation_id: { type: "string", description: "ID de la conversación (alternativa a cart_id)" },
                product_id: { type: "string" },
                qty: { type: "number", default: 1 }
            },
            required: ["product_id"]
        }
    },
    {
        name: "update_cart",
        description: "Actualiza la cantidad de un producto (FIJA cantidad) o lo elimina (qty=0).",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito (alternativa a conversation_id)" },
                conversation_id: { type: "string", description: "ID de la conversación (alternativa a cart_id)" },
                product_id: { type: "string", description: "ID del producto a actualizar" },
                qty: { type: "number", description: "Nueva cantidad (0 para eliminar)" }
            },
            required: ["product_id", "qty"]
        }
    },
    {
        name: "view_cart",
        description: "Muestra el contenido actual del carrito.",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito (alternativa a conversation_id)" },
                conversation_id: { type: "string", description: "ID de la conversación (alternativa a cart_id)" }
            }
        }
    },
    {
        name: "clear_cart",
        description: "Vacía todo el contenido del carrito. Usa esto cuando el usuario pida explícitamente vaciar o borrar todo el carrito.",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito a vaciar" },
                conversation_id: { type: "string", description: "ID de conversación (alternativa a cart_id)" }
            }
        }
    },
    {
        name: "handover_to_human",
        description: "Deriva la conversación a un humano para atención personalizada.",
        inputSchema: {
            type: "object",
            properties: { reason: { type: "string" } },
            required: ["reason"]
        }
    }
];
