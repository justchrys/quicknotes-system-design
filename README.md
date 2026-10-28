# QuickNotes System Design

QuickNotes is moving from a browser-only app to an online service for 1 million users. This project has two parts. The first is a small API client that proves the front end can talk to a REST API (using the JSONPlaceholder practice API). The second is a set of design documents that the backend team can build the real service from: the API design, the database model and the system architecture.

## API client features

- Load 10 notes from the server (GET) and show them in a list
- Create a note (POST), with validation: a title is required (max 100 characters) and the body is optional
- Delete a note (DELETE)
- Loading, success, error and empty states shown on the page
- Buttons disabled while a request is running
- User text is inserted with `textContent` only, never `innerHTML`

Note: JSONPlaceholder does not really save changes. Created notes get a fake id (101) and disappear on reload, and deletes do not change the server. The client mirrors what a real API would do; see the comment above `deleteNote()` in `api.js`.

## How to run the API client

1. Clone the repository:
   ```
   git clone https://github.com/YOUR-USERNAME/quicknotes-system-design.git
   ```
2. Open the `quicknotes-system-design` folder.
3. Open `index.html` in your browser, or right-click it in VS Code and choose **Open with Live Server**.
4. Click **Load notes**. An internet connection is needed because the client calls `https://jsonplaceholder.typicode.com/posts`.

## Design documents

- [API design](docs/api-design.md): the REST endpoints, JSON examples and error codes
- [Data model](docs/data-model.md): tables, relationships, SQL, queries, an index and the SQL vs NoSQL decision
- [Architecture](docs/architecture.md): requirements, load estimates, diagram, request flows, trade-offs and single points of failure

## What I learned

- **Using an API from JavaScript:** I wrapped `fetch` in one reusable `request()` function that checks `response.ok` and throws on errors, so every request (GET, POST and DELETE) handles problems in the same way with `try`, `catch` and `finally`.
- **Good user feedback:** a request has several states, so the page shows loading, success, error and empty messages and disables buttons while waiting, which stops double clicks and confusing screens.
- **Practice APIs are fake:** JSONPlaceholder does not store changes, so I had to decide how the client should behave and explain it in a comment, and I found that every new note has the same id, which meant I needed my own unique id to delete the right one.
- **Designing before building:** estimating the load (about 46 reads and 7 writes per second on average) showed the system is read-heavy, which explains why the design uses a cache and a read replica.
- **Many-to-many data needs a join table:** notes and tags can only be linked cleanly with a `note_tags` table, and an index on `notes (user_id, created_at)` keeps the most common query fast.
