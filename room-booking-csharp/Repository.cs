namespace RoomBookingCSharp;

public sealed class BookingRepository
{
    private readonly List<Booking> _items = new()
    {
        new Booking(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Atlas", "Taylor", new DateTime(2026, 7, 1, 9, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 1, 10, 0, 0, DateTimeKind.Utc), "Sprint planning"),
        new Booking(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Beacon", "Riley", new DateTime(2026, 7, 1, 11, 0, 0, DateTimeKind.Utc), new DateTime(2026, 7, 1, 12, 0, 0, DateTimeKind.Utc), "Architecture review")
    };

    public IReadOnlyList<Booking> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Booking? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Booking Create(BookingRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Booking? Update(Guid id, BookingRequest request)
    {
        var index = _items.FindIndex(item => item.Id == id);
        if (index < 0) return null;

        var updated = request.ToEntity(id);
        _items[index] = updated;
        return updated;
    }

    public bool Delete(Guid id)
    {
        var item = Get(id);
        return item is not null && _items.Remove(item);
    }

    private static bool MatchesSearch(Booking item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.RoomName} {item.Organizer} {item.Purpose}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Booking item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.RoomName), filter, StringComparison.OrdinalIgnoreCase);
    }}
