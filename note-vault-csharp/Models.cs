namespace NoteVaultCSharp;

public sealed record Note(Guid Id, string Title, string Body, string Tags, bool IsPinned, string Folder);

public sealed record NoteRequest(string Title, string Body, string Tags, bool IsPinned, string Folder)
{
    public Note ToEntity(Guid id) => new(id, Clean(Title), Clean(Body), Clean(Tags), IsPinned, Clean(Folder));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class NoteRules
{
    public static string? Validate(NoteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        return null;
    }
}
