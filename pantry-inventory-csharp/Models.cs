namespace PantryInventoryCSharp;

public sealed record PantryItem(Guid Id, string Name, string Category, int Quantity, int Minimum, DateOnly ExpiresOn);

public sealed record PantryItemRequest(string Name, string Category, int Quantity, int Minimum, DateOnly ExpiresOn)
{
    public PantryItem ToEntity(Guid id) => new(id, Clean(Name), Clean(Category), Quantity, Minimum, ExpiresOn);

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class PantryItemRules
{
    public static string? Validate(PantryItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Name is required.";
        if (request.Quantity < 0) return "Quantity must be at least 0.";
        if (request.Minimum < 0) return "Minimum must be at least 0.";
        return null;
    }
}
