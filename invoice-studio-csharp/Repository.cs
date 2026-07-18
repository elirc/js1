namespace InvoiceStudioCSharp;

public sealed class InvoiceRepository
{
    private readonly List<Invoice> _items = new()
    {
        new Invoice(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Northwind Labs", "Draft", new DateOnly(2026, 7, 15), 1200m, "Design discovery:800|Prototype:400"),
        new Invoice(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Brooks Design", "Sent", new DateOnly(2026, 8, 1), 450m, "Consulting:450")
    };

    public IReadOnlyList<Invoice> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Invoice? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Invoice Create(InvoiceRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Invoice? Update(Guid id, InvoiceRequest request)
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

    private static bool MatchesSearch(Invoice item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.CustomerName} {item.Status} {item.LineItems}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Invoice item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Status), filter, StringComparison.OrdinalIgnoreCase);
    }}
