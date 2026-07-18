namespace BudgetTrackerCSharp;

public sealed class TransactionRepository
{
    private readonly List<Transaction> _items = new()
    {
        new Transaction(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Web design deposit", "Freelance", "income", 850m, new DateOnly(2026, 6, 5)),
        new Transaction(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Course subscription", "Education", "expense", 39m, new DateOnly(2026, 6, 8))
    };

    public IReadOnlyList<Transaction> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Transaction? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Transaction Create(TransactionRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Transaction? Update(Guid id, TransactionRequest request)
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

    private static bool MatchesSearch(Transaction item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Description} {item.Category} {item.Type}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Transaction item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Type), filter, StringComparison.OrdinalIgnoreCase);
    }}
