# QuickNotes Architecture

QuickNotes is moving from a browser-only app to an online service for **1 million users**. This document describes the requirements, the expected load and the architecture the backend team should build.

## 1. Requirements

### Functional requirements
- Users can register and log in.
- Users can create, view, edit and delete their own notes.
- Users can tag notes and find notes by tag.
- Notes are available on any device the user logs in from.
- A user can only see their own notes.

### Non-functional requirements
- **Availability:** the service should be available 99.9% of the time, with no single point of failure.
- **Performance:** loading notes should take under 300 ms for most requests.
- **Scalability:** it must handle 1 million users and grow beyond that by adding servers.
- **Durability:** a saved note must never be lost (backups and replication).
- **Consistency:** after saving a note, the user must see it straight away.
- **Security:** all traffic uses HTTPS, passwords are stored hashed, and every request is authenticated.

## 2. Load estimate

### Assumptions
- 1,000,000 registered users, of whom 20% are active each day: **200,000 daily active users**.
- Each active user loads their notes 20 times a day (reads) and creates 3 notes a day (writes).
- Peak traffic is 5 times the average, and 1 day = 86,400 seconds.
- An average note, with its metadata and indexes, takes about 2 KB.

### Results

| Measure | Calculation | Average | Peak (5x) |
|---|---|---|---|
| Reads per second | 200,000 x 20 = 4,000,000 per day / 86,400 | ~46 | ~230 |
| Writes per second | 200,000 x 3 = 600,000 per day / 86,400 | ~7 | ~35 |
| Storage per year | 600,000 notes x 2 KB x 365 | ~440 GB per year | |

- The system is **read-heavy** (about 7 reads for every write), so caching and a read replica are worthwhile.
- The numbers are modest: a single database primary can handle ~35 writes per second, so the extra servers are there mainly for **availability**, not raw power.

## 3. Architecture diagram

```
                 Client (browser / mobile app)
                    |        |             |
        1. lookup   |        | static      | API calls (HTTPS)
                    v        v files       |
               +-------+  +-------+        |
               |  DNS  |  |  CDN  |        |
               +-------+  +-------+        |
                                           v
                                   +---------------+
                                   | Load Balancer |
                                   +---+-------+---+
                                       |       |
                               +-------+--+ +--+-------+
                               | App      | | App      |
                               | server 1 | | server 2 |  ... more as needed
                               +----+-----+ +-----+----+
                                    |             |
              +---------------------+------+------+---------------+
              |                            |                      |
              v                            v                      v
        +-----------+              +-------------+          +-----------+
        |   Cache   |              |  Database   |          |   Queue   |
        |  (Redis)  |              |  (primary)  |          +-----+-----+
        +-----------+              +------+------+                |
                                          | replicates            v
                                          v                 +-----------+
                                   +--------------+         |  Worker   |
                                   | Read replica |         +-----+-----+
                                   +--------------+               |
                                                                  v
                                                 updates the database / search index
```

How to read it:
- The client asks **DNS** where the service is, gets static files (page, CSS, JavaScript) from the **CDN**, and sends API calls to the **load balancer**.
- App servers use the **cache** first, then the **read replica** for reads, and the **primary database** for writes.
- After a write, the app server adds a job to the **queue** (for example updating the search index or sending a verification email), and a **worker** processes it in the background.

## 4. What each component does

- **Client:** the browser or app that shows notes and sends API requests, so users never talk to the database directly.
- **DNS:** turns the name `api.quicknotes.example` into the address of the load balancer, so clients can find the service even when servers change.
- **CDN:** serves the static files (HTML, CSS, JavaScript, images) from servers near the user, so pages load fast and our servers are not busy delivering the same files.
- **Load balancer:** spreads requests across the app servers and stops sending traffic to a server that is down, so no single server is a bottleneck or a point of failure.
- **App servers (two or more):** run the API logic (login checks, validation, reading and writing notes) and keep no user data themselves, so we can add or remove servers as traffic changes.
- **Cache:** keeps recently read results (such as a user's first page of notes) in memory, so repeated reads do not hit the database.
- **Primary database:** stores all users, notes and tags and handles every write, so there is one reliable, consistent source of truth.
- **Read replica:** a live copy of the primary that answers read queries, which takes load off the primary and gives us a copy ready if the primary fails.
- **Queue:** holds background jobs created by writes, so the API can reply quickly and no job is lost if workers are busy or down.
- **Worker:** takes jobs from the queue and does the slow, non-urgent work, so users never wait for it.

## 5. Request flows

### GET /notes
1. The client looks up the API address using **DNS** and sends `GET /notes` with its token to the **load balancer**.
2. The load balancer forwards the request to one of the **app servers**.
3. The app server checks the token (`401` if it is missing or invalid).
4. The app server looks for this user's notes in the **cache**.
5. **Cache hit:** it returns the cached notes immediately.
6. **Cache miss:** it queries the **read replica** (for example the user's 10 newest notes), then stores the result in the cache for a short time (about 60 seconds).
7. The app server returns `200 OK` with the notes as JSON.

### POST /notes
1. The client sends `POST /notes` with its token and a JSON body to the **load balancer**, which forwards it to an **app server**.
2. The app server checks the token (`401`) and validates the body: the title must exist and be at most 100 characters (`400` if not).
3. The app server inserts the note (and its tags) into the **primary database**.
4. The app server **deletes the user's cached notes list**, so the next read is fresh and the new note appears.
5. The app server adds a job to the **queue** (for example "update the search index for note 42").
6. The app server returns `201 Created` with the new note as JSON.
7. A **worker** takes the job from the queue and completes it later. If it fails, the job is retried.

## 6. Trade-offs

- **Caching: speed vs freshness.** The cache makes reads fast and cheap, but cached data can be slightly out of date, and removing old data from the cache (invalidation) is easy to get wrong. We delete a user's cached list on every write and also use a short expiry time as a safety net.
- **Read replica: scale vs consistency.** The replica takes most of the read load, but it copies the primary with a small delay, so a user might not see a note they just created. To avoid this, reads right after a write (or for the author's own newest notes) can go to the primary.
- **Queue and worker: fast responses vs complexity.** Users get a quick reply and traffic spikes are absorbed, but background work finishes a moment later and we must run and monitor the queue, retries and failed jobs.
- **One SQL primary: simplicity vs write scaling.** A single primary keeps data consistent and is easy to reason about, but all writes go to one machine. At ~35 writes per second at peak this is fine; if the load grows a lot, we could split the data across several databases (sharding), which is much more complex.

## 7. Avoiding single points of failure

| Component | How a single point of failure is avoided |
|---|---|
| DNS | Use a managed DNS service that runs on many servers worldwide |
| CDN | The provider's network has many edge locations; if one fails, requests go to another |
| Load balancer | Run a redundant pair (or a managed load balancer spread across zones) |
| App servers | Run at least two in different availability zones; they are stateless, and health checks remove a failed one |
| Cache | Run a replicated cache; if it fails, requests fall back to the database (slower, but still working) |
| Primary database | Keep a replica that can be promoted automatically if the primary fails, with regular backups |
| Read replica | Run more than one if needed; reads can fall back to the primary |
| Queue | Use a managed, replicated queue that stores messages safely until they are processed |
| Worker | Run several workers; if one fails, others take its jobs and failed jobs are retried |
