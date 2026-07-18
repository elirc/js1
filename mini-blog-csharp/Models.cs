namespace MiniBlogCSharp;

public sealed record BlogPost(Guid Id, string Title, string Author, string Body, string Status, int CommentCount);

public sealed record BlogPostRequest(string Title, string Author, string Body, string Status, int CommentCount)
{
    public BlogPost ToEntity(Guid id) => new(id, Clean(Title), Clean(Author), Clean(Body), Clean(Status), CommentCount);

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class BlogPostRules
{
    public static string? Validate(BlogPostRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        if (string.IsNullOrWhiteSpace(request.Author)) return "Author is required.";
        if (request.CommentCount < 0) return "CommentCount must be at least 0.";
        return null;
    }
}
