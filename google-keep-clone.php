<?php
/**
 * NEURAL-KEEP v3.0 — DRAMATIC EDITION
 * Single-file PHP + SQLite3 Google Keep clone
 * Every interaction is a cinematic event.
 */

session_start();

// ══════════════════════════════════════════════════════════════
// DATABASE LAYER
// ══════════════════════════════════════════════════════════════
$db = new SQLite3('keep.db');
$db->exec("CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    color TEXT DEFAULT '#ffffff',
    pinned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

// ══════════════════════════════════════════════════════════════
// ACTION HANDLER
// ══════════════════════════════════════════════════════════════
$action  = $_POST['action'] ?? '';
$note_id = (int)($_POST['note_id'] ?? 0);
$flash   = '';

if ($action === 'save') {
    $title   = $_POST['title']   ?? '';
    $content = $_POST['content'] ?? '';
    $color   = $_POST['color']   ?? '#ffffff';
    $pinned  = isset($_POST['pinned']) ? 1 : 0;

    if ($note_id > 0) {
        $stmt = $db->prepare("UPDATE notes SET title=:title,content=:content,color=:color,pinned=:pinned,updated_at=CURRENT_TIMESTAMP WHERE id=:id");
        $stmt->bindValue(':id', $note_id, SQLITE3_INTEGER);
        $flash = 'updated';
    } else {
        $stmt = $db->prepare("INSERT INTO notes (title,content,color,pinned) VALUES (:title,:content,:color,:pinned)");
        $flash = 'created';
    }
    $stmt->bindValue(':title',   $title,   SQLITE3_TEXT);
    $stmt->bindValue(':content', $content, SQLITE3_TEXT);
    $stmt->bindValue(':color',   $color,   SQLITE3_TEXT);
    $stmt->bindValue(':pinned',  $pinned,  SQLITE3_INTEGER);
    $stmt->execute();
    header("Location: ?flash=$flash");
    exit;
}

if ($action === 'delete') {
    $stmt = $db->prepare("DELETE FROM notes WHERE id=:id");
    $stmt->bindValue(':id', $note_id, SQLITE3_INTEGER);
    $stmt->execute();
    header("Location: ?flash=deleted");
    exit;
}

if ($action === 'toggle_pin') {
    $stmt = $db->prepare("UPDATE notes SET pinned = NOT pinned WHERE id=:id");
    $stmt->bindValue(':id', $note_id, SQLITE3_INTEGER);
    $stmt->execute();
    header("Location: ?flash=pinned");
    exit;
}

// ══════════════════════════════════════════════════════════════
// FETCH NOTES
// ══════════════════════════════════════════════════════════════
$search = $_GET['search'] ?? '';
$where  = '';
if ($search) {
    $s     = $db->escapeString($search);
    $where = "WHERE title LIKE '%$s%' OR content LIKE '%$s%'";
}
$res   = $db->query("SELECT * FROM notes $where ORDER BY pinned DESC, updated_at DESC");
$notes = [];
while ($r = $res->fetchArray(SQLITE3_ASSOC)) $notes[] = $r;

$colors = ['#ffffff','#f28b82','#fbbc04','#fff475','#ccff90','#a7ffeb','#cbf0f8','#d7aefb'];

// Edit prefill
$edit_id    = (int)($_GET['edit'] ?? 0);
$edit_note  = null;
if ($edit_id) {
    $er = $db->query("SELECT * FROM notes WHERE id=$edit_id");
    $edit_note = $er->fetchArray(SQLITE3_ASSOC);
}
$title_val   = $edit_note ? htmlspecialchars($edit_note['title'])   : '';
$content_val = $edit_note ? htmlspecialchars($edit_note['content']) : '';
$color_val   = $edit_note ? $edit_note['color']  : '#ffffff';
$pinned_val  = $edit_note ? $edit_note['pinned'] : 0;
$note_id_val = $edit_note ? $edit_note['id']     : 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neural Keep — Dramatic Edition</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
/* ══════════════════════════════════════════════════════════════
   CINEMATIC DESIGN TOKENS
   ══════════════════════════════════════════════════════════════ */
:root {
    --bg:        #f8f9fb;
    --surface:   #ffffff;
    --primary:   #3b82f6;
    --primary-d: #2563eb;
    --accent:    #8b5cf6;
    --danger:    #ef4444;
    --success:   #10b981;
    --warning:   #f59e0b;
    --text:      #1e293b;
    --text-mut:  #64748b;
    --border:    #e2e8f0;
    --radius:    12px;
    --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
    --ease-dramatic: cubic-bezier(0.87, 0, 0.13, 1);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
    perspective: 1200px;
}

/* ══════════════════════════════════════════════════════════════
   AMBIENT BACKGROUND — LIVING ORBS
   ══════════════════════════════════════════════════════════════ */
.orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.3;
    pointer-events: none;
    z-index: 0;
    will-change: transform;
}
.orb-1 { width: 400px; height: 400px; background: #a5b4fc; top: -10%; left: -5%;  animation: orbDrift1 20s ease-in-out infinite; }
.orb-2 { width: 500px; height: 500px; background: #fbcfe8; top: 50%; right: -10%; animation: orbDrift2 25s ease-in-out infinite; }
.orb-3 { width: 350px; height: 350px; background: #a7f3d0; bottom: -5%; left: 30%; animation: orbDrift3 22s ease-in-out infinite; }

@keyframes orbDrift1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25%  { transform: translate(120px, 80px) scale(1.2); }
    50%  { transform: translate(60px, -40px) scale(0.9); }
    75%  { transform: translate(-40px, 60px) scale(1.1); }
}
@keyframes orbDrift2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%  { transform: translate(-100px, -80px) scale(1.15); }
    66%  { transform: translate(50px, 100px) scale(0.85); }
}
@keyframes orbDrift3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(80px, -120px) scale(1.3); }
}

/* ══════════════════════════════════════════════════════════════
   PAGE ENTRANCE — CINEMATIC
   ══════════════════════════════════════════════════════════════ */
.app-shell {
    position: relative;
    z-index: 1;
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
}

@keyframes shellEnter {
    0%   { opacity: 0; transform: translateY(-60px) scale(0.92) rotateX(8deg); filter: blur(12px); }
    60%  { opacity: 1; filter: blur(0); }
    100% { opacity: 1; transform: translateY(0) scale(1) rotateX(0); filter: blur(0); }
}
.app-shell { animation: shellEnter 1.1s var(--ease-dramatic) both; }

/* ══════════════════════════════════════════════════════════════
   HEADER — MAGNETIC TITLE
   ══════════════════════════════════════════════════════════════ */
.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40px;
    flex-wrap: wrap;
    gap: 16px;
}

.logo {
    font-size: 2rem;
    font-weight: 800;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    transition: transform 0.6s var(--ease-spring);
    transform-origin: left center;
}
.logo:hover {
    transform: scale(1.12) rotate(-4deg);
}
.logo .gradient {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: gradientShift 4s ease infinite;
}
@keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
}

/* ══════════════════════════════════════════════════════════════
   SEARCH — EXPANDING FIELD
   ══════════════════════════════════════════════════════════════ */
.search-form { display: flex; gap: 8px; align-items: center; }

.search-input {
    height: 44px;
    width: 220px;
    padding: 0 16px;
    border: 2px solid var(--border);
    border-radius: 10px;
    font-size: 0.95rem;
    background: var(--surface);
    transition: all 0.5s var(--ease-spring);
    outline: none;
}
.search-input:focus {
    width: 320px;
    border-color: var(--primary);
    box-shadow: 0 0 0 4px rgba(59,130,246,0.15), 0 8px 24px rgba(59,130,246,0.15);
    transform: scale(1.02);
}

/* ══════════════════════════════════════════════════════════════
   BUTTONS — MAGNETIC + RIPPLE + PARTICLE
   ══════════════════════════════════════════════════════════════ */
.btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 44px;
    padding: 0 20px;
    border: none;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.35s var(--ease-spring);
    isolation: isolate;
    text-decoration: none;
    color: var(--text);
    background: var(--surface);
    border: 2px solid var(--border);
}
.btn:hover {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 12px 32px rgba(0,0,0,0.15);
}
.btn:active {
    transform: translateY(1px) scale(0.96);
    transition-duration: 0.08s;
}
.btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: white;
    border: none;
}
.btn-primary:hover {
    box-shadow: 0 16px 40px rgba(59,130,246,0.4), 0 0 0 4px rgba(59,130,246,0.15);
}
.btn-danger { background: var(--danger); color: white; border: none; }
.btn-danger:hover { box-shadow: 0 16px 40px rgba(239,68,68,0.4); }
.btn-ghost { background: transparent; border: none; }
.btn-ghost:hover { background: rgba(0,0,0,0.05); transform: translateY(-2px) scale(1.08); }

/* Ripple layer */
.btn .ripple-layer {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    overflow: hidden;
    pointer-events: none;
}
.btn .ripple-layer span {
    position: absolute;
    border-radius: 50%;
    background: rgba(255,255,255,0.5);
    transform: scale(0);
    animation: rippleBurst 0.7s ease-out forwards;
}
@keyframes rippleBurst {
    to { transform: scale(4); opacity: 0; }
}

/* ══════════════════════════════════════════════════════════════
   FORM CARD — DRAMATIC FOCUS
   ══════════════════════════════════════════════════════════════ */
.form-wrap {
    max-width: 680px;
    margin: 0 auto 48px;
    perspective: 800px;
}

.form-card {
    background: var(--surface);
    border-radius: 20px;
    padding: 28px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
    transition: all 0.6s var(--ease-spring);
    transform-style: preserve-3d;
    position: relative;
}
.form-card::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 22px;
    background: conic-gradient(from var(--angle, 0deg), transparent, var(--primary), transparent 30%);
    z-index: -1;
    opacity: 0;
    transition: opacity 0.5s ease;
    animation: conicSpin 4s linear infinite;
}
.form-card:focus-within {
    transform: translateY(-8px) scale(1.02) rotateX(2deg);
    box-shadow: 0 30px 60px rgba(59,130,246,0.2), 0 0 0 2px rgba(59,130,246,0.3);
}
.form-card:focus-within::after { opacity: 0.7; }

@keyframes conicSpin {
    to { --angle: 360deg; }
}
@property --angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
}

.form-input, .form-textarea {
    width: 100%;
    border: 2px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 1rem;
    font-family: inherit;
    background: rgba(255,255,255,0.7);
    transition: all 0.4s var(--ease-spring);
    outline: none;
    resize: none;
}
.form-input:focus, .form-textarea:focus {
    border-color: var(--primary);
    background: #fff;
    box-shadow: 0 8px 24px rgba(59,130,246,0.12);
    transform: scale(1.01);
}
.form-input { font-size: 1.15rem; font-weight: 600; margin-bottom: 12px; }
.form-textarea { min-height: 110px; margin-bottom: 16px; line-height: 1.6; }

/* ══════════════════════════════════════════════════════════════
   COLOR SWATCHES — 3D POP
   ══════════════════════════════════════════════════════════════ */
.swatch-row { display: flex; gap: 10px; flex-wrap: wrap; }

.swatch {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    border: 3px solid transparent;
    transition: all 0.4s var(--ease-spring);
    position: relative;
    box-shadow: inset 0 2px 6px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.1);
}
.swatch:hover {
    transform: scale(1.4) translateY(-6px) rotate(12deg);
    box-shadow: 0 12px 28px rgba(0,0,0,0.25);
    z-index: 5;
}
.swatch:active { transform: scale(0.85) rotate(-10deg); }
.swatch.active {
    border-color: var(--primary);
    transform: scale(1.3);
    animation: swatchPulse 2s ease-in-out infinite;
}
@keyframes swatchPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.6); }
    50%      { box-shadow: 0 0 0 12px rgba(59,130,246,0); }
}

/* ══════════════════════════════════════════════════════════════
   NOTES GRID
   ══════════════════════════════════════════════════════════════ */
.section-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.section-title.pinned {
    animation: pinnedGlow 3s ease-in-out infinite;
}
@keyframes pinnedGlow {
    0%, 100% { text-shadow: 0 0 8px rgba(251,191,36,0.3); }
    50%      { text-shadow: 0 0 24px rgba(251,191,36,0.8), 0 0 48px rgba(251,191,36,0.4); }
}

.notes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 20px;
    margin-bottom: 48px;
}

/* ══════════════════════════════════════════════════════════════
   NOTE CARD — CINEMATIC ENTRANCE + 3D TILT
   ══════════════════════════════════════════════════════════════ */
.note-card {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
    transition:
        transform 0.55s var(--ease-spring),
        box-shadow 0.5s ease,
        filter 0.4s ease;
    transform-style: preserve-3d;
    will-change: transform;
    opacity: 0;
    animation: cardEmerge 0.85s var(--ease-dramatic) forwards;
}
@keyframes cardEmerge {
    0% {
        opacity: 0;
        transform: translateY(80px) rotateX(-30deg) scale(0.6);
        filter: blur(16px);
    }
    50% {
        opacity: 1;
        filter: blur(0);
    }
    100% {
        opacity: 1;
        transform: translateY(0) rotateX(0) scale(1);
        filter: blur(0);
    }
}
.note-card:hover {
    box-shadow:
        0 30px 60px rgba(0,0,0,0.2),
        0 0 0 2px rgba(59,130,246,0.3),
        0 0 40px rgba(59,130,246,0.2);
    z-index: 10;
}
.note-card .card-body { padding: 18px; }
.note-card .card-title {
    font-weight: 700;
    font-size: 1.1rem;
    margin-bottom: 8px;
    word-break: break-word;
}
.note-card .card-content {
    font-size: 0.9rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    color: #475569;
}
.note-card .card-meta {
    font-size: 0.75rem;
    color: var(--text-mut);
    margin-top: 12px;
}
.note-card .card-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    padding: 8px 12px;
    border-top: 1px solid rgba(0,0,0,0.06);
    background: rgba(255,255,255,0.4);
}

/* Pin badge */
.pin-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 1.1rem;
    opacity: 0.7;
    transition: all 0.4s var(--ease-spring);
}
.note-card:hover .pin-badge {
    transform: scale(1.4) rotate(20deg);
    opacity: 1;
}

/* ══════════════════════════════════════════════════════════════
   NOTE EXIT — EXPLOSION
   ══════════════════════════════════════════════════════════════ */
.note-exit {
    animation: cardExplode 0.7s var(--ease-dramatic) forwards;
    pointer-events: none;
}
@keyframes cardExplode {
    0%   { transform: scale(1) rotate(0); opacity: 1; filter: blur(0); }
    25%  { transform: scale(1.15) rotate(5deg); filter: blur(0); }
    100% { transform: scale(0.1) rotate(-40deg) translateY(100px); opacity: 0; filter: blur(24px); }
}

/* ══════════════════════════════════════════════════════════════
   TOAST — SLIDE + BOUNCE
   ══════════════════════════════════════════════════════════════ */
#toastContainer {
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    pointer-events: none;
}
.toast {
    padding: 14px 28px;
    border-radius: 12px;
    color: white;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 20px 40px rgba(0,0,0,0.25);
    animation: toastEnter 0.7s var(--ease-spring) both;
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 8px;
}
.toast.hide { animation: toastLeave 0.5s var(--ease-dramatic) forwards; }

@keyframes toastEnter {
    0%   { transform: translateY(-120px) scale(0.5) rotate(-8deg); opacity: 0; }
    70%  { transform: translateY(12px) scale(1.05) rotate(2deg); opacity: 1; }
    100% { transform: translateY(0) scale(1) rotate(0); opacity: 1; }
}
@keyframes toastLeave {
    0%   { transform: translateY(0) scale(1); opacity: 1; }
    100% { transform: translateY(-80px) scale(0.6) rotate(10deg); opacity: 0; }
}

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE — FLOATING
   ══════════════════════════════════════════════════════════════ */
.empty-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--text-mut);
}
.empty-state .icon {
    font-size: 4rem;
    display: inline-block;
    animation: floatIcon 3s ease-in-out infinite;
}
@keyframes floatIcon {
    0%, 100% { transform: translateY(0) rotate(-5deg); }
    50%      { transform: translateY(-20px) rotate(5deg); }
}

/* ══════════════════════════════════════════════════════════════
   PARTICLE CANVAS (overlay)
   ══════════════════════════════════════════════════════════════ */
#particleCanvas {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 99998;
}

/* ══════════════════════════════════════════════════════════════
   LOADING BAR
   ══════════════════════════════════════════════════════════════ */
#loadingBar {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    width: 0;
    background: linear-gradient(90deg, var(--primary), var(--accent), #ec4899);
    z-index: 999999;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(59,130,246,0.6);
}

/* ══════════════════════════════════════════════════════════════
   RESPONSIVE
   ══════════════════════════════════════════════════════════════ */
@media (max-width: 640px) {
    .search-input:focus { width: 200px; }
    .notes-grid { grid-template-columns: 1fr; }
    .header { flex-direction: column; align-items: stretch; }
    .search-form { width: 100%; }
    .search-input { width: 100%; }
    .search-input:focus { width: 100%; }
}
</style>
</head>
<body>

<!-- Loading bar -->
<div id="loadingBar"></div>

<!-- Particle canvas -->
<canvas id="particleCanvas"></canvas>

<!-- Ambient orbs -->
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="orb orb-3"></div>

<!-- App shell -->
<div class="app-shell">

    <!-- ═══════════════ HEADER ═══════════════ -->
    <header class="header">
        <div class="logo" onclick="scrollTo({top:0,behavior:'smooth'})">
            📒 <span class="gradient">Neural Keep</span>
        </div>
        <form method="GET" class="search-form">
            <input type="text" name="search" class="search-input"
                   placeholder="🔍 Search notes..."
                   value="<?= htmlspecialchars($search) ?>"
                   onfocus="magneticFocus(this)"
                   onblur="this.style.transform=''">
            <button type="submit" class="btn btn-primary" onclick="fireParticles(event, 20)">
                Search
            </button>
        </form>
    </header>

    <!-- ═══════════════ NOTE FORM ═══════════════ -->
    <div class="form-wrap">
        <form method="POST" action="" id="noteForm">
            <input type="hidden" name="note_id" value="<?= $note_id_val ?>">
            <input type="hidden" name="action" value="save">
            <input type="hidden" name="color" id="selectedColor" value="<?= $color_val ?>">

            <div class="form-card" id="formCard" style="background: <?= $color_val ?>;">
                <input type="text" name="title" class="form-input"
                       placeholder="✦ Title"
                       value="<?= $title_val ?>"
                       onfocus="formFocus()">

                <textarea name="content" class="form-textarea"
                          placeholder="✎ Take a note..."><?= $content_val ?></textarea>

                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div class="swatch-row">
                        <?php foreach ($colors as $c): ?>
                            <div class="swatch <?= $c === $color_val ? 'active' : '' ?>"
                                 style="background: <?= $c ?>;"
                                 data-color="<?= $c ?>"
                                 onclick="pickColor(this, event)"></div>
                        <?php endforeach; ?>
                    </div>

                    <div style="display:flex;align-items:center;gap:12px;">
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;user-select:none;"
                               onmouseenter="this.style.transform='scale(1.1)'"
                               onmouseleave="this.style.transform=''"
                               onchange="pinCheckAnim(this)">
                            <input type="checkbox" name="pinned" <?= $pinned_val ? 'checked' : '' ?>
                                   style="width:16px;height:16px;accent-color:#3b82f6;">
                            📌 Pin
                        </label>
                        <button type="submit" class="btn btn-primary"
                                onclick="saveAnim(event)">
                            💾 Save
                        </button>
                    </div>
                </div>
            </div>
        </form>
    </div>

    <!-- ═══════════════ NOTES ═══════════════ -->
    <?php
    $pinnedList   = array_values(array_filter($notes, fn($n) => $n['pinned'] == 1));
    $unpinnedList = array_values(array_filter($notes, fn($n) => $n['pinned'] == 0));

    if (empty($notes)): ?>
        <div class="empty-state">
            <div class="icon">📭</div>
            <p style="font-size:1.1rem;margin-top:16px;">No notes yet. Create your first one above.</p>
        </div>
    <?php else:
        $stagger = 0;
        $sections = [
            ['list' => $pinnedList,   'label' => '📌 Pinned',  'cls' => 'pinned'],
            ['list' => $unpinnedList, 'label' => '📒 Others',  'cls' => ''],
        ];
        foreach ($sections as $sec):
            if (empty($sec['list'])) continue;
    ?>
        <h2 class="section-title <?= $sec['cls'] ?>"><?= $sec['label'] ?></h2>
        <div class="notes-grid">
            <?php foreach ($sec['list'] as $note): $stagger++; ?>
                <div class="note-card"
                     id="note-<?= $note['id'] ?>"
                     style="background: <?= $note['color'] ?>; animation-delay: <?= $stagger * 0.08 ?>s;"
                     onmousemove="tiltCard(event, this)"
                     onmouseleave="resetTilt(this)">
                    <?php if ($note['pinned']): ?>
                        <span class="pin-badge">📌</span>
                    <?php endif; ?>

                    <div class="card-body">
                        <?php if ($note['title']): ?>
                            <div class="card-title"><?= htmlspecialchars($note['title']) ?></div>
                        <?php endif; ?>
                        <div class="card-content"><?= nl2br(htmlspecialchars($note['content'])) ?></div>
                        <div class="card-meta"><?= date('M d, Y · g:i A', strtotime($note['updated_at'])) ?></div>
                    </div>

                    <div class="card-actions">
                        <a href="?edit=<?= $note['id'] ?>"
                           class="btn btn-ghost" style="height:34px;font-size:0.8rem;padding:0 12px;"
                           onclick="editPulse(event, <?= $note['id'] ?>)">
                            ✏️ Edit
                        </a>
                        <form method="POST" style="display:inline;">
                            <input type="hidden" name="note_id" value="<?= $note['id'] ?>">
                            <input type="hidden" name="action" value="toggle_pin">
                            <button type="submit" class="btn btn-ghost" style="height:34px;font-size:0.8rem;padding:0 12px;"
                                    onclick="pinFlip(event)">
                                <?= $note['pinned'] ? '📍 Unpin' : '📌 Pin' ?>
                            </button>
                        </form>
                        <form method="POST" style="display:inline;">
                            <input type="hidden" name="note_id" value="<?= $note['id'] ?>">
                            <input type="hidden" name="action" value="delete">
                            <button type="submit" class="btn btn-ghost" style="height:34px;font-size:0.8rem;padding:0 12px;color:#ef4444;"
                                    onclick="deleteAnim(event, <?= $note['id'] ?>)">
                                🗑️
                            </button>
                        </form>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php endforeach; endif; ?>

</div>

<!-- Toast container -->
<div id="toastContainer"></div>

<script>
/* ══════════════════════════════════════════════════════════════
   PARTICLE ENGINE — Canvas-based explosive effects
   ══════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animationId = null;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * (opts.spread || 14);
        this.vy = (Math.random() - 0.5) * (opts.spread || 14) - (opts.upward || 0);
        this.size = Math.random() * (opts.size || 6) + 2;
        this.life = 1;
        this.decay = 0.015 + Math.random() * 0.02;
        this.color = opts.colors
            ? opts.colors[Math.floor(Math.random() * opts.colors.length)]
            : `hsl(${Math.random() * 360}, 80%, 60%)`;
        this.gravity = opts.gravity ?? 0.15;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.3;
        this.shape = opts.shape || 'circle';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= 0.98;
        this.life -= this.decay;
        this.rotation += this.rotSpeed;
        this.size *= 0.99;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;

        if (this.shape === 'star') {
            drawStar(ctx, 0, 0, 5, this.size, this.size * 0.5);
        } else if (this.shape === 'square') {
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
    ctx.fill();
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.update(); p.draw(); });

    if (particles.length > 0) {
        animationId = requestAnimationFrame(animateParticles);
    } else {
        animationId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function burst(x, y, count = 30, opts = {}) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, opts));
    }
    if (!animationId) animateParticles();
}

/* ══════════════════════════════════════════════════════════════
   INTERACTION HANDLERS
   ══════════════════════════════════════════════════════════════ */

// — Color picker
function pickColor(el, e) {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('selectedColor').value = el.dataset.color;

    const form = document.getElementById('formCard');
    form.style.background = el.dataset.color;

    // Dramatic ripple burst from the swatch
    const rect = el.getBoundingClientRect();
    burst(rect.left + rect.width/2, rect.top + rect.height/2, 20, {
        colors: [el.dataset.color, '#3b82f6', '#8b5cf6'],
        spread: 10,
        size: 5,
        gravity: 0.2
    });

    // Form card pulse
    form.animate([
        { transform: 'scale(1) rotate(0)' },
        { transform: 'scale(1.04) rotate(-1deg)' },
        { transform: 'scale(0.98) rotate(1deg)' },
        { transform: 'scale(1) rotate(0)' }
    ], { duration: 550, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
}

// — 3D Card tilt
function tiltCard(e, card) {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateY(-10px) scale(1.04)`;
}
function resetTilt(card) {
    card.style.transform = '';
}

// — Save animation
function saveAnim(e) {
    const card = document.getElementById('formCard');
    card.animate([
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(0.94) rotate(-3deg)' },
        { transform: 'scale(1.06) rotate(3deg)' },
        { transform: 'scale(1) rotate(0deg)' }
    ], { duration: 500, easing: 'ease-in-out' });

    fireParticles(e, 25, ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']);
}

// — Pin flip
function pinFlip(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    btn.animate([
        { transform: 'scale(1) rotate(0)' },
        { transform: 'scale(1.5) rotate(180deg)' },
        { transform: 'scale(1) rotate(360deg)' }
    ], { duration: 600, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    setTimeout(() => btn.closest('form').submit(), 400);
}

// — Delete explosion
function deleteAnim(e, id) {
    e.preventDefault();
    if (!confirm('Delete this note?')) return;

    const card = document.getElementById('note-' + id);
    const rect = card.getBoundingClientRect();

    // Explosion from card center
    burst(rect.left + rect.width/2, rect.top + rect.height/2, 40, {
        colors: ['#ef4444', '#f59e0b', '#ec4899', '#8b5cf6'],
        spread: 18,
        size: 8,
        gravity: 0.25,
        shape: 'square'
    });

    card.classList.add('note-exit');

    setTimeout(() => {
        const forms = document.querySelectorAll('form');
        forms.forEach(f => {
            const idInput = f.querySelector('input[name="note_id"]');
            const actInput = f.querySelector('input[name="action"]');
            if (idInput && idInput.value == id && actInput && actInput.value === 'delete') {
                f.submit();
            }
        });
    }, 650);
}

// — Edit pulse
function editPulse(e, id) {
    const card = document.getElementById('note-' + id);
    card.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.08)' },
        { transform: 'scale(1)' }
    ], { duration: 400, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
}

// — Magnetic focus on search
function magneticFocus(el) {
    el.style.transform = 'scale(1.03)';
}

// — Form focus
function formFocus() {
    // handled by CSS :focus-within
}

// — Pin checkbox animation
function pinCheckAnim(label) {
    label.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.3)' },
        { transform: 'scale(1)' }
    ], { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
}

/* ══════════════════════════════════════════════════════════════
   PARTICLE BURST FROM CLICK POINT
   ══════════════════════════════════════════════════════════════ */
function fireParticles(e, count = 20, colors = null) {
    const x = e.clientX || (e.target ? e.target.getBoundingClientRect().left + e.target.offsetWidth/2 : window.innerWidth/2);
    const y = e.clientY || (e.target ? e.target.getBoundingClientRect().top + e.target.offsetHeight/2 : window.innerHeight/2);
    burst(x, y, count, {
        colors: colors || ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
        spread: 12,
        size: 6,
        gravity: 0.2,
        shape: 'star'
    });
}

/* ══════════════════════════════════════════════════════════════
   RIPPLE ON ALL BUTTONS
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.5);
        width: ${size}px;
        height: ${size}px;
        left: ${e.clientX - rect.left - size/2}px;
        top: ${e.clientY - rect.top - size/2}px;
        transform: scale(0);
        animation: rippleBurst 0.7s ease-out forwards;
        pointer-events: none;
    `;
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
});

/* ══════════════════════════════════════════════════════════════
   TOAST SYSTEM
   ══════════════════════════════════════════════════════════════ */
function showToast(msg, bg = '#3b82f6', icon = '') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = bg;
    toast.innerHTML = `<span>${icon}</span> ${msg}`;
    container.appendChild(toast);

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(30);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 500);
    }, 2400);
}

/* ══════════════════════════════════════════════════════════════
   FLASH MESSAGES FROM PHP REDIRECTS
   ══════════════════════════════════════════════════════════════ */
const params = new URLSearchParams(window.location.search);
const flash = params.get('flash');
if (flash) {
    const messages = {
        created: { msg: 'Note created!', bg: '#10b981', icon: '✨' },
        updated: { msg: 'Note updated!', bg: '#3b82f6', icon: '💾' },
        deleted: { msg: 'Note deleted.', bg: '#ef4444', icon: '🗑️' },
        pinned:  { msg: 'Pin toggled!',  bg: '#f59e0b', icon: '📌' }
    };
    const f = messages[flash];
    if (f) {
        setTimeout(() => showToast(f.msg, f.bg, f.icon), 400);
        window.history.replaceState({}, '', window.location.pathname);
    }
}

// Edit mode toast
if (params.get('edit')) {
    setTimeout(() => {
        showToast('Editing note...', '#8b5cf6', '✏️');
        document.getElementById('formCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
}

/* ══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K → focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('.search-input');
        input.focus();
        input.select();
        fireParticles({ clientX: input.getBoundingClientRect().left + 50, clientY: input.getBoundingClientRect().top + 20 }, 15, ['#3b82f6', '#8b5cf6']);
        showToast('Search focused', '#3b82f6', '🔍');
    }

    // Ctrl/Cmd + N → new note (focus title)
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.querySelector('.form-input').focus();
        showToast('New note', '#10b981', '✨');
    }

    // Escape → blur
    if (e.key === 'Escape') {
        document.activeElement?.blur();
    }
});

/* ══════════════════════════════════════════════════════════════
   LOADING BAR — SIMULATED PROGRESS
   ══════════════════════════════════════════════════════════════ */
const loadingBar = document.getElementById('loadingBar');
let progress = 0;
const fakeProgress = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 90) { clearInterval(fakeProgress); progress = 90; }
    loadingBar.style.width = progress + '%';
}, 100);

window.addEventListener('load', () => {
    clearInterval(fakeProgress);
    loadingBar.style.width = '100%';
    setTimeout(() => { loadingBar.style.width = '0'; }, 400);
});

/* ══════════════════════════════════════════════════════════════
   CURSOR TRAIL — SUBTLE SPARKLES
   ══════════════════════════════════════════════════════════════ */
let lastTrail = 0;
document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastTrail < 60) return;
    lastTrail = now;

    if (Math.random() > 0.7) {
        particles.push(new Particle(e.clientX, e.clientY, {
            colors: ['#3b82f6', '#8b5cf6', '#ec4899'],
            spread: 3,
            size: 3,
            gravity: -0.05,
            shape: 'circle'
        }));
        if (!animationId) animateParticles();
    }
});

/* ══════════════════════════════════════════════════════════════
   SCROLL-TRIGGERED REVEAL
   ══════════════════════════════════════════════════════════════ */
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animationPlayState = 'running';
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.note-card').forEach(card => {
    card.style.animationPlayState = 'paused';
    observer.observe(card);
});

// Resume all initially visible
setTimeout(() => {
    document.querySelectorAll('.note-card').forEach(card => {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
            card.style.animationPlayState = 'running';
        }
    });
}, 100);

/* ══════════════════════════════════════════════════════════════
   BUTTON HOVER SOUND (Web Audio — subtle)
   ══════════════════════════════════════════════════════════════ */
let audioCtx = null;
function playHoverTone(freq = 800) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch(e) { /* silent fail */ }
}

document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('mouseenter', () => playHoverTone(880));
});

console.log('%c⚡ Neural Keep v3.0 — Dramatic Edition loaded.', 'color:#8b5cf6;font-size:16px;font-weight:bold;');
console.log('%c🎬 Every interaction is now a cinematic event.', 'color:#3b82f6;font-size:12px;');
</script>
</body>
</html>
<?php $db->close(); ?>