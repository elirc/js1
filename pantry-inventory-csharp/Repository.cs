namespace PantryInventoryCSharp;

public sealed class PantryItemRepository
{
    private readonly List<PantryItem> _items = new()
    {
        new PantryItem(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Oats", "Dry goods", 4, 2, new DateOnly(2026, 9, 1)),
        new PantryItem(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Tomato cans", "Canned", 1, 3, new DateOnly(2027, 2, 15))
    };

    public IReadOnlyList<PantryItem> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public PantryItem? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public PantryItem Create(PantryItemRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public PantryItem? Update(Guid id, PantryItemRequest request)
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

    private static bool MatchesSearch(PantryItem item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Name} {item.Category}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(PantryItem item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Category), filter, StringComparison.OrdinalIgnoreCase);
    }}
