namespace PollStudioCSharp;

public sealed record Poll(Guid Id, string Question, string Status, string Options, int TotalVotes, string Notes);

public sealed record PollRequest(string Question, string Status, string Options, int TotalVotes, string Notes)
{
    public Poll ToEntity(Guid id) => new(id, Clean(Question), Clean(Status), Clean(Options), TotalVotes, Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class PollRules
{
    public static string? Validate(PollRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Question)) return "Question is required.";
        if (request.TotalVotes < 0) return "TotalVotes must be at least 0.";
        return null;
    }
}
