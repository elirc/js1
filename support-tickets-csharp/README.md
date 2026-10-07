# Support Tickets - C# Version

This folder is a C# / ASP.NET Core Minimal API version of the original `../support-tickets` project. It keeps the same CRUD learning goal, but moves the implementation into C# concepts you will see in larger corporate codebases.

## What to study

- Program.cs maps HTTP endpoints to handlers.
- Models.cs defines the domain record, request DTO, validation rules, and error response.
- Repository.cs owns in-memory storage, filtering, creation, updates, and deletes.
- SupportTicketsCSharp.csproj shows the project as an ASP.NET Core web app targeting .NET 8.

## API shape

- GET /api/tickets?search=value&filter=value lists records (both query parameters optional).
- GET /api/tickets/{id} fetches one record.
- POST /api/tickets creates a record.
- PUT /api/tickets/{id} replaces a record.
- DELETE /api/tickets/{id} removes a record.

## Corporate SWE habits this version practices

- Keep route registration in one place.
- Use request DTOs instead of accepting arbitrary data.
- Validate before mutating state.
- Hide storage details behind a repository class.
- Return consistent API error objects.
- Keep domain names explicit instead of passing dictionaries around.

## Suggested extension

Compare this folder against ../support-tickets. Add one field in both versions and trace every file that must change. That is exactly the kind of work junior engineers do when onboarding to larger codebases.
