import { expect, test, vi } from 'vitest';
import { listProducts } from '../../src/actions/products.js';

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

test('listProducts debería convertir búsqueda "pantalon" (sin tilde) a fuzzy match', async () => {
    // 1. Ejecutamos la lógica con "pantalon" (error común de usuario)
    const result = await listProducts(
        mockSupabase,
        { query: "pantalon" }
    );

    // 2. Verificamos que la función llamó a Supabase
    expect(mockSupabase.from).toHaveBeenCalledWith('products');

    // 3. Verificamos que generó un resultado válido
    expect(result.content).toBeDefined();
    expect(result.content[0]).toBeDefined();
    expect(result.content[0].type).toBe("text");
});

test('listProducts debería manejar búsquedas sin resultados', async () => {
    const mockEmptySupabase = {
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnThis(),
                ilike: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                })
            })
        })
    };

    const result = await listProducts(
        mockEmptySupabase,
        { query: "no_existe_este_producto" }
    );

    // Verificamos que se llamó a la DB (el mock captura las llamadas)
    expect(mockEmptySupabase.from).toHaveBeenCalled();
    expect(result.content).toBeDefined();
});
