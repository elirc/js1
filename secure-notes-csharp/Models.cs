namespace SecureNotesCSharp;

public sealed record SecureNote(Guid Id, string OwnerEmail, string Title, string Body, string Classification, bool IsLocked);

public sealed record SecureNoteRequest(string OwnerEmail, string Title, string Body, string Classification, bool IsLocked)
{
    public SecureNote ToEntity(Guid id) => new(id, Clean(OwnerEmail), Clean(Title), Clean(Body), Clean(Classification), IsLocked);

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class SecureNoteRules
{
    public static string? Validate(SecureNoteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.OwnerEmail)) return "OwnerEmail is required.";
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        return null;
    }
}
