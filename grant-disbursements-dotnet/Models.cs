namespace GrantDisbursementsDotnet;

public sealed record WorkItem(
    Guid Id,
    string Title,
    string Owner,
    string Category,
    string Status,
    decimal Amount,
    string Priority,
    DateOnly? DueDate,
    string Notes,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateItemRequest(
    string Title,
    string Owner,
    string Category,
    string Status,
    decimal Amount,
    string Priority,
    DateOnly? DueDate,
    string Notes);

public sealed record UpdateItemRequest(
    string Title,
    string Owner,
    string Category,
    string Status,
    decimal Amount,
    string Priority,
    DateOnly? DueDate,
    string Notes);

public sealed record ChangeStatusRequest(string Status);
public sealed record ActivityRequest(string Body, string Kind = "note");
public sealed record ActivityEntry(Guid Id, Guid ItemId, string Kind, string Body, DateTimeOffset CreatedAt);
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize, int TotalPages);
public sealed record ApiError(string Code, string Message);
public sealed record Stats(int Total, decimal AmountTotal, IReadOnlyDictionary<string, int> ByStatus, IReadOnlyDictionary<string, int> ByCategory);

public sealed record QueryOptions(
    string Search,
    string Status,
    string Category,
    int Page,
    int PageSize,
    string Sort,
    string Dir)
{
    public int Offset => (Page - 1) * PageSize;

    public static QueryOptions From(IQueryCollection query)
    {
        static string Read(IQueryCollection query, string key, string fallback)
            => query.TryGetValue(key, out var value) ? value.ToString() : fallback;

        var page = int.TryParse(Read(query, "page", "1"), out var parsedPage) ? Math.Max(1, parsedPage) : 1;
        var pageSize = int.TryParse(Read(query, "pageSize", "10"), out var parsedSize) ? Math.Clamp(parsedSize, 1, 50) : 10;

        return new QueryOptions(
            Read(query, "search", "").Trim(),
            Read(query, "status", "all"),
            Read(query, "category", "all"),
            page,
            pageSize,
            Read(query, "sort", "createdAt"),
            Read(query, "dir", "desc"));
    }
}

public static class DomainRules
{
    public static readonly string[] Statuses = ["Requested", "Compliance Review", "Approved", "Paid", "Held"];
    public static readonly string[] Categories = ["Education", "Housing", "Climate", "Public Health"];
    public static readonly string[] Priorities = ["Low", "Medium", "High", "Critical"];

    public static IReadOnlyList<string> Validate(CreateItemRequest request) =>
        ValidateCore(request.Title, request.Owner, request.Category, request.Status, request.Amount, request.Priority);

    public static IReadOnlyList<string> Validate(UpdateItemRequest request) =>
        ValidateCore(request.Title, request.Owner, request.Category, request.Status, request.Amount, request.Priority);

    private static IReadOnlyList<string> ValidateCore(string title, string owner, string category, string status, decimal amount, string priority)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(title)) errors.Add("Title is required.");
        if (string.IsNullOrWhiteSpace(owner)) errors.Add("Owner is required.");
        if (!Categories.Contains(category)) errors.Add("Choose a valid category.");
        if (!Statuses.Contains(status)) errors.Add("Choose a valid status.");
        if (!Priorities.Contains(priority)) errors.Add("Choose a valid priority.");
        if (amount < 0) errors.Add("Amount cannot be negative.");
        return errors;
    }
}
