namespace JobPipelineCSharp;

public sealed record JobApplication(Guid Id, string Company, string Role, string Stage, string Contact, DateOnly NextStepDate, string Notes);

public sealed record JobApplicationRequest(string Company, string Role, string Stage, string Contact, DateOnly NextStepDate, string Notes)
{
    public JobApplication ToEntity(Guid id) => new(id, Clean(Company), Clean(Role), Clean(Stage), Clean(Contact), NextStepDate, Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class JobApplicationRules
{
    public static string? Validate(JobApplicationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Company)) return "Company is required.";
        if (string.IsNullOrWhiteSpace(request.Role)) return "Role is required.";
        return null;
    }
}
