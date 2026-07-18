using SnippetVaultCSharp;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<SnippetRepository>();

var app = builder.Build();
var route = "/api/snippets";

app.MapGet("/", () => Results.Redirect(route));

app.MapGet(route, (SnippetRepository repository, string? search, string? filter) =>
{
    return Results.Ok(repository.List(search, filter));
});

app.MapGet($"{route}/{{id:guid}}", (SnippetRepository repository, Guid id) =>
{
    var item = repository.Get(id);
    if (item is null) return Results.NotFound(new ApiError("Snippet not found."));
    return Results.Ok(item);
});

app.MapPost(route, (SnippetRepository repository, SnippetRequest request) =>
{
    var error = SnippetRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var created = repository.Create(request);
    return Results.Created($"{route}/{created.Id}", created);
});

app.MapPut($"{route}/{{id:guid}}", (SnippetRepository repository, Guid id, SnippetRequest request) =>
{
    var error = SnippetRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var updated = repository.Update(id, request);
    if (updated is null) return Results.NotFound(new ApiError("Snippet not found."));
    return Results.Ok(updated);
});

app.MapDelete($"{route}/{{id:guid}}", (SnippetRepository repository, Guid id) =>
{
    if (!repository.Delete(id)) return Results.NotFound(new ApiError("Snippet not found."));
    return Results.NoContent();
});

app.Run();

