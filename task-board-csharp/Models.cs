namespace TaskBoardCSharp;

public sealed record WorkTask(Guid Id, string Title, string Priority, string Status, DateOnly DueDate, string Notes);

public sealed record WorkTaskRequest(string Title, string Priority, string Status, DateOnly DueDate, string Notes)
{
    public WorkTask ToEntity(Guid id) => new(id, Clean(Title), Clean(Priority), Clean(Status), DueDate, Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class WorkTaskRules
{
    public static string? Validate(WorkTaskRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        return null;
    }
}
