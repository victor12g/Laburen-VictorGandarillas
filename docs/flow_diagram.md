# AI Agent Concept: Product Sales Flow

This document details the interaction flow between the user, the IA Agent (Laburen), and the MCP server (Supabase Backend).

## Interaction Flow (Mermaid)

```mermaid
sequenceDiagram
    participant User
    participant Agent as IA Agent (Laburen)
    participant MCP as MCP Server (Cloudflare)
    participant DB as Database (Supabase)

    User->>Agent: "Hola, ¿qué productos tienes?"
    Agent->>MCP: list_products(query: null)
    MCP->>DB: SELECT * FROM products
    DB-->>MCP: [Product List]
    MCP-->>Agent: JSON Product List
    Agent-->>User: "¡Hola! Tenemos estos productos: [Lista]"

    User->>Agent: "Quiero comprar el Producto A"
    Agent->>MCP: create_cart()
    MCP->>DB: INSERT INTO carts
    DB-->>MCP: cart_id
    Agent->>MCP: add_to_cart(cart_id, product_id, qty: 1)
    MCP->>DB: INSERT INTO cart_items
    DB-->>MCP: Success
    Agent-->>User: "Añadido al carrito. ¿Algo más?"

    User->>Agent: "Quiero hablar con alguien"
    Agent->>MCP: handover_to_human(context: "Venta Producto A")
    MCP-->>Agent: "Label applied"
    Agent-->>User: "Entiendo. Te derivo con un asesor humano. Un momento..."
```

## MCP Endpoints (Tools)

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `list_products` | `query?: string` | Searches products by name or description. |
| `get_product_details` | `id: string` | Returns full details of a specific product. |
| `create_cart` | `none` | Creates a new session/cart ID. |
| `add_to_cart` | `cart_id, product_id, qty` | Adds a product to the specified cart. |
| `update_cart` | `cart_id, items[]` | Updates quantities or removes items. |
| `view_cart` | `cart_id` | Fetches all items currently in the cart. |
| `handover_to_human` | `reason: string` | Escalates to Chatwoot and applies tags. |

## Strategy
1. **Intention Detection**: The agent uses the LLM to identify when the user wants to "explore", "buy", or "edit".
2. **Context Management**: The `cart_id` is maintained in the conversation context (metadata) provided by Laburen.
3. **Coherence**: The agent always confirms actions (e.g., "Ya agregué el producto X al carrito").
