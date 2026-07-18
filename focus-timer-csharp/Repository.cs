namespace FocusTimerCSharp;

public sealed class FocusSessionRepository
{
    private readonly List<FocusSession> _items = new()
    {
        new FocusSession(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Read docs", 25, new DateOnly(2026, 6, 16), "Study", "No distractions."),
        new FocusSession(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Build CRUD endpoint", 45, new DateOnly(2026, 6, 17), "Coding", "Reviewed route design.")
    };

    public IReadOnlyList<FocusSession> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public FocusSession? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public FocusSession Create(FocusSessionRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public FocusSession? Update(Guid id, FocusSessionRequest request)
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

    private static bool MatchesSearch(FocusSession item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Label} {item.Category} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(FocusSession item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Category), filter, StringComparison.OrdinalIgnoreCase);
    }}
