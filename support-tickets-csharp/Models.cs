namespace SupportTicketsCSharp;

public sealed record SupportTicket(Guid Id, string Subject, string Priority, string Status, string Assignee, string Body);

public sealed record SupportTicketRequest(string Subject, string Priority, string Status, string Assignee, string Body)
{
    public SupportTicket ToEntity(Guid id) => new(id, Clean(Subject), Clean(Priority), Clean(Status), Clean(Assignee), Clean(Body));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class SupportTicketRules
{
    public static string? Validate(SupportTicketRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Subject)) return "Subject is required.";
        return null;
    }
}
