namespace FlashcardsCSharp;

public sealed record Flashcard(Guid Id, string Deck, string Front, string Back, string Difficulty, string Notes);

public sealed record FlashcardRequest(string Deck, string Front, string Back, string Difficulty, string Notes)
{
    public Flashcard ToEntity(Guid id) => new(id, Clean(Deck), Clean(Front), Clean(Back), Clean(Difficulty), Clean(Notes));

    private static string Clean(string? value) => (value ?? string.Empty).Trim();
}

public sealed record ApiError(string Error);

public static class FlashcardRules
{
    public static string? Validate(FlashcardRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Front)) return "Front is required.";
        if (string.IsNullOrWhiteSpace(request.Back)) return "Back is required.";
        return null;
    }
}
