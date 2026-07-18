namespace ContactBookCSharp;

public sealed class ContactRepository
{
    private readonly List<Contact> _items = new()
    {
        new Contact(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Maya Patel", "maya@example.com", "555-0198", "Northwind Labs", "Colleague"),
        new Contact(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Noah Brooks", "noah@example.com", "555-0142", "Brooks Design", "Client")
    };

    public IReadOnlyList<Contact> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Contact? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Contact Create(ContactRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Contact? Update(Guid id, ContactRequest request)
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

    private static bool MatchesSearch(Contact item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.FullName} {item.Email} {item.Phone} {item.Company} {item.Relationship}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Contact item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Relationship), filter, StringComparison.OrdinalIgnoreCase);
    }}
