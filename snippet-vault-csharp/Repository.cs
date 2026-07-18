namespace SnippetVaultCSharp;

public sealed class SnippetRepository
{
    private readonly List<Snippet> _items = new()
    {
        new Snippet(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Fetch helper", "JavaScript", "api,http", "async function request(url) { return fetch(url); }", "Store reusable patterns."),
        new Snippet(Guid.Parse("00000000-0000-0000-0000-000000000002"), "LINQ filter", "CSharp", "linq,collections", "items.Where(x => x.IsActive);", "Compare with JS array methods.")
    };

    public IReadOnlyList<Snippet> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Snippet? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Snippet Create(SnippetRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Snippet? Update(Guid id, SnippetRequest request)
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

    private static bool MatchesSearch(Snippet item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Title} {item.Language} {item.Tags} {item.Code} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Snippet item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Language), filter, StringComparison.OrdinalIgnoreCase);
    }}
