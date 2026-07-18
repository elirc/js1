namespace KanbanFlowCSharp;

public sealed record BoardCard(Guid Id, string Title, string Status, int SortOrder, string Assignee, string Notes);

public sealed record BoardCardRequest(string Title, string Status, int SortOrder, string Assignee, string Notes)
{
    public BoardCard ToEntity(Guid id) => new(id, Clean(Title), Clean(Status), SortOrder, Clean(Assignee), Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class BoardCardRules
{
    public static string? Validate(BoardCardRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        if (request.SortOrder < 0) return "SortOrder must be at least 0.";
        return null;
    }
}
