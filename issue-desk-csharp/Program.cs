using IssueDeskCSharp;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<IssueRepository>();

var app = builder.Build();
var route = "/api/issues";

app.MapGet("/", () => Results.Redirect(route));

app.MapGet(route, (IssueRepository repository, string? search, string? filter) =>
{
    return Results.Ok(repository.List(search, filter));
});

app.MapGet($"{route}/{{id:guid}}", (IssueRepository repository, Guid id) =>
{
    var item = repository.Get(id);
    if (item is null) return Results.NotFound(new ApiError("Issue not found."));
    return Results.Ok(item);
});

app.MapPost(route, (IssueRepository repository, IssueRequest request) =>
{
    var error = IssueRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var created = repository.Create(request);
    return Results.Created($"{route}/{created.Id}", created);
});

app.MapPut($"{route}/{{id:guid}}", (IssueRepository repository, Guid id, IssueRequest request) =>
{
    var error = IssueRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var updated = repository.Update(id, request);
    if (updated is null) return Results.NotFound(new ApiError("Issue not found."));
    return Results.Ok(updated);
});

app.MapDelete($"{route}/{{id:guid}}", (IssueRepository repository, Guid id) =>
{
    if (!repository.Delete(id)) return Results.NotFound(new ApiError("Issue not found."));
    return Results.NoContent();
});

app.Run();

