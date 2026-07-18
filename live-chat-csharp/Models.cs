namespace LiveChatCSharp;

public sealed record ChatMessage(Guid Id, string Room, string Author, string Body, DateTime SentAt, bool IsSystem);

public sealed record ChatMessageRequest(string Room, string Author, string Body, DateTime SentAt, bool IsSystem)
{
    public ChatMessage ToEntity(Guid id) => new(id, Clean(Room), Clean(Author), Clean(Body), SentAt, IsSystem);

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class ChatMessageRules
{
    public static string? Validate(ChatMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Author)) return "Author is required.";
        if (string.IsNullOrWhiteSpace(request.Body)) return "Body is required.";
        return null;
    }
}
