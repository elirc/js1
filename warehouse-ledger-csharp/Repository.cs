namespace WarehouseLedgerCSharp;

public sealed class StockMovementRepository
{
    private readonly List<StockMovement> _items = new()
    {
        new StockMovement(Guid.Parse("00000000-0000-0000-0000-000000000001"), "USB-C Hub", "East", "receive", 20, "Initial stock"),
        new StockMovement(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Mechanical Keyboard", "West", "ship", 3, "Customer order")
    };

    public IReadOnlyList<StockMovement> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public StockMovement? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public StockMovement Create(StockMovementRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public StockMovement? Update(Guid id, StockMovementRequest request)
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

    private static bool MatchesSearch(StockMovement item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.ProductName} {item.WarehouseName} {item.Kind} {item.Reason}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(StockMovement item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.WarehouseName), filter, StringComparison.OrdinalIgnoreCase);
    }}
