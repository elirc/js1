namespace ContactBookCSharp;

public sealed record Contact(Guid Id, string FullName, string Email, string Phone, string Company, string Relationship);

public sealed record ContactRequest(string FullName, string Email, string Phone, string Company, string Relationship)
{
    public Contact ToEntity(Guid id) => new(id, Clean(FullName), Clean(Email), Clean(Phone), Clean(Company), Clean(Relationship));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class ContactRules
{
    public static string? Validate(ContactRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName)) return "FullName is required.";
        if (string.IsNullOrWhiteSpace(request.Email)) return "Email is required.";
        if (string.IsNullOrWhiteSpace(request.Phone)) return "Phone is required.";
        return null;
    }
}
