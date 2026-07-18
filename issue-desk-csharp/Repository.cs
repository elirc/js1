namespace IssueDeskCSharp;

public sealed class IssueRepository
{
    private readonly List<Issue> _items = new()
    {
        new Issue(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Add keyboard shortcuts", "Backlog", "Medium", "Taylor", "Let power users move faster."),
        new Issue(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Fix empty state layout", "In Progress", "High", "Riley", "List jumps when no results.")
    };

    public IReadOnlyList<Issue> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Issue? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Issue Create(IssueRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Issue? Update(Guid id, IssueRequest request)
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

    private static bool MatchesSearch(Issue item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Title} {item.Status} {item.Priority} {item.Assignee} {item.Description}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Issue item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Status), filter, StringComparison.OrdinalIgnoreCase);
    }}
