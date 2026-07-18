namespace EventAdminCSharp;

public sealed record EventItem(Guid Id, string Name, string Location, DateOnly Date, int Capacity, int Registered, string Status);

public sealed record EventItemRequest(string Name, string Location, DateOnly Date, int Capacity, int Registered, string Status)
{
    public EventItem ToEntity(Guid id) => new(id, Clean(Name), Clean(Location), Date, Capacity, Registered, Clean(Status));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class EventItemRules
{
    public static string? Validate(EventItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Name is required.";
        if (string.IsNullOrWhiteSpace(request.Location)) return "Location is required.";
        if (request.Capacity < 1) return "Capacity must be at least 1.";
        if (request.Registered < 0) return "Registered must be at least 0.";
        return null;
    }
}
