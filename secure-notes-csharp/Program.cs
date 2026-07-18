using SecureNotesCSharp;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<SecureNoteRepository>();

var app = builder.Build();
var route = "/api/secure-notes";

app.MapGet("/", () => Results.Redirect(route));

app.MapGet(route, (SecureNoteRepository repository, string? search, string? filter) =>
{
    return Results.Ok(repository.List(search, filter));
});

app.MapGet($"{route}/{{id:guid}}", (SecureNoteRepository repository, Guid id) =>
{
    var item = repository.Get(id);
    if (item is null) return Results.NotFound(new ApiError("SecureNote not found."));
    return Results.Ok(item);
});

app.MapPost(route, (SecureNoteRepository repository, SecureNoteRequest request) =>
{
    var error = SecureNoteRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var created = repository.Create(request);
    return Results.Created($"{route}/{created.Id}", created);
});

app.MapPut($"{route}/{{id:guid}}", (SecureNoteRepository repository, Guid id, SecureNoteRequest request) =>
{
    var error = SecureNoteRules.Validate(request);
    if (error is not null) return Results.BadRequest(new ApiError(error));

    var updated = repository.Update(id, request);
    if (updated is null) return Results.NotFound(new ApiError("SecureNote not found."));
    return Results.Ok(updated);
});

app.MapDelete($"{route}/{{id:guid}}", (SecureNoteRepository repository, Guid id) =>
{
    if (!repository.Delete(id)) return Results.NotFound(new ApiError("SecureNote not found."));
    return Results.NoContent();
});

app.Run();

