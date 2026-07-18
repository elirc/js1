using EventAdminCSharp;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<EventItemRepository>();

var app = builder.Build();
var route = "/api/events";

app.MapGet("/", () => Results.Redirect(route));

app.MapGet(route, (EventItemRepository repository, string? search, string? filter) =>
{
    return Results.Ok(repository.List(search, filter));
});

app.MapGet($"{route}/{{id:guid}}", (EventItemRepository repository, Guid id) =>
{
    var item = repository.Get(id);
    if (item is null) return Results.NotFound(new ApiError("EventItem not found."));
    return Results.Ok(item);
});

app.MapPost(route, (EventItemRepository repository, EventItemRequest request) =>
{
    var error = EventItemRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var created = repository.Create(request);
    return Results.Created($"{route}/{created.Id}", created);
});

app.MapPut($"{route}/{{id:guid}}", (EventItemRepository repository, Guid id, EventItemRequest request) =>
{
    var error = EventItemRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var updated = repository.Update(id, request);
    if (updated is null) return Results.NotFound(new ApiError("EventItem not found."));
    return Results.Ok(updated);
});

app.MapDelete($"{route}/{{id:guid}}", (EventItemRepository repository, Guid id) =>
{
    if (!repository.Delete(id)) return Results.NotFound(new ApiError("EventItem not found."));
    return Results.NoContent();
});

app.Run();

