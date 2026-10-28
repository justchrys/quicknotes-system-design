# QuickNotes API Design

This document describes the real QuickNotes API that the backend team should build. (The JSONPlaceholder API used in the browser client is only a practice stand-in.)

## Conventions

- **Base URL:** `https://api.quicknotes.example/v1`
- **Format:** all requests and responses use JSON (`Content-Type: application/json`).
- **Authentication:** every endpoint except `POST /auth/login` needs the header `Authorization: Bearer <token>`.
- **Ownership:** a user can only see and change their own notes.
- **Resources are nouns** (`/notes`, `/tags`). The HTTP method says what to do.

## Endpoints

| # | Method | Path | Description | Success status |
|---|---|---|---|---|
| 1 | `POST` | `/auth/login` | Log in with email and password and receive a token | `200 OK` |
| 2 | `GET` | `/notes` | List the current user's notes (supports `page`, `limit` and `tag` query parameters) | `200 OK` |
| 3 | `GET` | `/notes/{id}` | Get one note | `200 OK` |
| 4 | `POST` | `/notes` | Create a new note | `201 Created` |
| 5 | `PUT` | `/notes/{id}` | Replace a note's title and body | `200 OK` |
| 6 | `PATCH` | `/notes/{id}` | Change only some fields of a note | `200 OK` |
| 7 | `DELETE` | `/notes/{id}` | Delete a note | `204 No Content` |
| 8 | `GET` | `/tags` | List the current user's tags | `200 OK` |
| 9 | `POST` | `/notes/{id}/tags` | Attach a tag to a note | `201 Created` |
| 10 | `DELETE` | `/notes/{id}/tags/{tagId}` | Remove a tag from a note | `204 No Content` |

## Examples

### Create a note: `POST /notes`

Request:

```json
{
  "title": "Buy milk",
  "body": "Also bread and eggs",
  "tags": ["personal"]
}
```

Response (`201 Created`):

```json
{
  "id": 42,
  "title": "Buy milk",
  "body": "Also bread and eggs",
  "tags": [
    { "id": 3, "name": "personal" }
  ],
  "created_at": "2026-10-29T09:15:00Z",
  "updated_at": "2026-10-29T09:15:00Z"
}
```

### List notes: `GET /notes?page=1&limit=2`

Response (`200 OK`):

```json
{
  "data": [
    {
      "id": 42,
      "title": "Buy milk",
      "body": "Also bread and eggs",
      "tags": [{ "id": 3, "name": "personal" }],
      "created_at": "2026-10-29T09:15:00Z",
      "updated_at": "2026-10-29T09:15:00Z"
    },
    {
      "id": 41,
      "title": "Finish the project report",
      "body": "",
      "tags": [{ "id": 5, "name": "work" }],
      "created_at": "2026-10-28T16:40:00Z",
      "updated_at": "2026-10-28T16:40:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 57
}
```

An empty list is not an error: the API returns `200 OK` with `"data": []`.

## Error codes

| Status | Meaning | Example of when it happens |
|---|---|---|
| `400 Bad Request` | The request is invalid or badly formed | `POST /notes` with no `title`, or a title longer than 100 characters |
| `401 Unauthorized` | The user is not logged in | The `Authorization` header is missing, or the token is expired or invalid |
| `403 Forbidden` | The user is logged in but not allowed to do this | User A tries `DELETE /notes/42` when note 42 belongs to user B |
| `404 Not Found` | The resource does not exist | `GET /notes/9999` when no note has that id |
| `500 Internal Server Error` | Something went wrong on the server | The database is unreachable or the server code crashes |

### Example error body

Every error uses the same JSON shape, so clients can handle them in one place.

`400 Bad Request` for `POST /notes` with an empty title:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The title is required and must be 100 characters or fewer.",
    "details": [
      { "field": "title", "problem": "must not be empty" }
    ]
  }
}
```
