namespace RecipeStudioCSharp;

public sealed record Recipe(Guid Id, string Name, string Category, int CookTimeMinutes, int Servings, string Ingredients, string Notes);

public sealed record RecipeRequest(string Name, string Category, int CookTimeMinutes, int Servings, string Ingredients, string Notes)
{
    public Recipe ToEntity(Guid id) => new(id, Clean(Name), Clean(Category), CookTimeMinutes, Servings, Clean(Ingredients), Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class RecipeRules
{
    public static string? Validate(RecipeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Name is required.";
        if (request.CookTimeMinutes < 1) return "CookTimeMinutes must be at least 1.";
        if (request.Servings < 1) return "Servings must be at least 1.";
        return null;
    }
}
