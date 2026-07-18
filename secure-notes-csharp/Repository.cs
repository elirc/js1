namespace SecureNotesCSharp;

public sealed class SecureNoteRepository
{
    private readonly List<SecureNote> _items = new()
    {
        new SecureNote(Guid.Parse("00000000-0000-0000-0000-000000000001"), "maya@example.com", "Token Middleware", "Authenticate first, authorize every record.", "Private", true),
        new SecureNote(Guid.Parse("00000000-0000-0000-0000-000000000002"), "noah@example.com", "Authorization Check", "Scope reads by owner id.", "Confidential", false)
    };

    public IReadOnlyList<SecureNote> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public SecureNote? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public SecureNote Create(SecureNoteRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public SecureNote? Update(Guid id, SecureNoteRequest request)
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

    private static bool MatchesSearch(SecureNote item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.OwnerEmail} {item.Title} {item.Body} {item.Classification}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(SecureNote item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.OwnerEmail), filter, StringComparison.OrdinalIgnoreCase);
    }}
