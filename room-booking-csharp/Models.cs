namespace RoomBookingCSharp;

public sealed record Booking(Guid Id, string RoomName, string Organizer, DateTime StartsAt, DateTime EndsAt, string Purpose);

public sealed record BookingRequest(string RoomName, string Organizer, DateTime StartsAt, DateTime EndsAt, string Purpose)
{
    public Booking ToEntity(Guid id) => new(id, Clean(RoomName), Clean(Organizer), StartsAt, EndsAt, Clean(Purpose));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class BookingRules
{
    public static string? Validate(BookingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Organizer)) return "Organizer is required.";
        return null;
    }
}
