// QuickNotes API client (talks to the JSONPlaceholder practice API)

const API_URL = "https://jsonplaceholder.typicode.com/posts";
const MAX_TITLE_LENGTH = 100;

// ---------- Select elements ----------
const loadBtn = document.getElementById("load-btn");
const statusMessage = document.getElementById("status");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("submit-btn");
const notesList = document.getElementById("notes-list");

// ---------- State ----------
let notes = [];      // the notes currently shown on the page
let nextClientId = 1; // unique id used only inside this page (see deleteNote)
let busy = false;    // true while a request is running

// ---------- Reusable request function ----------
// Calls fetch, checks response.ok and throws on errors.
// Returns { status, data } so callers can show the status code.
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, data: data };
}

// ---------- Helpers ----------
function friendlyError(error) {
  if (error.status) {
    return `The server returned an error (status ${error.status}). Please try again.`;
  }
  return "Could not reach the server. Please check your internet connection and try again.";
}

function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = type ? `status ${type}` : "";
}

// Disables every button while a request is running
function setBusy(isBusy) {
  busy = isBusy;
  loadBtn.disabled = isBusy;
  submitBtn.disabled = isBusy;
  for (const button of notesList.querySelectorAll(".delete-btn")) {
    button.disabled = isBusy;
  }
}

function addClientId(note) {
  return { ...note, clientId: nextClientId++ };
}

// ---------- Render ----------
function renderNotes() {
  notesList.replaceChildren();

  // Empty state
  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("empty");
    empty.textContent = 'No notes to show. Click "Load notes" or create one.';
    notesList.append(empty);
    return;
  }

  for (const note of notes) {
    const item = document.createElement("li");
    item.classList.add("note");

    const title = document.createElement("h3");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.textContent = note.body;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.textContent = "Delete";
    deleteBtn.disabled = busy;
    deleteBtn.addEventListener("click", () => deleteNote(note));

    item.append(title, body, deleteBtn);
    notesList.append(item);
  }
}

// ---------- GET: load notes ----------
async function loadNotes() {
  if (busy) {
    return;
  }
  setBusy(true);
  setStatus("Loading notes...", "loading");

  try {
    const result = await request(`${API_URL}?_limit=10`);
    notes = result.data.map(addClientId);
    renderNotes();
    const word = notes.length === 1 ? "note" : "notes";
    setStatus(`Loaded ${notes.length} ${word} from the server.`, "success");
  } catch (error) {
    setStatus(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

// ---------- POST: create a note ----------
async function createNote(event) {
  event.preventDefault();
  if (busy) {
    return;
  }

  // Validation: title is required (max 100 characters), body is optional
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (title === "") {
    setStatus("Please enter a title for your note.", "error");
    return;
  }
  if (title.length > MAX_TITLE_LENGTH) {
    setStatus(`The title must be ${MAX_TITLE_LENGTH} characters or fewer.`, "error");
    return;
  }

  setBusy(true);
  setStatus("Creating note...", "loading");

  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title: title, body: body, userId: 1 }),
    });

    // Add the returned note to the top of the list
    notes.unshift(addClientId(result.data));
    renderNotes();
    noteForm.reset();
    setStatus(`Note created (status ${result.status}, id ${result.data.id}).`, "success");
  } catch (error) {
    setStatus(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

// ---------- DELETE: remove a note ----------
// JSONPlaceholder does not really store anything: notes we create are faked
// (every new note gets id 101 and disappears on reload), and deleting returns
// success without changing the server. A real API would remove the note from
// its database, so after a successful DELETE we remove the note from our own
// list to show what would happen. Because every fake new note has the same id
// (101), we remove by clientId (unique on this page), not by the server id.
async function deleteNote(note) {
  if (busy) {
    return;
  }
  setBusy(true);
  setStatus("Deleting note...", "loading");

  try {
    const result = await request(`${API_URL}/${note.id}`, { method: "DELETE" });
    notes = notes.filter((item) => item.clientId !== note.clientId);
    renderNotes();
    setStatus(`Note ${note.id} deleted (status ${result.status}).`, "success");
  } catch (error) {
    setStatus(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

// ---------- Events and start-up ----------
loadBtn.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
renderNotes();
