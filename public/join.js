// Legacy room entry retired (v1.0.24).
// The former 20-card screen could reset other players' rooms when a code collided.
// All creation/joining now uses the safe 30-card lobby in deck.js.
// Never write, delete or reset Firestore data from this obsolete URL.
const home = new URL("./index.html", window.location.href);
window.location.replace(home.href);
