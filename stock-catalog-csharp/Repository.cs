namespace StockCatalogCSharp;

public sealed class ProductRepository
{
    private readonly List<Product> _items = new()
    {
        new Product(Guid.Parse("00000000-0000-0000-0000-000000000001"), "SKU-1001", "Mechanical Keyboard", "Accessories", 129.99m, 12),
        new Product(Guid.Parse("00000000-0000-0000-0000-000000000002"), "SKU-1002", "USB-C Hub", "Adapters", 49.99m, 4)
    };

    public IReadOnlyList<Product> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Product? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Product Create(ProductRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Product? Update(Guid id, ProductRequest request)
    {
        var index = _items.FindIndex(item => item.Id == id);
        if (index < 0) return null;

        var updated = request.ToEntity(id);
        _items[index] = updated;
        return updated;
    }

    public bool Delete(Guid id)
    {
        var item = Get(id);
        return item is not null && _items.Remove(item);
    }

    private static bool MatchesSearch(Product item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Sku} {item.Name} {item.Category}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Product item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Category), filter, StringComparison.OrdinalIgnoreCase);
    }}
