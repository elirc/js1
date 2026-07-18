namespace HabitTrackerCSharp;

public sealed record Habit(Guid Id, string Name, string Color, string Frequency, bool IsArchived, string Notes);

public sealed record HabitRequest(string Name, string Color, string Frequency, bool IsArchived, string Notes)
{
    public Habit ToEntity(Guid id) => new(id, Clean(Name), Clean(Color), Clean(Frequency), IsArchived, Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class HabitRules
{
    public static string? Validate(HabitRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Name is required.";
        return null;
    }
}
