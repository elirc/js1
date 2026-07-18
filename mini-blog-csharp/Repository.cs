namespace MiniBlogCSharp;

public sealed class BlogPostRepository
{
    private readonly List<BlogPost> _items = new()
    {
        new BlogPost(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Learning REST Routes", "Jamie", "A post with nested comments models one-to-many data.", "Published", 2),
        new BlogPost(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Why Comments Need Parents", "Avery", "Foreign keys keep relationships explicit.", "Draft", 0)
    };

    public IReadOnlyList<BlogPost> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public BlogPost? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public BlogPost Create(BlogPostRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public BlogPost? Update(Guid id, BlogPostRequest request)
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

    private static bool MatchesSearch(BlogPost item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Title} {item.Author} {item.Body} {item.Status}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(BlogPost item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Status), filter, StringComparison.OrdinalIgnoreCase);
    }}
