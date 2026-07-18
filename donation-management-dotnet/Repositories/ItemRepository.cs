using Dapper;
using Npgsql;

namespace DonationManagementDotnet;

public sealed class ItemRepository
{
    private readonly NpgsqlDataSource _dataSource;
    private static readonly IReadOnlyDictionary<string, string> SortColumns = new Dictionary<string, string>
    {
        ["title"] = "title",
        ["owner"] = "owner",
        ["category"] = "category",
        ["status"] = "status",
        ["amount"] = "amount",
        ["priority"] = "priority",
        ["dueDate"] = "due_date",
        ["createdAt"] = "created_at"
    };

    public ItemRepository(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public async Task<PagedResult<WorkItem>> ListAsync(QueryOptions options)
    {
        var sortColumn = SortColumns.TryGetValue(options.Sort, out var column) ? column : "created_at";
        var direction = options.Dir.Equals("asc", StringComparison.OrdinalIgnoreCase) ? "ASC" : "DESC";
        var parameters = new
        {
            options.Search,
            options.Status,
            options.Category,
            options.PageSize,
            options.Offset
        };

        const string whereClause = """
            WHERE (@Search = '' OR search_vector @@ websearch_to_tsquery('english', @Search))
              AND (@Status = 'all' OR status = @Status)
              AND (@Category = 'all' OR category = @Category)
            """;

        await using var connection = await _dataSource.OpenConnectionAsync();
        var total = await connection.ExecuteScalarAsync<int>($"SELECT COUNT(*) FROM work_items {whereClause}", parameters);
        var items = (await connection.QueryAsync<WorkItem>(
            $"""
            SELECT id, title, owner, category, status, amount, priority, due_date, notes, created_at, updated_at
            FROM work_items
            {whereClause}
            ORDER BY {sortColumn} {direction}
            LIMIT @PageSize OFFSET @Offset
            """,
            parameters)).ToList();

        return new PagedResult<WorkItem>(
            items,
            total,
            options.Page,
            options.PageSize,
            Math.Max(1, (int)Math.Ceiling(total / (double)options.PageSize)));
    }

    public async Task<WorkItem?> GetByIdAsync(Guid id)
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        return await connection.QuerySingleOrDefaultAsync<WorkItem>(
            """
            SELECT id, title, owner, category, status, amount, priority, due_date, notes, created_at, updated_at
            FROM work_items
            WHERE id = @Id
            """,
            new { Id = id });
    }

    public async Task<Stats> GetStatsAsync()
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        var rows = await connection.QueryAsync<(string Status, string Category, decimal Amount)>("SELECT status, category, amount FROM work_items");
        var byStatus = DomainRules.Statuses.ToDictionary(status => status, _ => 0);
        var byCategory = DomainRules.Categories.ToDictionary(category => category, _ => 0);
        decimal amountTotal = 0;

        foreach (var row in rows)
        {
            byStatus[row.Status] = byStatus.GetValueOrDefault(row.Status) + 1;
            byCategory[row.Category] = byCategory.GetValueOrDefault(row.Category) + 1;
            amountTotal += row.Amount;
        }

        return new Stats(byStatus.Values.Sum(), amountTotal, byStatus, byCategory);
    }

    public async Task<WorkItem> CreateAsync(CreateItemRequest request)
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        var created = await connection.QuerySingleAsync<WorkItem>(
            """
            INSERT INTO work_items (title, owner, category, status, amount, priority, due_date, notes)
            VALUES (@Title, @Owner, @Category, @Status, @Amount, @Priority, @DueDate, @Notes)
            RETURNING id, title, owner, category, status, amount, priority, due_date, notes, created_at, updated_at
            """,
            request,
            transaction);

        await connection.ExecuteAsync(
            "INSERT INTO activity_entries (item_id, kind, body) VALUES (@ItemId, 'created', @Body)",
            new { ItemId = created.Id, Body = $"Created {created.Title}" },
            transaction);

        await transaction.CommitAsync();
        return created;
    }

    public async Task<WorkItem?> UpdateAsync(Guid id, UpdateItemRequest request)
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        var updated = await connection.QuerySingleOrDefaultAsync<WorkItem>(
            """
            UPDATE work_items
            SET title = @Title,
                owner = @Owner,
                category = @Category,
                status = @Status,
                amount = @Amount,
                priority = @Priority,
                due_date = @DueDate,
                notes = @Notes,
                updated_at = now()
            WHERE id = @Id
            RETURNING id, title, owner, category, status, amount, priority, due_date, notes, created_at, updated_at
            """,
            new { Id = id, request.Title, request.Owner, request.Category, request.Status, request.Amount, request.Priority, request.DueDate, request.Notes },
            transaction);

        if (updated is null) return null;

        await connection.ExecuteAsync(
            "INSERT INTO activity_entries (item_id, kind, body) VALUES (@ItemId, 'updated', @Body)",
            new { ItemId = updated.Id, Body = $"Updated {updated.Title}" },
            transaction);

        await transaction.CommitAsync();
        return updated;
    }

    public async Task<WorkItem?> ChangeStatusAsync(Guid id, string status)
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();

        var updated = await connection.QuerySingleOrDefaultAsync<WorkItem>(
            """
            UPDATE work_items
            SET status = @Status, updated_at = now()
            WHERE id = @Id
            RETURNING id, title, owner, category, status, amount, priority, due_date, notes, created_at, updated_at
            """,
            new { Id = id, Status = status },
            transaction);

        if (updated is null) return null;

        await connection.ExecuteAsync(
            "INSERT INTO activity_entries (item_id, kind, body) VALUES (@ItemId, 'status', @Body)",
            new { ItemId = id, Body = $"Changed status to {status}" },
            transaction);

        await transaction.CommitAsync();
        return updated;
    }

    public async Task<IReadOnlyList<ActivityEntry>> ListActivityAsync(Guid itemId)
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        var rows = await connection.QueryAsync<ActivityEntry>(
            """
            SELECT id, item_id, kind, body, created_at
            FROM activity_entries
            WHERE item_id = @ItemId
            ORDER BY created_at DESC
            """,
            new { ItemId = itemId });

        return rows.ToList();
    }

    public async Task<ActivityEntry?> AddActivityAsync(Guid itemId, ActivityRequest request)
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        var exists = await connection.ExecuteScalarAsync<bool>("SELECT EXISTS (SELECT 1 FROM work_items WHERE id = @ItemId)", new { ItemId = itemId });
        if (!exists) return null;

        return await connection.QuerySingleAsync<ActivityEntry>(
            """
            INSERT INTO activity_entries (item_id, kind, body)
            VALUES (@ItemId, @Kind, @Body)
            RETURNING id, item_id, kind, body, created_at
            """,
            new { ItemId = itemId, request.Kind, request.Body });
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        var affected = await connection.ExecuteAsync("DELETE FROM work_items WHERE id = @Id", new { Id = id });
        return affected == 1;
    }
}
