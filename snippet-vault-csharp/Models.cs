namespace SnippetVaultCSharp;

public sealed record Snippet(Guid Id, string Title, string Language, string Tags, string Code, string Notes);

public sealed record SnippetRequest(string Title, string Language, string Tags, string Code, string Notes)
{
    public Snippet ToEntity(Guid id) => new(id, Clean(Title), Clean(Language), Clean(Tags), Clean(Code), Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class SnippetRules
{
    public static string? Validate(SnippetRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        if (string.IsNullOrWhiteSpace(request.Code)) return "Code is required.";
        return null;
    }
}
