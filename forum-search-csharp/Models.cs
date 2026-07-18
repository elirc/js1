namespace ForumSearchCSharp;

public sealed record ForumThread(Guid Id, string Title, string Author, string Body, string Tags, int SearchRank);

public sealed record ForumThreadRequest(string Title, string Author, string Body, string Tags, int SearchRank)
{
    public ForumThread ToEntity(Guid id) => new(id, Clean(Title), Clean(Author), Clean(Body), Clean(Tags), SearchRank);

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class ForumThreadRules
{
    public static string? Validate(ForumThreadRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        if (string.IsNullOrWhiteSpace(request.Author)) return "Author is required.";
        if (request.SearchRank < 0) return "SearchRank must be at least 0.";
        return null;
    }
}
