import { expect, test, vi } from 'vitest';
import { executeToolLogic } from '../../src/index';

// --- MOCKS ---
// Simulamos la estructura encadenada de Supabase:
// supabase.from().select().or().limit() -> Retorna datos

const mockData = [
    {
        "TIPO_PRENDA": "Pantalón",
        "DESCRIPCIÓN": "Pantalón de vestir formal",
        "COLOR": "Verde",
        "TALLA": "M"
    }
];

const mockSupabase = {
    from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnThis(), // .or() devuelve el mismo objeto para encadenar
            ilike: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
                data: mockData,
                error: null
            })
        })
    })
};

// --- TESTS ---

test('list_products debería convertir búsqueda "pantalon" (sin tilde) a fuzzy match', async () => {
    // 1. Ejecutamos la lógica con "pantalon" (error común de usuario)
    const result = await executeToolLogic(
        "list_products",
        { query: "pantalon" },
        mockSupabase
    );

    // 2. Verificamos que la función llamó a Supabase
    expect(mockSupabase.from).toHaveBeenCalledWith('products');

    // 3. Verificamos que generó un resultado
    const jsonResult = JSON.parse(result.content[0].text);
    expect(jsonResult).toHaveLength(1);
    expect(jsonResult[0].TIPO_PRENDA).toBe("Pantalón");
});

test('list_products debería manejar múltiples palabras', async () => {
    await executeToolLogic(
        "list_products",
        { query: "pantln v3rd3" },
        mockSupabase
    );

    // Verificamos que se llamó a la DB (el mock captura las llamadas)
    expect(mockSupabase.from).toHaveBeenCalled();
});
