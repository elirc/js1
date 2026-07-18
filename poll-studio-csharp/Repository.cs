namespace PollStudioCSharp;

public sealed class PollRepository
{
    private readonly List<Poll> _items = new()
    {
        new Poll(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Which topic should we study next?", "Open", "React|Node|SQL", 12, "Pipe-delimited options keep the API simple."),
        new Poll(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Best review format?", "Draft", "Quiz|Project|Review", 0, "Add option records later.")
    };

    public IReadOnlyList<Poll> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Poll? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Poll Create(PollRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Poll? Update(Guid id, PollRequest request)
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

    private static bool MatchesSearch(Poll item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Question} {item.Status} {item.Options} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Poll item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Status), filter, StringComparison.OrdinalIgnoreCase);
    }}
