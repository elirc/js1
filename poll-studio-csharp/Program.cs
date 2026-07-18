using PollStudioCSharp;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<PollRepository>();

var app = builder.Build();
var route = "/api/polls";

app.MapGet("/", () => Results.Redirect(route));

app.MapGet(route, (PollRepository repository, string? search, string? filter) =>
{
    return Results.Ok(repository.List(search, filter));
});

app.MapGet($"{route}/{{id:guid}}", (PollRepository repository, Guid id) =>
{
    var item = repository.Get(id);
    if (item is null) return Results.NotFound(new ApiError("Poll not found."));
    return Results.Ok(item);
});

app.MapPost(route, (PollRepository repository, PollRequest request) =>
{
    var error = PollRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var created = repository.Create(request);
    return Results.Created($"{route}/{created.Id}", created);
});

app.MapPut($"{route}/{{id:guid}}", (PollRepository repository, Guid id, PollRequest request) =>
{
    var error = PollRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var updated = repository.Update(id, request);
    if (updated is null) return Results.NotFound(new ApiError("Poll not found."));
    return Results.Ok(updated);
});

app.MapDelete($"{route}/{{id:guid}}", (PollRepository repository, Guid id) =>
{
    if (!repository.Delete(id)) return Results.NotFound(new ApiError("Poll not found."));
    return Results.NoContent();
});

app.Run();

