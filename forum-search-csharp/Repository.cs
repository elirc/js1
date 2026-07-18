namespace ForumSearchCSharp;

public sealed class ForumThreadRepository
{
    private readonly List<ForumThread> _items = new()
    {
        new ForumThread(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Postgres search basics", "casey", "Full-text search uses indexes and ranking.", "postgres,search", 10),
        new ForumThread(Guid.Parse("00000000-0000-0000-0000-000000000002"), "React state question", "devon", "When should state be derived?", "react,state", 6)
    };

    public IReadOnlyList<ForumThread> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public ForumThread? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public ForumThread Create(ForumThreadRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public ForumThread? Update(Guid id, ForumThreadRequest request)
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

    private static bool MatchesSearch(ForumThread item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Title} {item.Author} {item.Body} {item.Tags}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(ForumThread item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Tags), filter, StringComparison.OrdinalIgnoreCase);
    }}
