namespace ReadingListCSharp;

public sealed class BookRepository
{
    private readonly List<Book> _items = new()
    {
        new Book(Guid.Parse("00000000-0000-0000-0000-000000000001"), "The Pragmatic Programmer", "David Thomas and Andrew Hunt", "Reading", 0, "Focus on small habits."),
        new Book(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Refactoring", "Martin Fowler", "Want to Read", 0, "Compare examples with projects.")
    };

    public IReadOnlyList<Book> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Book? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Book Create(BookRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Book? Update(Guid id, BookRequest request)
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

    private static bool MatchesSearch(Book item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Title} {item.Author} {item.Status} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Book item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Status), filter, StringComparison.OrdinalIgnoreCase);
    }}
