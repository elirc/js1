namespace EventAdminCSharp;

public sealed class EventItemRepository
{
    private readonly List<EventItem> _items = new()
    {
        new EventItem(Guid.Parse("00000000-0000-0000-0000-000000000001"), "JavaScript Study Night", "Community Lab", new DateOnly(2026, 7, 12), 40, 22, "Open"),
        new EventItem(Guid.Parse("00000000-0000-0000-0000-000000000002"), "CSharp API Workshop", "Room 204", new DateOnly(2026, 8, 3), 30, 11, "Waitlist")
    };

    public IReadOnlyList<EventItem> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public EventItem? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public EventItem Create(EventItemRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public EventItem? Update(Guid id, EventItemRequest request)
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

    private static bool MatchesSearch(EventItem item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Name} {item.Location} {item.Status}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(EventItem item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Status), filter, StringComparison.OrdinalIgnoreCase);
    }}
