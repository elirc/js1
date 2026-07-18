using Dapper;
using RecruitingPipelineDotnet;

Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder(args);
var connectionString =
    builder.Configuration.GetConnectionString("Default")
    ?? builder.Configuration["DATABASE_URL"]
    ?? throw new InvalidOperationException("Set ConnectionStrings:Default or DATABASE_URL.");

builder.Services.AddSingleton(Npgsql.NpgsqlDataSource.Create(connectionString));
builder.Services.AddScoped<ItemRepository>();

var app = builder.Build();
var group = app.MapGroup("/api/candidates");

group.MapGet("/", async Task<IResult> (HttpRequest request, ItemRepository repo) =>
{
    var query = QueryOptions.From(request.Query);
    return Results.Ok(await repo.ListAsync(query));
});

group.MapGet("/stats", async Task<IResult> (ItemRepository repo) =>
{
    return Results.Ok(await repo.GetStatsAsync());
});

group.MapGet("/{id:guid}", async Task<IResult> (Guid id, ItemRepository repo) =>
{
    var item = await repo.GetByIdAsync(id);
    return item is null ? Results.NotFound(new ApiError("NotFound", "Candidate not found.")) : Results.Ok(item);
});

group.MapPost("/", async Task<IResult> (CreateItemRequest request, ItemRepository repo) =>
{
    var errors = DomainRules.Validate(request);
    if (errors.Count > 0) return Results.BadRequest(new ApiError("ValidationFailed", string.Join(" ", errors)));

    var created = await repo.CreateAsync(request);
    return Results.Created($"/api/candidates/{created.Id}", created);
});

group.MapPut("/{id:guid}", async Task<IResult> (Guid id, UpdateItemRequest request, ItemRepository repo) =>
{
    var errors = DomainRules.Validate(request);
    if (errors.Count > 0) return Results.BadRequest(new ApiError("ValidationFailed", string.Join(" ", errors)));

    var updated = await repo.UpdateAsync(id, request);
    return updated is null ? Results.NotFound(new ApiError("NotFound", "Candidate not found.")) : Results.Ok(updated);
});

group.MapPatch("/{id:guid}/status", async Task<IResult> (Guid id, ChangeStatusRequest request, ItemRepository repo) =>
{
    if (!DomainRules.Statuses.Contains(request.Status))
    {
        return Results.BadRequest(new ApiError("ValidationFailed", "Choose a valid status."));
    }

    var updated = await repo.ChangeStatusAsync(id, request.Status);
    return updated is null ? Results.NotFound(new ApiError("NotFound", "Candidate not found.")) : Results.Ok(updated);
});

group.MapGet("/{id:guid}/activity", async Task<IResult> (Guid id, ItemRepository repo) =>
{
    return Results.Ok(await repo.ListActivityAsync(id));
});

group.MapPost("/{id:guid}/activity", async Task<IResult> (Guid id, ActivityRequest request, ItemRepository repo) =>
{
    if (string.IsNullOrWhiteSpace(request.Body))
    {
        return Results.BadRequest(new ApiError("ValidationFailed", "Activity body is required."));
    }

    var created = await repo.AddActivityAsync(id, request);
    return created is null ? Results.NotFound(new ApiError("NotFound", "Candidate not found.")) : Results.Created($"/api/candidates/{id}/activity/{created.Id}", created);
});

group.MapDelete("/{id:guid}", async Task<IResult> (Guid id, ItemRepository repo) =>
{
    var deleted = await repo.DeleteAsync(id);
    return deleted ? Results.NoContent() : Results.NotFound(new ApiError("NotFound", "Candidate not found."));
});

app.Run("http://localhost:4309");
