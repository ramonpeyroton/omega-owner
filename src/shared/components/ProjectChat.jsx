// ProjectChat — read-only Slack chat surface that lives inside the
// "Daily Logs" tab of JobFullView. Renders messages from the Slack
// channel linked to the current job (jobs.slack_channel_id).
//
// Sprint 3 of the chat-per-project roadmap. Read-only on purpose:
// posting messages + uploading files come in Sprint 4 (the message
// input is intentionally absent here to keep the surface small while
// the rest of the loop bakes).
//
// What this component does:
//   * Polls /api/slack/get-messages every 30s while mounted.
//   * Shows a "Channel not connected" empty state with a small picker
//     when jobs.slack_channel_id is null. Saving the input writes back
//     to Supabase directly (anon key + permissive RLS — same pattern
//     the rest of the app uses for editable fields).
//   * Renders messages oldest-first in a chat timeline.
//   * Parses the credit line that send-message.js prepends
//     (`*Name (role)*\n…`) so bot posts show the human author instead
//     of "Omega Bot".
//   * Tiny Slack-mrkdwn pass: `*bold*`, `_italic_`, `~strike~`. Good
//     enough for what the team writes; not a full parser.
//
// What this component does NOT do (yet):
//   * No message input — Sprint 4.
//   * No file uploads — Sprint 4.
//   * No Slack user-id → real-name lookup. A direct (human-posted)
//     Slack message shows up as "U0123…". Bot posts that go through
//     send-message.js are fine because of the credit line.

import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Loader2, AlertCircle, MessageCircle, Link2, RefreshCw, Paperclip, Send,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Avatar from './ui/Avatar';

const POLL_MS = 30_000;

// Slack channel/group IDs are uppercase letter + base32-ish suffix.
// We accept C (channel) and G (private group). DMs (D…) don't make
// sense for a per-project chat.
const CHANNEL_ID_RE = /^[CG][A-Z0-9]{8,}$/;

export default function ProjectChat({ job, user, onJobUpdated }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notSetUp, setNotSetUp] = useState(false);
  const [channelId, setChannelId] = useState(job?.slack_channel_id || null);

  // Channel-connector state (only used when notSetUp = true).
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Keep the latest values around so the polling effect doesn't
  // restart on every render but always reads the current job/channel.
  const jobIdRef = useRef(job?.id);
  jobIdRef.current = job?.id;

  async function fetchMessages({ silent = false } = {}) {
    if (!jobIdRef.current) return;
    if (!silent) setRefreshing(true);
    try {
      const r = await fetch('/api/slack/get-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jobIdRef.current }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || 'Could not load messages.');
        setLoading(false);
        return;
      }
      setError('');
      setNotSetUp(!!data.notSetUp);
      setChannelId(data.channelId || null);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setLoading(false);
    } catch (err) {
      setError(err?.message || 'Network error.');
      setLoading(false);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchMessages({ silent: true });
    const id = setInterval(() => fetchMessages({ silent: true }), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  async function handleConnectChannel(e) {
    e?.preventDefault?.();
    const v = inputValue.trim().toUpperCase();
    if (!CHANNEL_ID_RE.test(v)) {
      setInputError('Should look like C0123ABCDEF (capital C + 8+ chars).');
      return;
    }
    setInputError('');
    setConnecting(true);
    try {
      const { data: updated, error: dbErr } = await supabase
        .from('jobs')
        .update({ slack_channel_id: v })
        .eq('id', job.id)
        .select()
        .single();
      if (dbErr) throw dbErr;
      onJobUpdated?.(updated);
      setChannelId(v);
      setNotSetUp(false);
      // Pull fresh messages right away so the user sees the chat live.
      await fetchMessages({ silent: false });
    } catch (err) {
      setInputError(err?.message || 'Could not save the channel.');
    } finally {
      setConnecting(false);
    }
  }

  // ─── Empty state: channel not connected ────────────────────────
  if (!loading && (notSetUp || !channelId)) {
    return (
      <div className="flex flex-col items-center text-center py-10 px-4">
        <div className="w-14 h-14 rounded-2xl bg-omega-pale flex items-center justify-center mb-3">
          <Link2 className="w-7 h-7 text-omega-orange" />
        </div>
        <p className="text-base font-bold text-omega-charcoal">
          No Slack channel connected yet
        </p>
        <p className="text-sm text-omega-stone mt-1 max-w-sm">
          Paste the Slack channel ID for this project. In Slack, right-click
          the channel → <em>View channel details</em> → copy the ID at the
          bottom (looks like <code>C0123ABCDEF</code>).
        </p>
        <form onSubmit={handleConnectChannel} className="mt-5 w-full max-w-sm flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setInputError(''); }}
            placeholder="C0123ABCDEF"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono uppercase tracking-wide focus:border-omega-orange focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={connecting || !inputValue.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-omega-orange text-white text-sm font-semibold hover:bg-omega-dark disabled:opacity-50 transition"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </form>
        {inputError && (
          <p className="text-xs text-red-600 mt-2">{inputError}</p>
        )}
        <p className="text-[11px] text-omega-stone mt-4">
          The Omega Bot must already be a member of that channel.
          {' '}If the test fails with <code>not_in_channel</code>, type{' '}
          <code>/invite @Omega Bot</code> in the channel and try again.
        </p>
      </div>
    );
  }

  // ─── Loading first time ────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-omega-stone gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading conversation…
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center text-center py-8 px-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <p className="text-sm font-semibold text-omega-charcoal">
          Couldn't load Slack messages.
        </p>
        <p className="text-xs text-red-700 mt-1 max-w-sm font-mono">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchMessages({ silent: false }); }}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:border-omega-orange text-sm font-semibold text-omega-charcoal"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  // ─── Message list ─────────────────────────────────────────────
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-omega-stone uppercase tracking-wider font-bold">
          Channel <code className="ml-1 text-omega-charcoal">{channelId}</code>
        </p>
        <button
          onClick={() => fetchMessages({ silent: false })}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-[11px] text-omega-stone hover:text-omega-orange disabled:opacity-50 transition"
        >
          {refreshing
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 text-omega-stone">
          <MessageCircle className="w-6 h-6 text-omega-fog mb-2" />
          <p className="text-sm">No messages in this channel yet.</p>
          <p className="text-xs mt-1">
            Anything posted in the Slack channel will appear here within ~30 seconds.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {messages.map((m) => (
            <MessageRow key={m.ts} message={m} />
          ))}
        </ul>
      )}

      <MessageComposer
        jobId={job.id}
        user={user}
        onSent={() => fetchMessages({ silent: false })}
      />

      <p className="pt-3 text-[10px] text-omega-fog text-center">
        Auto-refreshes every 30s · Image upload comes in Sprint 4 next mini-step
      </p>
    </div>
  );
}

// ─── Message composer ─────────────────────────────────────────────
// Single-line text input with Enter-to-send / Shift+Enter for new line.
// Image upload comes in mini-passo 2 of Sprint 4 — for now this is
// pure text via /api/slack/send-message.
function MessageComposer({ jobId, user, onSent }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const taRef = useRef(null);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    try {
      const r = await fetch('/api/slack/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Same audit-trail pattern other api/* endpoints already use.
          'x-omega-user': user?.name || '',
          'x-omega-role': user?.role || '',
        },
        body: JSON.stringify({ jobId, text: trimmed }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || 'Could not send the message.');
        return;
      }
      // Clear and refocus so the next message can start typing right
      // away. Refresh the list so we don't have to wait the full 30s
      // poll cycle to see our own post show up.
      setText('');
      taRef.current?.focus();
      onSent?.();
    } catch (err) {
      setError(err?.message || 'Network error.');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    // Enter → send. Shift+Enter → newline (default behavior).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-gray-100 mt-3 pt-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          rows={2}
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="Write a message…"
          disabled={sending}
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:border-omega-orange focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          title="Send (Enter)"
          aria-label="Send"
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-omega-orange text-white hover:bg-omega-dark disabled:opacity-50 transition flex-shrink-0"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1.5">{error}</p>
      )}
      <p className="text-[10px] text-omega-stone mt-1.5">
        Press <kbd className="px-1 py-0.5 rounded bg-omega-cloud border border-gray-200 font-mono">Enter</kbd> to send · <kbd className="px-1 py-0.5 rounded bg-omega-cloud border border-gray-200 font-mono">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}

// ─── Message row ──────────────────────────────────────────────────
function MessageRow({ message }) {
  const { author, body } = useMemo(() => parseAuthorAndBody(message), [message]);
  const when = useMemo(() => formatSlackTimestamp(message.ts), [message.ts]);
  const html = useMemo(() => renderSlackMrkdwn(body), [body]);

  return (
    <li className="flex items-start gap-3 py-3">
      <Avatar name={author || '?'} size="sm" color={author ? 'orange' : 'fog'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm font-semibold text-omega-charcoal">{author || 'Slack user'}</p>
          <span className="text-[11px] text-omega-stone">{when}</span>
        </div>
        <div
          className="text-sm text-omega-charcoal whitespace-pre-wrap break-words mt-0.5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {Array.isArray(message.files) && message.files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {message.files.map((f) => (
              <li key={f.id}>
                <a
                  href={f.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-omega-cloud text-xs font-medium text-omega-charcoal hover:text-omega-orange hover:bg-omega-pale/60 transition"
                >
                  <Paperclip className="w-3 h-3" /> {f.name || 'attachment'}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

// send-message.js prepends a credit line before the user's text.
// Pull that out so the row shows the human author + clean body.
//
// Two formats are supported because the credit line shape changed
// between Sprint 3 and Sprint 4:
//   * Sprint 4+ (current):  "Ramon Peyroton: hello"
//   * Sprint 3 (legacy):    "*Ramon Peyroton (sales)*\nhello"
// Direct Slack-typed posts (no credit line) fall through with no author.
function parseAuthorAndBody(message) {
  const text = message.text || '';

  // Sprint 4 format. Restrict the "name" half a bit so we don't
  // mistakenly steal the start of a normal message that happens to
  // contain a colon (e.g. "URL: https://…"). Names are short, fit
  // on one line, and don't contain ":" or newlines.
  const newFmt = text.match(/^([^:\n]{1,60}):\s([\s\S]+)$/);
  if (newFmt && /[A-Za-z]/.test(newFmt[1])) {
    return { author: newFmt[1].trim(), body: newFmt[2] };
  }

  // Sprint 3 legacy format.
  const oldFmt = text.match(/^\*([^*]+)\*\n([\s\S]*)$/);
  if (oldFmt) {
    return { author: stripRoleSuffix(oldFmt[1].trim()), body: oldFmt[2] };
  }

  return { author: '', body: text };
}

// "Pedro Silva (sales)" → "Pedro Silva". Keeps the avatar initial nice.
function stripRoleSuffix(s) {
  return s.replace(/\s*\([^)]*\)\s*$/, '');
}

function formatSlackTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(parseFloat(ts) * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7)  return `${diffDay}d ago`;
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// Tiny Slack-mrkdwn → HTML. Handles only the basics + escapes < > &
// so we never inject raw markup. Safe for dangerouslySetInnerHTML.
function renderSlackMrkdwn(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
}
