namespace TaskBoardCSharp;

public sealed class WorkTaskRepository
{
    private readonly List<WorkTask> _items = new()
    {
        new WorkTask(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Sketch data model", "High", "Backlog", new DateOnly(2026, 7, 1), "Identify fields before coding."),
        new WorkTask(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Review pull request", "Medium", "Done", new DateOnly(2026, 7, 8), "Leave comments on risky code.")
    };

    public IReadOnlyList<WorkTask> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public WorkTask? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public WorkTask Create(WorkTaskRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public WorkTask? Update(Guid id, WorkTaskRequest request)
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

    private static bool MatchesSearch(WorkTask item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Title} {item.Priority} {item.Status} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(WorkTask item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Status), filter, StringComparison.OrdinalIgnoreCase);
    }}
