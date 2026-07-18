namespace NoteVaultCSharp;

public sealed class NoteRepository
{
    private readonly List<Note> _items = new()
    {
        new Note(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Repository Pattern", "Repositories hide storage details.", "architecture,csharp", true, "Study"),
        new Note(Guid.Parse("00000000-0000-0000-0000-000000000002"), "File Persistence", "JSON files are a teaching bridge to databases.", "node,dotnet", false, "Backend")
    };

    public IReadOnlyList<Note> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Note? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Note Create(NoteRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Note? Update(Guid id, NoteRequest request)
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

    private static bool MatchesSearch(Note item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Title} {item.Body} {item.Tags} {item.Folder}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Note item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Tags), filter, StringComparison.OrdinalIgnoreCase);
    }}
