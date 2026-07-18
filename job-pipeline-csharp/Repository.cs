namespace JobPipelineCSharp;

public sealed class JobApplicationRepository
{
    private readonly List<JobApplication> _items = new()
    {
        new JobApplication(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Acme Tools", "Frontend Engineer", "Applied", "Jordan", new DateOnly(2026, 7, 2), "Follow up after one week."),
        new JobApplication(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Northwind Labs", "Backend Engineer", "Interviewing", "Morgan", new DateOnly(2026, 7, 9), "Prepare system design examples.")
    };

    public IReadOnlyList<JobApplication> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public JobApplication? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public JobApplication Create(JobApplicationRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public JobApplication? Update(Guid id, JobApplicationRequest request)
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

    private static bool MatchesSearch(JobApplication item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Company} {item.Role} {item.Stage} {item.Contact} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(JobApplication item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Stage), filter, StringComparison.OrdinalIgnoreCase);
    }}
