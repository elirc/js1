namespace CourseRosterCSharp;

public sealed record Course(Guid Id, string Code, string Title, string Instructor, int Capacity, int Enrolled, string Level);

public sealed record CourseRequest(string Code, string Title, string Instructor, int Capacity, int Enrolled, string Level)
{
    public Course ToEntity(Guid id) => new(id, Clean(Code), Clean(Title), Clean(Instructor), Capacity, Enrolled, Clean(Level));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class CourseRules
{
    public static string? Validate(CourseRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code)) return "Code is required.";
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        if (string.IsNullOrWhiteSpace(request.Instructor)) return "Instructor is required.";
        if (request.Capacity < 1) return "Capacity must be at least 1.";
        if (request.Enrolled < 0) return "Enrolled must be at least 0.";
        return null;
    }
}
