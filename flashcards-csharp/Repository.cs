namespace FlashcardsCSharp;

public sealed class FlashcardRepository
{
    private readonly List<Flashcard> _items = new()
    {
        new Flashcard(Guid.Parse("00000000-0000-0000-0000-000000000001"), "JavaScript", "What is a closure?", "A function with access to outer scope.", "Medium", "Study fundamentals."),
        new Flashcard(Guid.Parse("00000000-0000-0000-0000-000000000002"), "CSharp", "What is a record?", "An immutable data-focused type.", "Easy", "Compare with classes.")
    };

    public IReadOnlyList<Flashcard> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Flashcard? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Flashcard Create(FlashcardRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Flashcard? Update(Guid id, FlashcardRequest request)
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

    private static bool MatchesSearch(Flashcard item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Deck} {item.Front} {item.Back} {item.Difficulty} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Flashcard item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Deck), filter, StringComparison.OrdinalIgnoreCase);
    }}
