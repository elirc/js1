namespace LiveChatCSharp;

public sealed class ChatMessageRepository
{
    private readonly List<ChatMessage> _items = new()
    {
        new ChatMessage(Guid.Parse("00000000-0000-0000-0000-000000000001"), "general", "Maya", "Welcome to the room.", new DateTime(2026, 6, 16, 9, 0, 0, DateTimeKind.Utc), false),
        new ChatMessage(Guid.Parse("00000000-0000-0000-0000-000000000002"), "engineering", "Noah", "API deployed to staging.", new DateTime(2026, 6, 16, 9, 5, 0, DateTimeKind.Utc), false)
    };

    public IReadOnlyList<ChatMessage> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public ChatMessage? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public ChatMessage Create(ChatMessageRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public ChatMessage? Update(Guid id, ChatMessageRequest request)
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

    private static bool MatchesSearch(ChatMessage item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Room} {item.Author} {item.Body}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(ChatMessage item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Room), filter, StringComparison.OrdinalIgnoreCase);
    }}
