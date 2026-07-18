namespace CourseRosterCSharp;

public sealed class CourseRepository
{
    private readonly List<Course> _items = new()
    {
        new Course(Guid.Parse("00000000-0000-0000-0000-000000000001"), "JS-201", "Modern JavaScript", "Morgan Lee", 24, 18, "Intermediate"),
        new Course(Guid.Parse("00000000-0000-0000-0000-000000000002"), "CSHARP-301", "ASP.NET Core APIs", "Sam Rivera", 20, 12, "Advanced")
    };

    public IReadOnlyList<Course> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Course? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Course Create(CourseRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Course? Update(Guid id, CourseRequest request)
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

    private static bool MatchesSearch(Course item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Code} {item.Title} {item.Instructor} {item.Level}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Course item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Level), filter, StringComparison.OrdinalIgnoreCase);
    }}
