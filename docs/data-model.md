# QuickNotes Data Model

## Entities

### users
| Column | Type | Key / rule |
|---|---|---|
| `id` | INTEGER | Primary key |
| `email` | TEXT | Required, unique |
| `name` | TEXT | Required |
| `password_hash` | TEXT | Required (never the plain password) |
| `created_at` | DATETIME | Required, defaults to now |

### notes
| Column | Type | Key / rule |
|---|---|---|
| `id` | INTEGER | Primary key |
| `user_id` | INTEGER | Foreign key to `users.id`, required |
| `title` | TEXT | Required, 1 to 100 characters |
| `body` | TEXT | Optional |
| `created_at` | DATETIME | Required, defaults to now |
| `updated_at` | DATETIME | Required, defaults to now |

### tags
| Column | Type | Key / rule |
|---|---|---|
| `id` | INTEGER | Primary key |
| `user_id` | INTEGER | Foreign key to `users.id`, required |
| `name` | TEXT | Required; unique for each user |

### note_tags (join table)
| Column | Type | Key / rule |
|---|---|---|
| `note_id` | INTEGER | Foreign key to `notes.id` |
| `tag_id` | INTEGER | Foreign key to `tags.id` |
| (`note_id`, `tag_id`) | | Composite primary key |

## Relationships

- **users to notes: one-to-many.** One user has many notes, but each note belongs to exactly one user (`notes.user_id`).
- **users to tags: one-to-many.** One user creates many tags, and each tag belongs to one user (`tags.user_id`), so two users can both have a tag called "work".
- **notes to tags: many-to-many.** A note can have many tags, and a tag can be used on many notes. A relational table cannot hold a list of values in one column, so the join table `note_tags` stores one row per (note, tag) pair. The composite primary key also stops the same tag being attached to the same note twice.

## CREATE TABLE statements

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  title      TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  body       TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name    TEXT NOT NULL,
  UNIQUE (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags (id)  ON DELETE CASCADE
);
```

## Example queries

**1. A user's 10 newest notes** (used by `GET /notes`):

```sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10;
```

**2. All notes with a given tag, using a JOIN** (used by `GET /notes?tag=work`):

```sql
SELECT notes.id, notes.title, notes.created_at
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags      ON tags.id = note_tags.tag_id
WHERE notes.user_id = 1
  AND tags.name = 'work'
ORDER BY notes.created_at DESC;
```

**3. How many notes each tag has** (JOIN with GROUP BY):

```sql
SELECT tags.name, COUNT(note_tags.note_id) AS number_of_notes
FROM tags
LEFT JOIN note_tags ON note_tags.tag_id = tags.id
WHERE tags.user_id = 1
GROUP BY tags.id, tags.name;
```

**4. Create a note** (used by `POST /notes`):

```sql
INSERT INTO notes (user_id, title, body)
VALUES (1, 'Buy milk', 'Also bread and eggs');
```

## Index

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC);
```

**Reason:** the most common request is "show this user's newest notes" (query 1). Without an index the database would have to read every note of every user to find one user's notes and then sort them. This index finds a user's notes directly and returns them already in date order, so the query stays fast as the table grows to millions of rows.

A second useful index would be on `note_tags (tag_id)`, to speed up searches by tag (query 2).

## SQL or NoSQL?

I would choose **SQL** (for example PostgreSQL). QuickNotes data is naturally relational: users own notes, notes have tags, and the many-to-many tag relationship is handled cleanly by a join table and a simple JOIN. SQL also enforces the rules the app depends on (every note must belong to a real user, emails are unique, titles are required and at most 100 characters, a tag cannot be attached to the same note twice) and gives strong consistency, so a user who saves a note will always see it. At the expected load of a few dozen writes per second, one SQL primary with read replicas is more than enough, so we do not need the horizontal write scaling that is NoSQL's main advantage. A document database could store a note and its tags in a single document, but it would make queries such as "all notes with this tag" and "how many notes per tag" harder and would move rule-checking from the database into our own code.
