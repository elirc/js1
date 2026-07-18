namespace InvoiceStudioCSharp;

public sealed record Invoice(Guid Id, string CustomerName, string Status, DateOnly DueDate, decimal Total, string LineItems);

public sealed record InvoiceRequest(string CustomerName, string Status, DateOnly DueDate, decimal Total, string LineItems)
{
    public Invoice ToEntity(Guid id) => new(id, Clean(CustomerName), Clean(Status), DueDate, Total, Clean(LineItems));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class InvoiceRules
{
    public static string? Validate(InvoiceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName)) return "CustomerName is required.";
        if (request.Total < 0) return "Total must be at least 0.";
        return null;
    }
}
