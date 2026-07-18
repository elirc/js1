namespace OrgExplorerCSharp;

public sealed class OrgNodeRepository
{
    private readonly List<OrgNode> _items = new()
    {
        new OrgNode(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Morgan Lee", "Engineering Manager", "", 0, "Engineering"),
        new OrgNode(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Riley Chen", "Senior Engineer", "Morgan Lee", 1, "Platform")
    };

    public IReadOnlyList<OrgNode> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public OrgNode? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public OrgNode Create(OrgNodeRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public OrgNode? Update(Guid id, OrgNodeRequest request)
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

    private static bool MatchesSearch(OrgNode item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Name} {item.Role} {item.ParentName} {item.Department}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(OrgNode item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Department), filter, StringComparison.OrdinalIgnoreCase);
    }}
