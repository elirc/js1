namespace OrgExplorerCSharp;

public sealed record OrgNode(Guid Id, string Name, string Role, string ParentName, int Depth, string Department);

public sealed record OrgNodeRequest(string Name, string Role, string ParentName, int Depth, string Department)
{
    public OrgNode ToEntity(Guid id) => new(id, Clean(Name), Clean(Role), Clean(ParentName), Depth, Clean(Department));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class OrgNodeRules
{
    public static string? Validate(OrgNodeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Name is required.";
        if (request.Depth < 0) return "Depth must be at least 0.";
        return null;
    }
}
