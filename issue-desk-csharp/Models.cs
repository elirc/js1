namespace IssueDeskCSharp;

public sealed record Issue(Guid Id, string Title, string Status, string Priority, string Assignee, string Description);

public sealed record IssueRequest(string Title, string Status, string Priority, string Assignee, string Description)
{
    public Issue ToEntity(Guid id) => new(id, Clean(Title), Clean(Status), Clean(Priority), Clean(Assignee), Clean(Description));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class IssueRules
{
    public static string? Validate(IssueRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        if (string.IsNullOrWhiteSpace(request.Assignee)) return "Assignee is required.";
        return null;
    }
}
