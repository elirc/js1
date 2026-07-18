namespace StockCatalogCSharp;

public sealed record Product(Guid Id, string Sku, string Name, string Category, decimal Price, int Stock);

public sealed record ProductRequest(string Sku, string Name, string Category, decimal Price, int Stock)
{
    public Product ToEntity(Guid id) => new(id, Clean(Sku), Clean(Name), Clean(Category), Price, Stock);

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class ProductRules
{
    public static string? Validate(ProductRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Sku)) return "Sku is required.";
        if (string.IsNullOrWhiteSpace(request.Name)) return "Name is required.";
        if (request.Price < 0) return "Price must be at least 0.";
        if (request.Stock < 0) return "Stock must be at least 0.";
        return null;
    }
}
