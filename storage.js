// Persistent storage — uses a Railway Volume mounted at /data if present,
// otherwise falls back to a local ./data folder.
// This survives restarts AND redeploys (unlike the ephemeral filesystem).

const fs = require('fs');
const path = require('path');

// Data dir priority: Railway volume (/data) > local ./data
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, '..', 'data'));

const COUNTERS_FILE = path.join(DATA_DIR, 'counters.json');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');

// ── Init ──
function init() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(TRANSCRIPTS_DIR)) fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
        if (!fs.existsSync(COUNTERS_FILE)) fs.writeFileSync(COUNTERS_FILE, '{}', 'utf-8');
    } catch (e) {
        console.error('[Storage] Init failed:', e.message);
    }
}

// ── Counters ──
function getCounters() {
    try {
        return JSON.parse(fs.readFileSync(COUNTERS_FILE, 'utf-8'));
    } catch (_) {
        return {};
    }
}

function saveCounters(counters) {
    try {
        fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf-8');
    } catch (e) {
        console.error('[Storage] Save counters failed:', e.message);
    }
}

// Get next ticket number (never reuses, continues across all closes/redeploys)
function nextTicketNumber(category) {
    const counters = getCounters();
    const current = counters[category] || 0;
    const next = current + 1;
    counters[category] = next;
    saveCounters(counters);
    return next;
}

// ── Transcripts ──
function saveTranscript(category, ticketName, content) {
    try {
        const file = path.join(TRANSCRIPTS_DIR, `${ticketName}.txt`);
        fs.writeFileSync(file, content, 'utf-8');
        return file;
    } catch (e) {
        console.error('[Storage] Save transcript failed:', e.message);
        return null;
    }
}

function listTranscripts() {
    try {
        if (!fs.existsSync(TRANSCRIPTS_DIR)) return [];
        return fs.readdirSync(TRANSCRIPTS_DIR).filter(f => f.endsWith('.txt'));
    } catch (_) {
        return [];
    }
}

module.exports = {
    init,
    DATA_DIR,
    TRANSCRIPTS_DIR,
    nextTicketNumber,
    saveTranscript,
    listTranscripts
};
