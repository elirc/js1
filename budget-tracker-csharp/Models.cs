namespace BudgetTrackerCSharp;

public sealed record Transaction(Guid Id, string Description, string Category, string Type, decimal Amount, DateOnly Date);

public sealed record TransactionRequest(string Description, string Category, string Type, decimal Amount, DateOnly Date)
{
    public Transaction ToEntity(Guid id) => new(id, Clean(Description), Clean(Category), Clean(Type), Amount, Date);

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class TransactionRules
{
    public static string? Validate(TransactionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Description)) return "Description is required.";
        if (string.IsNullOrWhiteSpace(request.Category)) return "Category is required.";
        if (request.Amount < 0.01m) return "Amount must be at least 0.01.";
        return null;
    }
}
