namespace PulseAnalyticsCSharp;

public sealed class MetricEventRepository
{
    private readonly List<MetricEvent> _items = new()
    {
        new MetricEvent(Guid.Parse("00000000-0000-0000-0000-000000000001"), "page_view", "web", new DateOnly(2026, 6, 16), 1m, "Raw event for aggregation."),
        new MetricEvent(Guid.Parse("00000000-0000-0000-0000-000000000002"), "signup", "email", new DateOnly(2026, 6, 17), 3m, "Useful for conversion metrics.")
    };

    public IReadOnlyList<MetricEvent> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public MetricEvent? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public MetricEvent Create(MetricEventRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public MetricEvent? Update(Guid id, MetricEventRequest request)
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

    private static bool MatchesSearch(MetricEvent item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.EventName} {item.Channel} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(MetricEvent item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Channel), filter, StringComparison.OrdinalIgnoreCase);
    }}
