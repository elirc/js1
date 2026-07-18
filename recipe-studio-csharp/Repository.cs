namespace RecipeStudioCSharp;

public sealed class RecipeRepository
{
    private readonly List<Recipe> _items = new()
    {
        new Recipe(Guid.Parse("00000000-0000-0000-0000-000000000001"), "Lemon Herb Pasta", "Dinner", 25, 4, "pasta,lemon,parsley,olive oil", "Reserve pasta water."),
        new Recipe(Guid.Parse("00000000-0000-0000-0000-000000000002"), "Black Bean Tacos", "Lunch", 20, 3, "beans,tortillas,lime", "Toast tortillas first.")
    };

    public IReadOnlyList<Recipe> List(string? search = null, string? filter = null)
    {
        return _items
            .Where(item => MatchesSearch(item, search) && MatchesFilter(item, filter))
            .ToList();
    }

    public Recipe? Get(Guid id) => _items.FirstOrDefault(item => item.Id == id);

    public Recipe Create(RecipeRequest request)
    {
        var item = request.ToEntity(Guid.NewGuid());
        _items.Insert(0, item);
        return item;
    }

    public Recipe? Update(Guid id, RecipeRequest request)
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

    private static bool MatchesSearch(Recipe item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        var haystack = $"{item.Name} {item.Category} {item.Ingredients} {item.Notes}".ToLowerInvariant();
        return haystack.Contains(search.Trim().ToLowerInvariant());
    }

    private static bool MatchesFilter(Recipe item, string? filter)
    {
        return string.IsNullOrWhiteSpace(filter)
            || filter.Equals("all", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Convert.ToString(item.Category), filter, StringComparison.OrdinalIgnoreCase);
    }}
