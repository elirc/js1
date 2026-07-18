namespace PulseAnalyticsCSharp;

public sealed record MetricEvent(Guid Id, string EventName, string Channel, DateOnly OccurredOn, decimal Value, string Notes);

public sealed record MetricEventRequest(string EventName, string Channel, DateOnly OccurredOn, decimal Value, string Notes)
{
    public MetricEvent ToEntity(Guid id) => new(id, Clean(EventName), Clean(Channel), OccurredOn, Value, Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class MetricEventRules
{
    public static string? Validate(MetricEventRequest request)
    {
        if (request.Value < 0) return "Value must be at least 0.";
        return null;
    }
}
