namespace HabitTrackerCSharp;

public sealed class HabitRepository
{
    private readonly List<Habit> _items = new()
    {
        new Habit(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Read documentation", "#2f6b3f", "Daily", false, "Track seven-day streaks."),
        new Habit(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Practice algorithms", "#245d8f", "Weekdays", false, "Keep sessions short.")
    };

    public IReadOnlyList<Habit> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Habit? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Habit Create(HabitRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Habit? Update(Guid id, HabitRequest request)
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

    private static bool MatchesSearch(Habit item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Name} {item.Color} {item.Frequency} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Habit item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Frequency), filter, StringComparison.OrdinalIgnoreCase);
    }}
