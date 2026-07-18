namespace ReadingListCSharp;

public sealed record Book(Guid Id, string Title, string Author, string Status, int Rating, string Notes);

public sealed record BookRequest(string Title, string Author, string Status, int Rating, string Notes)
{
    public Book ToEntity(Guid id) => new(id, Clean(Title), Clean(Author), Clean(Status), Rating, Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class BookRules
{
    public static string? Validate(BookRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        if (string.IsNullOrWhiteSpace(request.Author)) return "Author is required.";
        if (request.Rating < 0) return "Rating must be at least 0.";
        return null;
    }
}
