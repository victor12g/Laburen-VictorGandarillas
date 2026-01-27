// Definición de las herramientas (SCHEMA)
export const TOOLS = [
    {
        name: "list_products",
        description: "Lista productos filtrando por nombre, categoría, color o size. Devuelve todos los detalles incluyendo price_100_u, description y stock.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Nombre/Tipo de prenda (Remera, Pantalon, Sudadera, Falda, etc.)" },
                category: { type: "string", description: "Categoría (Deportivo, Casual, Formal)" },
                color: { type: "string", description: "Color de la prenda" },
                size: { type: "string", description: "Talle de la prenda" }
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
        name: "update_cart",
        description: "Fijar la cantidad total de un producto en el carrito (UPSERT). Si qty=0, elimina el producto. Ajusta validaciones según stock disponible.",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito (alternativa a conversation_id)" },
                conversation_id: { type: "string", description: "ID de la conversación (alternativa a cart_id)" },
                product_id: { type: "string", description: "ID del producto a actualizar" },
                qty: { type: "number", description: "Cantidad final a establecer (0 para eliminar)" }
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
        description: "Deriva la conversación a un agente humano en Chatwoot. Crea conversación si no existe, abre la conversación y agrega etiquetas.",
        inputSchema: {
            type: "object",
            properties: {
                cart_id: { type: "string", description: "ID del carrito (conversación local)" },
                reason: { type: "string", description: "Motivo de la derivación" }
            },
            required: ["cart_id", "reason"]
        }
    }
];
