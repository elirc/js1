namespace WarehouseLedgerCSharp;

public sealed record StockMovement(Guid Id, string ProductName, string WarehouseName, string Kind, int Quantity, string Reason);

public sealed record StockMovementRequest(string ProductName, string WarehouseName, string Kind, int Quantity, string Reason)
{
    public StockMovement ToEntity(Guid id) => new(id, Clean(ProductName), Clean(WarehouseName), Clean(Kind), Quantity, Clean(Reason));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class StockMovementRules
{
    public static string? Validate(StockMovementRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ProductName)) return "ProductName is required.";
        if (request.Quantity < 1) return "Quantity must be at least 1.";
        return null;
    }
}
