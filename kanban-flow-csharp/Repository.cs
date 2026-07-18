namespace KanbanFlowCSharp;

public sealed class BoardCardRepository
{
    private readonly List<BoardCard> _items = new()
    {
        new BoardCard(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Draft API contract", "Todo", 1, "Avery", "Define endpoints first."),
        new BoardCard(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Implement validation", "Doing", 2, "Jordan", "Reject invalid statuses.")
    };

    public IReadOnlyList<BoardCard> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public BoardCard? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public BoardCard Create(BoardCardRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public BoardCard? Update(Guid id, BoardCardRequest request)
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

    private static bool MatchesSearch(BoardCard item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Title} {item.Status} {item.Assignee} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(BoardCard item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Status), filter, StringComparison.OrdinalIgnoreCase);
    }}
