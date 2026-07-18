namespace FocusTimerCSharp;

public sealed record FocusSession(Guid Id, string Label, int Minutes, DateOnly CompletedOn, string Category, string Notes);

public sealed record FocusSessionRequest(string Label, int Minutes, DateOnly CompletedOn, string Category, string Notes)
{
    public FocusSession ToEntity(Guid id) => new(id, Clean(Label), Minutes, CompletedOn, Clean(Category), Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class FocusSessionRules
{
    public static string? Validate(FocusSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Label)) return "Label is required.";
        if (request.Minutes < 1) return "Minutes must be at least 1.";
        return null;
    }
}
