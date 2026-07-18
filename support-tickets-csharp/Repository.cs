namespace SupportTicketsCSharp;

public sealed class SupportTicketRepository
{
    private readonly List<SupportTicket> _items = new()
    {
        new SupportTicket(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Cannot reset password", "urgent", "open", "Alex", "Reset email never arrives."),
        new SupportTicket(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Invoice PDF missing", "normal", "pending", "Sam", "Customer needs a downloadable invoice.")
    };

    public IReadOnlyList<SupportTicket> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public SupportTicket? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public SupportTicket Create(SupportTicketRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public SupportTicket? Update(Guid id, SupportTicketRequest request)
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

    private static bool MatchesSearch(SupportTicket item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Subject} {item.Priority} {item.Status} {item.Assignee} {item.Body}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(SupportTicket item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Priority), filter, StringComparison.OrdinalIgnoreCase);
    }}
