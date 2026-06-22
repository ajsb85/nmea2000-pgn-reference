#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const CANBOAT = path.resolve(__dirname, '../ts-pgns/canboat.json');
const DIST    = path.resolve(__dirname, 'docs');
const OUT     = path.resolve(DIST, 'index.html');

// ── Data processing ────────────────────────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(CANBOAT, 'utf8'));

const lookups = {};
for (const e of (raw.LookupEnumerations ?? [])) {
  lookups[e.Name] = (e.EnumValues ?? []).map(v => [v.Value, v.Name]);
}
const bitLookups = {};
for (const e of (raw.LookupBitEnumerations ?? [])) {
  bitLookups[e.Name] = (e.EnumBitValues ?? []).map(v => [v.Bit ?? v.Value ?? 0, v.Name]);
}

const byPgn = new Map();
for (const d of (raw.PGNs ?? [])) {
  if (!byPgn.has(d.PGN)) byPgn.set(d.PGN, []);
  byPgn.get(d.PGN).push(d);
}

const groups = [...byPgn.entries()]
  .sort(([a], [b]) => a - b)
  .map(([pgn, defs]) => ({
    pgn,
    defs: defs.map(d => ({
      id:       d.Id,
      desc:     d.Description,
      type:     d.Type ?? 'Unknown',
      complete: !!d.Complete,
      prio:     d.Priority ?? null,
      len:      d.Length ?? null,
      minLen:   d.MinLength ?? null,
      ms:       d.TransmissionInterval ?? null,
      irr:      !!d.TransmissionIrregular,
      fallback: !!d.Fallback,
      expl:     d.Explanation ?? null,
      url:      d.URL ?? null,
      missing:  d.Missing ?? [],
      rep1: d.RepeatingFieldSet1Size ? [d.RepeatingFieldSet1Size, d.RepeatingFieldSet1StartField, d.RepeatingFieldSet1CountField] : null,
      rep2: d.RepeatingFieldSet2Size ? [d.RepeatingFieldSet2Size, d.RepeatingFieldSet2StartField, d.RepeatingFieldSet2CountField] : null,
      fields: (d.Fields ?? [])
        .slice()
        .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
        .map(f => ({
          n:   f.Order ?? 0,
          nm:  f.Name,
          ft:  f.FieldType,
          b:   f.BitLength ?? null,
          bv:  !!f.BitLengthVariable,
          u:   f.Unit ?? null,
          r:   f.Resolution ?? null,
          mn:  f.RangeMin ?? null,
          mx:  f.RangeMax ?? null,
          sg:  !!f.Signed,
          d:   f.Description ?? null,
          lk:  f.LookupEnumeration ?? null,
          blk: f.LookupBitEnumeration ?? null,
          pq:  f.PhysicalQuantity ?? null,
          key: !!f.PartOfPrimaryKey,
          c:   f.Condition ?? null,
          m:   f.Match ?? null,
        })),
    })),
  }));

const DATA = JSON.stringify({ v: raw.Version, sv: raw.SchemaVersion, groups, lookups, bitLookups });
const TOTAL_DEFS = raw.PGNs?.length ?? 0;

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy:#0F2040;
  --navy-2:#1B3A5C;
  --navy-3:#2E6DA4;
  --gold:#D4A827;
  --gold-lt:#F0C842;
  --sidebar-w:310px;
  --header-h:54px;
  --bg:#F4F7FB;
  --card:#fff;
  --border:#E2E8F0;
  --text:#1E293B;
  --text2:#64748B;
  --radius:6px;
  --fast:#1D4ED8;
  --single:#047857;
}
html,body{height:100%;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:14px;background:var(--bg);color:var(--text)}

/* ── Header ──────────────────────────────────────────────────────────────────── */
.hdr{
  position:fixed;top:0;left:0;right:0;height:var(--header-h);
  background:var(--navy);color:#fff;
  display:flex;align-items:center;gap:12px;padding:0 16px;
  z-index:200;box-shadow:0 2px 12px rgba(0,0,0,.35);
}
.hdr-logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit;flex-shrink:0}
.hdr-anchor{font-size:22px;opacity:.7}
.hdr-brand{font-weight:800;font-size:15px;letter-spacing:.3px}
.hdr-brand sup{font-size:9px;vertical-align:super}
.hdr-sep{width:1px;height:28px;background:rgba(255,255,255,.15);flex-shrink:0}
.hdr-title{font-size:12px;color:rgba(255,255,255,.55);letter-spacing:.3px;flex-shrink:0}
.hdr-search-wrap{flex:1;max-width:460px;position:relative;margin-left:auto}
.hdr-search{
  width:100%;padding:7px 14px 7px 38px;
  background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);
  border-radius:20px;color:#fff;font-size:13px;outline:none;
  transition:background .2s,border-color .2s;
}
.hdr-search::placeholder{color:rgba(255,255,255,.4)}
.hdr-search:focus{background:rgba(255,255,255,.15);border-color:var(--gold)}
.hdr-search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:.45;pointer-events:none;font-size:14px}
.hdr-ver{
  flex-shrink:0;margin-left:8px;
  background:rgba(212,168,39,.2);border:1px solid rgba(212,168,39,.35);
  color:var(--gold-lt);border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:.3px;
}

/* ── App layout ───────────────────────────────────────────────────────────────── */
.app{display:flex;height:calc(100vh - var(--header-h));margin-top:var(--header-h)}

/* ── Sidebar ─────────────────────────────────────────────────────────────────── */
.sidebar{
  width:var(--sidebar-w);flex-shrink:0;
  background:var(--navy);
  display:flex;flex-direction:column;
  border-right:1px solid rgba(255,255,255,.06);
  overflow:hidden;
}
.sb-top{
  padding:10px 12px 8px;
  border-bottom:1px solid rgba(255,255,255,.07);
  display:flex;flex-direction:column;gap:8px;
}
.sb-search-wrap{position:relative}
.sb-search{
  width:100%;padding:7px 10px 7px 34px;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);
  border-radius:8px;color:#fff;font-size:12.5px;outline:none;
  transition:background .15s,border-color .15s;
}
.sb-search::placeholder{color:rgba(255,255,255,.3)}
.sb-search:focus{background:rgba(255,255,255,.12);border-color:rgba(212,168,39,.5)}
.sb-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;opacity:.4;pointer-events:none}
.sb-filters{display:flex;gap:6px;align-items:center}
.sb-filter-btn{
  padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.12);
  background:transparent;color:rgba(255,255,255,.5);font-size:11.5px;font-weight:600;
  cursor:pointer;transition:all .15s;letter-spacing:.2px;
}
.sb-filter-btn:hover{border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.8)}
.sb-filter-btn.on{background:var(--gold);border-color:var(--gold);color:#000}
.sb-count{margin-left:auto;font-size:11px;color:rgba(255,255,255,.3);white-space:nowrap}
.sb-list{flex:1;overflow-y:auto;scroll-behavior:smooth}
.sb-list::-webkit-scrollbar{width:4px}
.sb-list::-webkit-scrollbar-track{background:transparent}
.sb-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:2px}

/* PGN list item */
.pi{
  display:flex;align-items:center;gap:0;
  padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04);
  cursor:pointer;transition:background .12s;user-select:none;
}
.pi:hover{background:rgba(255,255,255,.06)}
.pi.active{background:rgba(212,168,39,.12);border-left:3px solid var(--gold)}
.pi.active .pi-num{color:var(--gold)}
.pi-num{
  font-family:'Courier New',monospace;font-size:11.5px;font-weight:700;
  color:rgba(255,255,255,.5);min-width:56px;flex-shrink:0;letter-spacing:.5px;
}
.pi.active .pi-num{color:var(--gold)}
.pi-info{flex:1;min-width:0}
.pi-name{
  font-size:12px;color:rgba(255,255,255,.8);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.35;
}
.pi.active .pi-name{color:#fff;font-weight:600}
.pi-type{
  font-size:9.5px;font-weight:700;letter-spacing:.3px;
  padding:1.5px 5px;border-radius:3px;margin-left:6px;flex-shrink:0;
}
.pi-type.fast{background:rgba(29,78,216,.35);color:#93C5FD}
.pi-type.single{background:rgba(4,120,87,.3);color:#6EE7B7}
.pi-multi{
  font-size:10px;font-weight:700;background:rgba(212,168,39,.2);
  color:var(--gold-lt);border-radius:10px;padding:1px 6px;margin-left:4px;flex-shrink:0;
}
.sb-empty{padding:32px 16px;text-align:center;color:rgba(255,255,255,.25);font-size:13px}

/* ── Main content ─────────────────────────────────────────────────────────────── */
.content{flex:1;overflow-y:auto;padding:24px;min-width:0}
.content::-webkit-scrollbar{width:6px}
.content::-webkit-scrollbar-track{background:var(--bg)}
.content::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

/* ── Welcome / home ──────────────────────────────────────────────────────────── */
.welcome{max-width:860px;margin:0 auto}
.wlc-hero{
  background:linear-gradient(120deg,var(--navy) 0%,var(--navy-2) 100%);
  border-radius:12px;padding:36px 40px;color:#fff;margin-bottom:24px;
  position:relative;overflow:hidden;
}
.wlc-hero::before{
  content:'⚓';position:absolute;right:32px;top:16px;
  font-size:100px;opacity:.06;line-height:1;
}
.wlc-eyebrow{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--gold);margin-bottom:8px}
.wlc-title{font-size:26px;font-weight:800;line-height:1.25;margin-bottom:8px}
.wlc-sub{font-size:14px;opacity:.65;line-height:1.6}
.wlc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.stat-c{
  background:var(--card);border:1px solid var(--border);border-radius:10px;
  padding:16px;text-align:center;
}
.stat-n{font-size:26px;font-weight:800;color:var(--navy-2)}
.stat-l{font-size:11px;color:var(--text2);margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.wlc-legend{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:20px}
.wlc-legend-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:12px}
.legend-grid{display:flex;flex-wrap:wrap;gap:8px}
.legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2)}

/* ── PGN detail ──────────────────────────────────────────────────────────────── */
.detail{max-width:980px;margin:0 auto}
.pgn-hdr-card{
  background:linear-gradient(110deg,var(--navy) 0%,var(--navy-2) 60%,#1a4d8f 100%);
  border-radius:10px;padding:0;color:#fff;margin-bottom:16px;
  overflow:hidden;
}
.pgn-hdr-main{display:flex;align-items:stretch}
.pgn-hdr-num-block{
  display:flex;flex-direction:column;justify-content:center;
  padding:20px 24px;background:rgba(0,0,0,.2);
  border-right:1px solid rgba(212,168,39,.2);min-width:140px;
}
.pgn-hdr-label{font-size:9.5px;text-transform:uppercase;letter-spacing:2px;opacity:.5;font-weight:700;margin-bottom:4px}
.pgn-hdr-num{font-family:'Courier New',monospace;font-size:28px;font-weight:900;color:var(--gold);letter-spacing:1px;line-height:1}
.pgn-hdr-alt{font-size:10.5px;opacity:.4;margin-top:5px;font-family:'Courier New',monospace}
.pgn-hdr-text{flex:1;padding:20px 24px;display:flex;flex-direction:column;justify-content:center}
.pgn-hdr-name{font-size:17px;font-weight:700;line-height:1.35;margin-bottom:6px}
.pgn-hdr-id{font-size:11px;opacity:.45;font-family:'Courier New',monospace;letter-spacing:.3px}
.pgn-hdr-actions{display:flex;align-items:center;gap:8px;padding:0 20px}
.btn-copy{
  background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);
  color:rgba(255,255,255,.7);border-radius:6px;padding:6px 12px;
  font-size:11.5px;cursor:pointer;transition:all .15s;font-weight:600;white-space:nowrap;
}
.btn-copy:hover{background:rgba(255,255,255,.18);color:#fff}
.btn-copy.copied{background:rgba(16,185,129,.25);border-color:rgba(16,185,129,.4);color:#6EE7B7}

/* Variant tabs */
.variant-tabs{
  display:flex;border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.15);overflow-x:auto;
}
.variant-tab{
  padding:10px 20px;font-size:12px;color:rgba(255,255,255,.5);
  cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;
  transition:color .15s,border-color .15s;font-weight:600;flex-shrink:0;
}
.variant-tab:hover{color:rgba(255,255,255,.8)}
.variant-tab.active{color:var(--gold);border-bottom-color:var(--gold)}

/* Def card */
.def-card{background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:16px;overflow:hidden}

/* Meta row */
.meta-row{display:flex;flex-wrap:wrap;gap:8px;padding:14px 18px;border-bottom:1px solid var(--border);background:#FAFBFE}
.pill{display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:20px;overflow:hidden;font-size:12px}
.pl{background:var(--bg);padding:3px 9px;color:var(--text2);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;border-right:1px solid var(--border)}
.pv{padding:3px 10px;font-weight:600;color:var(--text)}
.pv-fast{color:var(--fast)}
.pv-single{color:var(--single)}
.pv-ok{color:var(--single)}
.pv-inc{color:#C2410C}
.pv-fb{color:#7C3AED}

/* Explanation */
.expl-block{
  margin:14px 18px;padding:12px 14px;
  background:#F0F7FF;border-left:3.5px solid var(--navy-3);border-radius:0 6px 6px 0;
}
.expl-text{font-size:13px;color:#334155;line-height:1.7}
.ref-row{margin:0 18px 12px;font-size:12px;color:var(--navy-3)}
.ref-lbl{font-weight:700;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:.3px;margin-right:4px}
.miss-row{
  margin:0 18px 12px;padding:8px 12px;
  background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;
  font-size:12px;color:#92400E;display:flex;align-items:center;gap:6px;
}

/* ── Fields table ─────────────────────────────────────────────────────────────── */
.fields-wrap{padding:0}
.ft-title{
  padding:10px 18px 8px;font-size:11px;font-weight:700;text-transform:uppercase;
  letter-spacing:.5px;color:var(--text2);border-bottom:1px solid var(--border);
  background:var(--bg);display:flex;align-items:center;gap:8px;
}
.ft-count{
  background:var(--border);color:var(--text2);border-radius:10px;
  padding:1px 8px;font-size:11px;font-weight:700;
}
.ft{width:100%;border-collapse:collapse;font-size:12.5px}
.ft thead tr{background:var(--navy);color:#fff}
.ft th{
  padding:9px 12px;text-align:left;font-size:10.5px;font-weight:700;
  text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;
}
.ft td{padding:8px 12px;vertical-align:top;border-bottom:1px solid #F1F5F9}
.fr.ev{background:#FAFCFF}
.fr.od{background:#fff}
.fr.dim td{color:#b0bec5;font-style:italic;background:#FAFAFA}
.fc-n{width:36px;text-align:center;font-weight:700;color:var(--text2);font-size:11.5px}
.fc-nm{font-weight:600;color:var(--text);min-width:140px}
.fc-nm small{display:block;font-size:10.5px;color:var(--text2);font-weight:400;margin-top:1px;line-height:1.4}
.fc-tp{white-space:nowrap;min-width:100px}
.fc-b{text-align:right;font-family:'Courier New',monospace;font-size:11.5px;min-width:48px}
.fc-u{font-size:12px;color:var(--text2);min-width:60px}
.fc-r{font-family:'Courier New',monospace;font-size:11.5px;color:var(--text2);min-width:80px}
.fc-rng{font-size:11.5px;color:var(--text2);min-width:120px;white-space:nowrap}
.fc-notes{min-width:120px}
.notes-wrap{display:flex;flex-wrap:wrap;gap:3px;align-items:flex-start}

/* Type badges */
.tb{
  display:inline-block;padding:2px 7px;border-radius:4px;
  font-size:10px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;
  font-family:'Courier New',monospace;color:#fff;white-space:nowrap;
}

/* Inline tags */
.tag{display:inline-block;font-size:10.5px;padding:1px 6px;border-radius:3px;font-weight:600}
.tag-pq{background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE}
.tag-lk{background:#F0FDF4;color:#047857;border:1px solid #BBF7D0;font-family:'Courier New',monospace;font-size:10px}
.tag-blk{background:#F5F3FF;color:#6D28D9;border:1px solid #DDD6FE;font-family:'Courier New',monospace;font-size:10px}
.tag-signed{background:#FFF7ED;color:#C2410C;border:1px solid #FED7AA}
.tag-key{background:#FEF9C3;color:#854D0E;border:1px solid #FEF08A}
.tag-cond{background:#F5F3FF;color:#6D28D9;border:1px solid #DDD6FE;font-style:italic}

/* Repeat info */
.repeat-box{
  margin:0 18px 14px;padding:10px 14px;
  background:#F0F9FF;border-left:3px solid var(--navy-3);border-radius:0 6px 6px 0;
  font-size:12.5px;color:#0C4A6E;display:flex;flex-direction:column;gap:4px;
}
.repeat-row{display:flex;align-items:baseline;gap:6px}
.ri-icon{color:var(--navy-3);font-size:14px}

/* ── Lookup tables ─────────────────────────────────────────────────────────────── */
.lut-section{padding:0 18px 14px}
.lut-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.lut{border:1px solid var(--border);border-radius:8px;overflow:hidden;font-size:12.5px}
.lut-hdr{
  background:var(--navy);color:#fff;padding:7px 12px;
  font-size:10.5px;font-weight:700;letter-spacing:.3px;
  display:flex;justify-content:space-between;align-items:center;
}
.lut-hdr-name{font-family:'Courier New',monospace}
.lut-hdr-type{font-size:9.5px;opacity:.6;font-weight:400}
.lut-body{max-height:200px;overflow-y:auto}
.lut-body::-webkit-scrollbar{width:3px}
.lut-body::-webkit-scrollbar-thumb{background:var(--border)}
.lut-row{display:flex;border-bottom:1px solid var(--border);font-size:12px}
.lut-row:last-child{border-bottom:none}
.lut-row:nth-child(even){background:var(--bg)}
.lv{padding:4px 8px;font-family:'Courier New',monospace;font-weight:700;color:var(--fast);min-width:44px;text-align:right;border-right:1px solid var(--border)}
.ln{padding:4px 10px;color:var(--text);flex:1}
.lut-overflow{padding:6px 10px;font-size:11px;color:var(--text2);font-style:italic;background:var(--bg);border-top:1px solid var(--border)}

/* ── No-field fallback ────────────────────────────────────────────────────────── */
.no-fields{padding:20px 18px;font-size:13px;color:var(--text2);font-style:italic}

/* ── Transitions ──────────────────────────────────────────────────────────────── */
.fade-in{animation:fadeIn .18s ease-out}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}

/* ── Responsive ───────────────────────────────────────────────────────────────── */
@media(max-width:768px){
  :root{--sidebar-w:100%}
  .app{flex-direction:column}
  .sidebar{height:45vh}
  .content{padding:12px}
  .wlc-stats{grid-template-columns:repeat(2,1fr)}
  .pgn-hdr-main{flex-direction:column}
  .pgn-hdr-actions{display:none}
}

/* ── Theme toggle button ─────────────────────────────────────────────────────── */
.theme-toggle{
  display:flex;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13);
  border-radius:8px;overflow:hidden;flex-shrink:0;margin-right:4px;
}
.tt-btn{
  padding:5px 10px;background:transparent;border:none;cursor:pointer;
  font-size:14px;line-height:1;transition:background .15s,color .15s;
  color:rgba(255,255,255,.4);
}
.tt-btn:hover{color:rgba(255,255,255,.85);background:rgba(255,255,255,.1)}
.tt-btn.active{background:rgba(212,168,39,.22);color:var(--gold-lt)}
.tt-btn title-attr{pointer-events:none}

/* ── Smooth theme transitions ─────────────────────────────────────────────────── */
body,.def-card,.stat-c,.wlc-legend,.meta-row,.expl-block,.miss-row,
.fr.ev,.fr.od,.fr.dim,.ft td,.lut,.lut-row,
.tag-pq,.tag-lk,.tag-blk,.tag-signed,.tag-key,.tag-cond,
.ft-title,.ft-count,.repeat-box,.no-fields,.ref-row,
.pill,.pl,.pv,.lv,.ln,.lut-overflow{
  transition:background-color .2s,color .15s,border-color .15s;
}

/* ── Dark theme ──────────────────────────────────────────────────────────────── */
[data-theme="dark"]{
  --bg:#0D1117;
  --card:#161B22;
  --border:#30363D;
  --text:#E6EDF3;
  --text2:#8B949E;
  --fast:#60A5FA;
  --single:#34D399;
  --radius:6px;
  color-scheme:dark;
}
html[data-theme="dark"],html[data-theme="dark"] body{background:var(--bg);color:var(--text)}
[data-theme="dark"] body{color:var(--text)}
/* Table rows */
[data-theme="dark"] .meta-row{background:#1C2128;border-color:var(--border)}
[data-theme="dark"] .fr.ev{background:#1C2128}
[data-theme="dark"] .fr.od{background:var(--card)}
[data-theme="dark"] .fr.dim{background:var(--bg)}
[data-theme="dark"] .fr.dim td{color:#4B5563;background:var(--bg)}
[data-theme="dark"] .ft td{border-bottom-color:#21262D}
/* Explanation */
[data-theme="dark"] .expl-block{background:rgba(30,80,140,.18)}
[data-theme="dark"] .expl-text{color:#94A3B8}
/* Warnings */
[data-theme="dark"] .miss-row{background:rgba(234,179,8,.08);border-color:rgba(234,179,8,.25);color:#FCD34D}
/* Links */
[data-theme="dark"] .ref-row{color:#60A5FA}
/* Welcome stats */
[data-theme="dark"] .stat-n{color:#60A5FA}
[data-theme="dark"] .wlc-legend-title{color:var(--text2)}
[data-theme="dark"] .legend-item{color:var(--text2)}
/* Attribute tags */
[data-theme="dark"] .tag-pq{background:rgba(29,78,216,.2);color:#93C5FD;border-color:rgba(29,78,216,.35)}
[data-theme="dark"] .tag-lk{background:rgba(4,120,87,.2);color:#6EE7B7;border-color:rgba(4,120,87,.35)}
[data-theme="dark"] .tag-blk{background:rgba(109,40,217,.2);color:#C4B5FD;border-color:rgba(109,40,217,.35)}
[data-theme="dark"] .tag-signed{background:rgba(194,65,12,.2);color:#FDBA74;border-color:rgba(194,65,12,.35)}
[data-theme="dark"] .tag-key{background:rgba(133,77,14,.2);color:#FCD34D;border-color:rgba(133,77,14,.35)}
[data-theme="dark"] .tag-cond{background:rgba(109,40,217,.2);color:#C4B5FD;border-color:rgba(109,40,217,.35)}
/* Lookup tables */
[data-theme="dark"] .lv{color:#60A5FA}
[data-theme="dark"] .lut-overflow{background:var(--bg);border-color:var(--border)}
[data-theme="dark"] .lut-row{border-color:#21262D}
[data-theme="dark"] .lut-row:nth-child(even){background:#1C2128}
/* Repeat info */
[data-theme="dark"] .repeat-box{background:rgba(14,165,233,.08);color:#7DD3FC;border-color:#0369A1}
/* Fields header strip */
[data-theme="dark"] .ft-title{background:#1C2128;border-color:var(--border);color:var(--text2)}
[data-theme="dark"] .ft-count{background:#30363D;color:var(--text2)}
[data-theme="dark"] .no-fields{color:var(--text2)}
/* Scrollbars */
[data-theme="dark"] .content::-webkit-scrollbar-track{background:var(--bg)}
[data-theme="dark"] .content::-webkit-scrollbar-thumb{background:#30363D}
[data-theme="dark"] .sb-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15)}
/* Status color overrides in dark */
[data-theme="dark"] .pv-inc{color:#FCA5A5}
[data-theme="dark"] .pv-fb{color:#C4B5FD}
[data-theme="dark"] .fc-nm small{color:var(--text2)}
[data-theme="dark"] .pill{border-color:var(--border)}
[data-theme="dark"] .pl{background:#1C2128;color:var(--text2);border-color:var(--border)}
[data-theme="dark"] .pv{color:var(--text)}
[data-theme="dark"] .ref-row a{color:#60A5FA}
[data-theme="dark"] .stat-c{background:var(--card);border-color:var(--border)}
[data-theme="dark"] .wlc-legend{background:var(--card);border-color:var(--border)}
[data-theme="dark"] .def-card{background:var(--card);border-color:var(--border)}
[data-theme="dark"] .lut{border-color:var(--border)}
[data-theme="dark"] .ln{color:var(--text)}

/* ── Bit Layout ────────────────────────────────────────────────────────────── */
.bl-section{padding:14px 18px 0;border-top:1px solid var(--border)}
.bl-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:10px;display:flex;align-items:center;gap:8px}
.bl-total{background:var(--border);color:var(--text2);border-radius:10px;padding:1px 8px;font-size:11px;font-weight:700}
.bl-bar{display:flex;height:36px;border-radius:6px;overflow:hidden;border:1px solid var(--border);margin-bottom:10px}
.bl-seg{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;min-width:2px;cursor:default;transition:filter .1s}
.bl-seg:hover{filter:brightness(1.25);z-index:1}
.bl-label{font-size:9px;color:#fff;font-weight:700;text-align:center;line-height:1.2;padding:0 3px;text-shadow:0 1px 2px rgba(0,0,0,.6);pointer-events:none;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;width:100%}
.bl-legend{display:flex;flex-wrap:wrap;gap:4px 16px;padding:0 0 14px}
.bl-li{display:flex;align-items:center;gap:4px;font-size:11.5px}
.bl-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0}
.bl-lname{color:var(--text);font-weight:500}
.bl-loff{color:var(--text2);font-family:'Courier New',monospace;font-size:10px;margin-left:2px}

/* ── Sample Output ─────────────────────────────────────────────────────────── */
.so-section{padding:14px 18px;border-top:1px solid var(--border)}
.so-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:10px}
.so-code{background:#0D1117;color:#E6EDF3;border-radius:8px;padding:14px 18px;font-family:'Courier New',monospace;font-size:12px;line-height:1.75;overflow-x:auto;border:1px solid #30363D;white-space:pre;margin:0}
.so-key{color:#79C0FF}
.so-num{color:#F0883E}
.so-str{color:#A5D6FF}
.so-meta{color:#8B949E}
[data-theme="light"] .so-code{background:#F6F8FA;color:#24292F;border-color:#D0D7DE}
[data-theme="light"] .so-key{color:#0550AE}
[data-theme="light"] .so-num{color:#953800}
[data-theme="light"] .so-str{color:#0A3069}
[data-theme="light"] .so-meta{color:#57606A}

/* ── Copy sample button ───────────────────────────────────────────────────── */
.so-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.so-copy{padding:3px 10px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text2);font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
.so-copy:hover{border-color:var(--fast);color:var(--fast)}
.so-copy.copied{background:rgba(16,185,129,.1);border-color:#10B981;color:#10B981}

/* ── Byte boundary markers ────────────────────────────────────────────────── */
.bl-bar-wrap{position:relative;margin-bottom:28px}
.bl-byte-marks{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:visible}
.bl-byte-mark{position:absolute;top:-4px;bottom:-4px;width:1px;background:rgba(0,0,0,.22);transform:translateX(-50%)}
[data-theme="dark"] .bl-byte-mark{background:rgba(255,255,255,.2)}
.bl-byte-lbl{position:absolute;top:calc(100% + 6px);font-size:9px;color:var(--text2);transform:translateX(-50%);white-space:nowrap;font-family:'Courier New',monospace}

/* ── Sync highlight ───────────────────────────────────────────────────────── */
.fr.hl>td{background:rgba(212,168,39,.12)!important;outline:1px solid rgba(212,168,39,.35)}
.bl-seg.hl{filter:brightness(1.4)!important;z-index:2;box-shadow:0 0 0 2px var(--gold)}

/* ── CAN frame breakdown ──────────────────────────────────────────────────── */
.cf-section{padding:14px 18px;border-top:1px solid var(--border)}
.cf-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cf-id{font-family:'Courier New',monospace;font-size:11px;color:var(--fast);background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 7px;font-weight:400;letter-spacing:.5px}
.cf-bar{display:flex;height:48px;border-radius:6px;overflow:hidden;border:1px solid var(--border);margin-bottom:10px}
.cf-seg{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px 3px;border-right:1px solid rgba(255,255,255,.12);overflow:hidden;min-width:0;cursor:default}
.cf-seg:last-child{border-right:none}
.cf-lbl{font-size:8px;font-weight:800;letter-spacing:.3px;color:rgba(255,255,255,.7);text-transform:uppercase;line-height:1;white-space:nowrap}
.cf-val{font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#fff;line-height:1.4;margin-top:2px;text-align:center;word-break:break-all}
.cf-prio{background:#4F46E5}
.cf-r{background:#6B7280}
.cf-dp{background:#0369A1}
.cf-pf{background:#0F766E}
.cf-ps{background:#047857}
.cf-sa{background:#374151}
.cf-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;color:var(--text2);padding-bottom:2px}
.cf-li::before{content:'·';margin-right:4px;opacity:.4}
.cf-li:first-child::before{content:''}

/* ── Cross-byte flag ──────────────────────────────────────────────────────── */
.tag-cross{background:#FFF1F2;color:#E11D48;border:1px solid #FECDD3}
[data-theme="dark"] .tag-cross{background:rgba(225,29,72,.15);color:#FB7185;border-color:rgba(225,29,72,.3)}
.fc-boff{font-size:9.5px;color:var(--text2);font-weight:400;font-family:'Courier New',monospace;display:block;margin-top:1px}

/* ── Category chip in sidebar item ───────────────────────────────────────── */
.pi-cat{font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;margin-left:4px;flex-shrink:0;background:rgba(255,255,255,.09);color:rgba(255,255,255,.4);letter-spacing:.2px;white-space:nowrap;overflow:hidden;max-width:90px;text-overflow:ellipsis}

/* ── Advanced sidebar filters ─────────────────────────────────────────────── */
.sb-adv{padding:6px 10px 8px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;gap:6px}
.sb-pq,.sb-cat{
  width:100%;padding:5px 8px;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);
  border-radius:6px;color:rgba(255,255,255,.65);font-size:12px;outline:none;cursor:pointer;
  appearance:none;-webkit-appearance:none;
}
.sb-pq option,.sb-cat option{background:#1B3A5C;color:#fff}
.sb-pq:focus,.sb-cat:focus{border-color:rgba(212,168,39,.5)}

/* ── Enumeration browser ──────────────────────────────────────────────────── */
.eb-section{margin-top:24px;background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.eb-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;cursor:pointer;user-select:none;border-bottom:1px solid transparent;transition:border-color .15s}
.eb-hdr.open{border-bottom-color:var(--border)}
.eb-hdr-left{display:flex;align-items:center;gap:10px}
.eb-title{font-size:13px;font-weight:700;color:var(--text)}
.eb-meta{font-size:11px;color:var(--text2)}
.eb-toggle{font-size:16px;color:var(--text2);transition:transform .2s;line-height:1}
.eb-toggle.open{transform:rotate(180deg)}
.eb-body{display:none;padding:16px 20px}
.eb-body.open{display:block}
.eb-search{width:100%;padding:7px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;margin-bottom:12px;transition:border-color .15s}
.eb-search:focus{border-color:var(--fast)}
.eb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.eb-empty{font-size:13px;color:var(--text2);text-align:center;padding:20px}

/* ── PGN category badge in header ────────────────────────────────────────── */
.pgn-hdr-cat{
  font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;
  padding:3px 10px;border-radius:12px;margin-top:4px;display:inline-block;
  background:rgba(255,255,255,.1);color:rgba(255,255,255,.65);
}

/* ── Quality dot ──────────────────────────────────────────────────────────── */
.qi-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-left:4px;align-self:center}
.qi-ok{background:#10B981}.qi-partial{background:#F59E0B}.qi-stub{background:#EF4444}

/* ── Bookmarks & Recent in sidebar ───────────────────────────────────────── */
.sb-section{border-bottom:1px solid rgba(255,255,255,.07)}
.sb-sec-hdr{display:flex;align-items:center;justify-content:space-between;padding:7px 12px 5px;cursor:pointer;user-select:none}
.sb-sec-title{font-size:10.5px;font-weight:700;letter-spacing:.3px;color:rgba(255,255,255,.4);text-transform:uppercase}
.sb-sec-right{display:flex;align-items:center;gap:8px;font-size:11px;color:rgba(255,255,255,.3)}
.sb-sec-clr{cursor:pointer;text-decoration:underline;color:rgba(255,255,255,.25)}
.sb-sec-clr:hover{color:rgba(255,255,255,.6)}
.sb-sec-toggle{font-size:11px;transition:transform .15s}
.sb-sec-toggle.open{transform:rotate(90deg)}
.pi-sm{display:flex;align-items:center;gap:0;padding:5px 12px;cursor:pointer;transition:background .1s;border-bottom:1px solid rgba(255,255,255,.025)}
.pi-sm:hover{background:rgba(255,255,255,.05)}
.pi-sm.active{background:rgba(212,168,39,.1);border-left:3px solid var(--gold)}
.pi-sm-num{font-family:'Courier New',monospace;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.4);min-width:56px;flex-shrink:0}
.pi-sm-name{font-size:11.5px;color:rgba(255,255,255,.65);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pi-bm-star{font-size:13px;color:var(--gold);flex-shrink:0;margin-left:4px}

/* ── Bookmark & Share buttons ─────────────────────────────────────────────── */
.btn-bm{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.6);border-radius:6px;padding:6px 10px;font-size:15px;cursor:pointer;transition:all .15s;line-height:1}
.btn-bm:hover{background:rgba(212,168,39,.2);color:var(--gold)}
.btn-bm.active{background:rgba(212,168,39,.2);border-color:rgba(212,168,39,.4);color:var(--gold)}
.btn-share{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);border-radius:6px;padding:6px 12px;font-size:11.5px;cursor:pointer;transition:all .15s;font-weight:600;white-space:nowrap}
.btn-share:hover{background:rgba(255,255,255,.18);color:#fff}

/* ── PGN navigable tag ────────────────────────────────────────────────────── */
.tag-pgnref{background:#FEF9C3;color:#854D0E;border:1px solid #FEF08A;font-size:10px}
[data-theme="dark"] .tag-pgnref{background:rgba(212,168,39,.15);color:#FCD34D;border-color:rgba(212,168,39,.3)}
.so-pgnref{cursor:pointer;color:var(--gold);text-decoration:underline dotted;font-weight:700}

/* ── Lookup shared usage ──────────────────────────────────────────────────── */
.lut-shared{padding:4px 10px;font-size:10.5px;color:var(--text2);border-top:1px solid var(--border);background:var(--bg)}
[data-theme="dark"] .lut-shared{background:#1C2128}

/* ── Hex dump ─────────────────────────────────────────────────────────────── */
.hd-section{padding:14px 18px;border-top:1px solid var(--border)}
.hd-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hd-note{font-size:10.5px;font-weight:400;color:var(--text2);background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 7px;letter-spacing:0}
.hd-dump{font-family:'Courier New',monospace;font-size:12px;line-height:1.8;border:1px solid var(--border);border-radius:8px;overflow-x:auto;background:var(--bg);padding:10px 14px}
.hd-row{display:flex;gap:16px;align-items:baseline;white-space:nowrap}
.hd-off{color:var(--text2);font-size:10.5px;min-width:38px;flex-shrink:0}
.hd-hex{flex:0 0 auto;display:flex;gap:6px;flex-wrap:nowrap}
.hd-byte{min-width:19px;display:inline-block;font-weight:600}
.hd-sep{color:var(--border);padding:0 2px;flex-shrink:0}
.hd-asc{color:var(--text2);letter-spacing:1px;flex-shrink:0}
.hd-leg{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:10px}
.hd-li{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text2)}
.hd-ldot{width:8px;height:8px;border-radius:2px;flex-shrink:0}

/* ── Fast-packet frame diagram ────────────────────────────────────────────── */
.fp-section{padding:14px 18px;border-top:1px solid var(--border)}
.fp-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:10px;display:flex;align-items:center;gap:8px}
.fp-tag{font-size:10px;font-weight:400;background:rgba(29,78,216,.15);color:#93C5FD;border-radius:4px;padding:1px 7px;border:1px solid rgba(29,78,216,.2)}
.fp-frames{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
.fp-frame{display:flex;align-items:stretch;height:34px;border-radius:5px;overflow:hidden;border:1px solid var(--border);font-family:'Courier New',monospace;font-size:11px}
.fp-cell{display:flex;align-items:center;justify-content:center;padding:2px 4px;border-right:1px solid rgba(255,255,255,.15);flex-shrink:0;font-weight:700;color:#fff;text-align:center;font-size:10px;line-height:1.2}
.fp-cell:last-child{border-right:none}
.fp-hdr{background:#4F46E5;min-width:52px}
.fp-len{background:#0369A1;min-width:40px}
.fp-data{background:#047857;flex:1}
.fp-data.pad{background:#374151;opacity:.4}
.fp-info{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;color:var(--text2)}
.fp-li::before{content:'·';margin-right:4px;opacity:.4}
.fp-li:first-child::before{content:''}

/* ── Category stats ───────────────────────────────────────────────────────── */
.cs-section{margin-top:16px;background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.cs-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);padding:14px 20px 8px}
.cs-row{display:flex;align-items:center;gap:10px;padding:6px 20px}
.cs-row:last-child{padding-bottom:14px}
.cs-name{font-size:12px;font-weight:600;color:var(--text);min-width:160px;flex-shrink:0}
.cs-bar-wrap{flex:1;height:8px;background:var(--bg);border-radius:4px;overflow:hidden;border:1px solid var(--border)}
.cs-bar{height:100%;background:var(--navy-3);border-radius:4px;transition:width .3s}
.cs-pct{font-size:11px;color:var(--text2);font-family:'Courier New',monospace;min-width:36px;text-align:right;flex-shrink:0}
.cs-count{font-size:10.5px;color:var(--text2);min-width:52px;text-align:right;flex-shrink:0}
[data-theme="dark"] .cs-bar{background:var(--fast)}
/* ── Print view ─────────────────────────────────────────────────────────────── */
@media print{
  .hdr,.sidebar,.theme-toggle,.btn-copy,.btn-share,.btn-bm,.btn-print,.btn-diff,
  .so-copy,.sb-adv,.pgn-hdr-actions,.variant-tabs,.bl-section,.cf-section,
  .fp-section,.hd-section,.so-section,.cs-section,.eb-section,.rel-section,
  .rc-section,.diff-overlay,.dc-section{display:none!important}
  .app{display:block;margin-top:0}
  .content{overflow:visible;padding:0}
  .detail{max-width:100%}
  .pgn-hdr-card{border-radius:0;box-shadow:none;break-inside:avoid}
  .def-card{break-inside:avoid;border:1px solid #ccc}
  body{font-size:12px;color:#000;background:#fff}
  .pgn-hdr-num{color:#000!important}
}
.btn-print{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);border-radius:6px;padding:6px 12px;font-size:11.5px;cursor:pointer;transition:all .15s;font-weight:600}
.btn-print:hover{background:rgba(255,255,255,.18);color:#fff}
.btn-diff{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);border-radius:6px;padding:6px 12px;font-size:11.5px;cursor:pointer;transition:all .15s;font-weight:600}
.btn-diff:hover{background:rgba(255,255,255,.18);color:#fff}
/* ── Bit budget warning ──────────────────────────────────────────────────────── */
.budget-warn{margin:0 18px 12px;padding:8px 12px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;font-size:12px;color:#92400E;display:flex;align-items:center;gap:6px}
[data-theme="dark"] .budget-warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.3);color:#FCD34D}
/* ── Undocumented field marker ──────────────────────────────────────────────── */
.tag-undoc{background:#F5F5F5;color:#9CA3AF;border:1px dashed #D1D5DB;font-style:italic}
[data-theme="dark"] .tag-undoc{background:rgba(156,163,175,.08);color:#6B7280;border-color:#374151}
/* ── Related PGNs ────────────────────────────────────────────────────────────── */
.rel-section{padding:14px 18px;border-top:1px solid var(--border)}
.rel-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:10px}
.rel-grid{display:flex;flex-wrap:wrap;gap:6px}
.rel-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--bg);border:1px solid var(--border);border-radius:20px;font-size:12px;cursor:pointer;transition:all .12s;color:var(--text)}
.rel-chip:hover{border-color:var(--fast);color:var(--fast)}
.rel-num{font-family:'Courier New',monospace;font-weight:700;font-size:11px;color:var(--text2)}
/* ── Device class ────────────────────────────────────────────────────────────── */
.dc-section{padding:8px 18px 14px;border-top:1px solid var(--border)}
.dc-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.dc-label{font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-right:4px}
.dc-chip{display:inline-flex;align-items:center;padding:3px 10px;border-radius:12px;font-size:11.5px;font-weight:600;background:rgba(15,118,110,.12);color:#0F766E;border:1px solid rgba(15,118,110,.25)}
[data-theme="dark"] .dc-chip{background:rgba(52,211,153,.1);color:#34D399;border-color:rgba(52,211,153,.2)}
/* ── Round-trip decoder ──────────────────────────────────────────────────────── */
.rt-section{padding:14px 18px;border-top:1px solid var(--border)}
.rt-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:10px}
.rt-table{width:100%;font-size:12px;border-collapse:collapse}
.rt-table th{padding:6px 10px;background:var(--navy);color:#fff;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;text-align:left}
.rt-table td{padding:6px 10px;border-bottom:1px solid var(--border);vertical-align:top}
.rt-raw{font-family:'Courier New',monospace;font-weight:700;color:var(--fast)}
.rt-val{font-weight:600;color:var(--text)}
.rt-unit{color:var(--text2);font-size:11px;margin-left:4px}
[data-theme="dark"] .rt-table td{border-color:#21262D}
[data-theme="dark"] .rt-table tr:nth-child(even) td{background:#1C2128}
/* ── Resolution calculator ───────────────────────────────────────────────────── */
.rc-section{padding:14px 18px;border-top:1px solid var(--border)}
.rc-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);margin-bottom:10px}
.rc-grid{display:flex;flex-direction:column;gap:8px}
.rc-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rc-fname{font-size:12px;font-weight:600;color:var(--text);min-width:140px;flex-shrink:0}
.rc-input{width:90px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:'Courier New',monospace;font-size:12px;outline:none}
.rc-input:focus{border-color:var(--fast)}
.rc-eq{font-size:12px;color:var(--text2);white-space:nowrap}
.rc-result{font-size:12px;font-weight:600;color:var(--fast);font-family:'Courier New',monospace;min-width:70px}
/* ── Diff modal ──────────────────────────────────────────────────────────────── */
.diff-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:500;display:none;align-items:center;justify-content:center}
.diff-overlay.open{display:flex}
.diff-modal{background:var(--card);border:1px solid var(--border);border-radius:12px;width:min(900px,95vw);max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.diff-hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)}
.diff-title{font-size:15px;font-weight:700;color:var(--text)}
.diff-close{background:none;border:none;font-size:20px;cursor:pointer;color:var(--text2);line-height:1;padding:2px 6px}
.diff-close:hover{color:var(--text)}
.diff-sel{display:flex;gap:12px;padding:14px 20px;border-bottom:1px solid var(--border);align-items:center;flex-wrap:wrap}
.diff-pgn-sel{flex:1;min-width:180px;padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none}
.diff-run{padding:7px 16px;background:var(--fast);border:none;border-radius:6px;color:#fff;font-size:13px;font-weight:700;cursor:pointer}
.diff-run:hover{opacity:.9}
.diff-body{overflow-y:auto;padding:16px 20px;flex:1}
.diff-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.diff-col-hdr{font-size:13px;font-weight:700;color:var(--text);padding:8px 12px;background:var(--bg);border-radius:6px;border:1px solid var(--border);text-align:center}
.diff-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px}
.diff-row:last-child{border-bottom:none}
.diff-cell{padding:4px 8px;border-radius:4px;word-break:break-word}
.diff-same{color:var(--text2)}
.diff-add{background:rgba(16,185,129,.12);color:#059669;border:1px solid rgba(16,185,129,.2)}
.diff-rem{background:rgba(239,68,68,.1);color:#DC2626;border:1px solid rgba(239,68,68,.15)}
.diff-chg{background:rgba(245,158,11,.1);color:#D97706;border:1px solid rgba(245,158,11,.2)}
[data-theme="dark"] .diff-add{background:rgba(52,211,153,.1);color:#34D399;border-color:rgba(52,211,153,.2)}
[data-theme="dark"] .diff-rem{background:rgba(248,113,113,.1);color:#F87171;border-color:rgba(248,113,113,.2)}
[data-theme="dark"] .diff-chg{background:rgba(251,191,36,.1);color:#FCD34D;border-color:rgba(251,191,36,.2)}
/* ── Byte/bit inspector ──────────────────────────────────────────────────────── */
.hd-dump{position:relative}
.hd-byte{cursor:pointer;border-radius:2px;padding:0 1px;transition:background .1s}
.hd-byte:hover,.hd-byte.bi-active{background:rgba(59,130,246,.18);outline:1px solid rgba(59,130,246,.45)}
.bi-popup{position:fixed;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px;box-shadow:0 8px 32px rgba(0,0,0,.45);z-index:9999;display:none;min-width:220px;pointer-events:none}
.bi-popup.open{display:block}
.bi-title{font-size:10.5px;font-weight:700;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.3px}
.bi-bits{display:flex;gap:2px;margin-bottom:8px}
.bi-bit{width:22px;height:32px;border-radius:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Courier New',monospace;border:1px solid var(--border)}
.bi-bit-val{font-size:12px;font-weight:800;line-height:1;color:var(--text)}
.bi-bit-idx{font-size:8px;opacity:.5;color:var(--text2)}
.bi-field{font-size:11.5px;color:var(--text);margin-top:6px;padding-top:6px;border-top:1px solid var(--border)}
`;

// ── JS app ─────────────────────────────────────────────────────────────────────
// Note: inner template literals are escaped as \` and \${ for embedding
const JS = `
const DATA = ${DATA};

// pre-computed lookup → [pgn, ...] usage map
const LUT_USAGE=(function(){
  const u={};
  for(const g of DATA.groups){for(const d of g.defs){for(const f of d.fields){
    if(f.lk){if(!u[f.lk])u[f.lk]=[];if(u[f.lk].indexOf(g.pgn)<0)u[f.lk].push(g.pgn);}
    if(f.blk){if(!u[f.blk])u[f.blk]=[];if(u[f.blk].indexOf(g.pgn)<0)u[f.blk].push(g.pgn);}
  }}}
  return u;
})();

// ── localStorage helpers ───────────────────────────────────────────────────────
function getRecent(){try{return JSON.parse(localStorage.getItem('nmea-recent')||'[]')}catch(e){return[]}}
function addRecent(pgn){
  const desc=(DATA.groups.find(g=>g.pgn===pgn)||{defs:[{desc:''}]}).defs[0].desc;
  const r=getRecent().filter(x=>x.p!==pgn);
  r.unshift({p:pgn,d:desc});
  localStorage.setItem('nmea-recent',JSON.stringify(r.slice(0,10)));
}
function getBookmarks(){try{return JSON.parse(localStorage.getItem('nmea-bm')||'[]')}catch(e){return[]}}
function toggleBookmark(pgn,btn){
  const bm=getBookmarks();const idx=bm.indexOf(pgn);
  if(idx>=0)bm.splice(idx,1);else bm.unshift(pgn);
  localStorage.setItem('nmea-bm',JSON.stringify(bm));
  if(btn){btn.textContent=bm.indexOf(pgn)>=0?'★':'☆';btn.classList.toggle('active',bm.indexOf(pgn)>=0);}
  renderSidebar();
}
function sharePgn(btn){
  navigator.clipboard?.writeText(location.href).then(()=>{
    btn.textContent='Copied!';setTimeout(()=>btn.textContent='Share',1500);
  });
}
function toggleSbSec(hdr){
  const body=hdr.nextElementSibling;
  body.style.display=body.style.display==='none'?'':'none';
}
function clearBookmarks(){localStorage.removeItem('nmea-bm');renderSidebar();}
function clearRecent(){localStorage.removeItem('nmea-recent');renderSidebar();}

// ── Helpers ────────────────────────────────────────────────────────────────────
function esc(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function pad6(n){return String(n).padStart(6,'0')}
function fmtRes(r){
  if(r==null)return '';
  if(r>=1)return String(r);
  if(r<0.00001)return r.toExponential(2);
  return parseFloat(r.toPrecision(4)).toString();
}
function fmtMs(ms){
  if(ms==null)return null;
  if(ms===0)return'On change';
  if(ms>=60000)return(ms/60000).toFixed(1)+' min';
  if(ms>=1000)return(ms/1000)+' s';
  return ms+' ms';
}

const TYPE_COLOR={
  LOOKUP:'#1D4ED8',INDIRECT_LOOKUP:'#1D4ED8',BITLOOKUP:'#0369A1',
  NUMBER:'#047857',FLOAT:'#059669',DECIMAL:'#059669',
  BINARY:'#4B5563',RESERVED:'#9CA3AF',SPARE:'#9CA3AF',
  DATE:'#7C3AED',TIME:'#6D28D9',DURATION:'#7C3AED',
  STRING_FIX:'#B45309',STRING_LAU:'#B45309',STRING_LZ:'#92400E',
  MMSI:'#BE185D',PGN:'#1B3A5C',ISO_NAME:'#C05621',
  FIELD_INDEX:'#374151',DYNAMIC_FIELD_KEY:'#6B21A8',
  DYNAMIC_FIELD_VALUE:'#6B21A8',DYNAMIC_FIELD_LENGTH:'#6B21A8',VARIABLE:'#374151',
};

function typeBadge(ft){
  const c=TYPE_COLOR[ft]||'#374151';
  return '<span class="tb" style="background:'+c+'">'+esc(ft)+'</span>';
}

// ── PGN category ───────────────────────────────────────────────────────────────
const CATS=['Network & Addressing','Proprietary','Commands & Control','NMEA General','Vessel Systems','Fluid & Environment','Navigation & GPS','Helm, AIS & Weather'];
function pgnCat(pgn){
  if(pgn<61184) return CATS[0];
  if(pgn<65536) return CATS[1];
  if(pgn<126976) return CATS[2];
  if(pgn<127232) return CATS[3];
  if(pgn<128000) return CATS[4];
  if(pgn<129000) return CATS[5];
  if(pgn<130000) return CATS[6];
  if(pgn<131000) return CATS[7];
  return CATS[1];
}

// ── State ──────────────────────────────────────────────────────────────────────
const S={search:'',typeFilter:'all',completeFilter:'all',catFilter:'',pqFilter:'',pgn:null,variant:0};

function filtered(){
  let g=DATA.groups;
  const q=S.search.trim().toLowerCase();
  if(q){
    g=g.filter(gr=>{
      const num=String(gr.pgn);
      return num.includes(q)||gr.defs.some(d=>
        d.desc.toLowerCase().includes(q)||d.id.toLowerCase().includes(q)||
        d.fields.some(f=>
          f.nm.toLowerCase().includes(q)||
          (f.d&&f.d.toLowerCase().includes(q))||
          (f.pq&&f.pq.toLowerCase().replace(/_/g,' ').includes(q))||
          (f.u&&f.u.toLowerCase().includes(q))
        )
      );
    });
  }
  if(S.typeFilter!=='all'){
    const tf=S.typeFilter;
    g=g.filter(gr=>gr.defs.some(d=>d.type.toLowerCase()===tf));
  }
  if(S.completeFilter==='complete') g=g.filter(gr=>gr.defs.every(d=>d.complete));
  if(S.completeFilter==='incomplete') g=g.filter(gr=>gr.defs.some(d=>!d.complete));
  if(S.catFilter) g=g.filter(gr=>pgnCat(gr.pgn)===S.catFilter);
  if(S.pqFilter) g=g.filter(gr=>gr.defs.some(d=>d.fields.some(f=>f.pq===S.pqFilter)));
  return g;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function qualityLevel(gr){
  const allComplete=gr.defs.every(d=>d.complete);
  const anyComplete=gr.defs.some(d=>d.complete);
  const hasMissing=gr.defs.some(d=>d.missing&&d.missing.length>0);
  if(allComplete&&!hasMissing) return 'ok';
  if(anyComplete||allComplete) return 'partial';
  return 'stub';
}
function pgnItem(pgn,name,active,large){
  if(large){
    const gr=DATA.groups.find(g=>g.pgn===pgn)||{defs:[{type:'Single',desc:name}]};
    const t=gr.defs[0].type;
    const typeCls=t==='Fast'?'fast':'single';
    const ql=qualityLevel(gr);
    return '<div class="pi'+(active?' active':'')+'" onclick="selectPgn('+pgn+')" data-pgn="'+pgn+'">'+
      '<span class="pi-num">'+pad6(pgn)+'</span>'+
      '<div class="pi-info"><div class="pi-name">'+esc(name)+'</div></div>'+
      '<span class="pi-cat" title="'+esc(pgnCat(pgn))+'">'+esc(pgnCat(pgn).split(' ')[0])+'</span>'+
      '<span class="pi-type '+typeCls+'">'+t[0]+'</span>'+
      (gr.defs.length>1?'<span class="pi-multi">'+gr.defs.length+'</span>':'')+
      '<span class="qi-dot qi-'+ql+'" title="'+(ql==='ok'?'Complete':'ql'==='partial'?'Partial':'Stub')+'"></span>'+
    '</div>';
  }
  return '<div class="pi-sm'+(active?' active':'')+'" onclick="selectPgn('+pgn+')" data-pgn="'+pgn+'">'+
    '<span class="pi-sm-num">'+pad6(pgn)+'</span>'+
    '<span class="pi-sm-name">'+esc(name)+'</span>'+
  '</div>';
}
function renderSidebar(){
  const groups=filtered();
  document.getElementById('sb-count').textContent=groups.length+' / '+DATA.groups.length;

  const bms=getBookmarks();
  const recent=getRecent();
  let extra='';

  if(bms.length){
    const items=bms.map(pgn=>{
      const gr=DATA.groups.find(g=>g.pgn===pgn);
      const name=gr?gr.defs[0].desc:'PGN '+pgn;
      return pgnItem(pgn,'★ '+name,pgn===S.pgn,false);
    }).join('');
    extra+='<div class="sb-section">'+
      '<div class="sb-sec-hdr" onclick="toggleSbSec(this)">'+
        '<span class="sb-sec-title">Pinned ('+bms.length+')</span>'+
        '<span class="sb-sec-right"><span class="sb-sec-clr" onclick="event.stopPropagation();clearBookmarks()">clear</span></span>'+
      '</div>'+
      '<div>'+items+'</div>'+
    '</div>';
  }

  if(recent.length){
    const items=recent.map(r=>pgnItem(r.p,r.d,r.p===S.pgn,false)).join('');
    extra+='<div class="sb-section">'+
      '<div class="sb-sec-hdr" onclick="toggleSbSec(this)">'+
        '<span class="sb-sec-title">Recent ('+recent.length+')</span>'+
        '<span class="sb-sec-right"><span class="sb-sec-clr" onclick="event.stopPropagation();clearRecent()">clear</span></span>'+
      '</div>'+
      '<div>'+items+'</div>'+
    '</div>';
  }

  const mainHtml=groups.map(g=>{
    const active=g.pgn===S.pgn;
    const t=g.defs[0].type;
    const typeCls=t==='Fast'?'fast':'single';
    const ql=qualityLevel(g);
    return '<div class="pi'+(active?' active':'')+'" onclick="selectPgn('+g.pgn+')" data-pgn="'+g.pgn+'">'+
      '<span class="pi-num">'+pad6(g.pgn)+'</span>'+
      '<div class="pi-info"><div class="pi-name">'+esc(g.defs[0].desc)+'</div></div>'+
      '<span class="pi-cat" title="'+esc(pgnCat(g.pgn))+'">'+esc(pgnCat(g.pgn).split(' ')[0])+'</span>'+
      '<span class="pi-type '+typeCls+'">'+t[0]+'</span>'+
      (g.defs.length>1?'<span class="pi-multi">'+g.defs.length+'</span>':'')+
      '<span class="qi-dot qi-'+ql+'"></span>'+
    '</div>';
  }).join('');

  document.getElementById('sb-list').innerHTML=extra+(mainHtml||'<div class="sb-empty">No PGNs match your search</div>');
}

// ── Select PGN ─────────────────────────────────────────────────────────────────
function selectPgn(pgn,pushState){
  if(pushState===undefined)pushState=true;
  S.pgn=pgn; S.variant=0;
  addRecent(pgn);
  if(pushState) history.pushState(null,'','#pgn-'+pgn);
  renderSidebar();
  renderDetail();
  // scroll active item into view
  const el=document.querySelector('.pi.active');
  if(el)el.scrollIntoView({block:'nearest',behavior:'smooth'});
  // scroll content to top
  document.querySelector('.content').scrollTop=0;
}

function selectVariant(i){
  S.variant=i;
  document.querySelectorAll('.variant-tab').forEach((t,ti)=>t.classList.toggle('active',ti===i));
  document.querySelectorAll('.var-panel').forEach((p,pi)=>p.style.display=pi===i?'':'none');
}

// ── Copy helper ────────────────────────────────────────────────────────────────
function copyPgn(pgn,btn){
  navigator.clipboard?.writeText(String(pgn)).then(()=>{
    btn.classList.add('copied');
    btn.textContent='Copied!';
    setTimeout(()=>{btn.classList.remove('copied');btn.textContent='Copy PGN';},1500);
  });
}

// ── Welcome page ───────────────────────────────────────────────────────────────
function renderWelcome(){
  const g=DATA.groups;
  const fast=g.filter(gr=>gr.defs[0].type==='Fast').length;
  const single=g.filter(gr=>gr.defs[0].type==='Single').length;
  const complete=g.reduce((a,gr)=>a+gr.defs.filter(d=>d.complete).length,0);
  const totalDefs=g.reduce((a,gr)=>a+gr.defs.length,0);

  const legendItems=[
    ['LOOKUP','#1D4ED8'],['BITLOOKUP','#0369A1'],
    ['NUMBER','#047857'],['FLOAT','#059669'],
    ['STRING_FIX','#B45309'],['BINARY','#4B5563'],
    ['DATE','#7C3AED'],['TIME','#6D28D9'],
    ['MMSI','#BE185D'],['PGN','#1B3A5C'],
    ['RESERVED','#9CA3AF'],['SPARE','#9CA3AF'],
  ].map(([t,c])=>'<div class="legend-item"><span class="tb" style="background:'+c+'">'+t+'</span></div>').join('');

  document.getElementById('detail').innerHTML='<div class="welcome fade-in">'+
    '<div class="wlc-hero">'+
      '<div class="wlc-eyebrow">NMEA 2000® Technical Reference</div>'+
      '<div class="wlc-title">Parameter Group Numbers</div>'+
      '<div class="wlc-sub">Complete specifications for all PGNs defined in the canboat open-source database.'+
        '<br>Select a PGN from the sidebar or use the search to get started.</div>'+
    '</div>'+
    '<div class="wlc-stats">'+
      '<div class="stat-c"><div class="stat-n">'+g.length+'</div><div class="stat-l">PGN Groups</div></div>'+
      '<div class="stat-c"><div class="stat-n">'+totalDefs+'</div><div class="stat-l">Total Definitions</div></div>'+
      '<div class="stat-c"><div class="stat-n">'+fast+'</div><div class="stat-l">Fast-Packet</div></div>'+
      '<div class="stat-c"><div class="stat-n">'+complete+'</div><div class="stat-l">Complete Defs</div></div>'+
    '</div>'+
    '<div class="wlc-legend">'+
      '<div class="wlc-legend-title">Field Type Legend</div>'+
      '<div class="legend-grid">'+legendItems+'</div>'+
    '</div>'+
    renderCatStats()+
    renderEnumBrowser()+
  '</div>';
}

// ── Render field row ───────────────────────────────────────────────────────────
function fieldRow(f,i,bitOffset){
  const isDim=['RESERVED','SPARE'].includes(f.ft);
  const cls=isDim?'dim':(i%2===0?'ev':'od');
  const bitLen=f.b||0;
  const bits=f.bv?(f.b||'?')+'*':String(f.b||'?');
  const range=(f.mn!=null&&f.mx!=null)?(f.mn+' – '+f.mx):'';
  const res=fmtRes(f.r);

  const startByte=bitOffset!=null?Math.floor(bitOffset/8):null;
  const endByte=bitOffset!=null&&bitLen?Math.floor((bitOffset+bitLen-1)/8):null;
  const crossByte=startByte!=null&&endByte!=null&&endByte>startByte;
  const offLabel=bitOffset!=null?'<span class="fc-boff">+'+bitOffset+'b / B'+startByte+'</span>':'';

  const notes=[];
  if(crossByte) notes.push('<span class="tag tag-cross">⚡ cross-byte</span>');
  if(f.sg) notes.push('<span class="tag tag-signed">signed</span>');
  if(f.key) notes.push('<span class="tag tag-key">⚷ key</span>');
  if(f.pq) notes.push('<span class="tag tag-pq">'+esc(f.pq.toLowerCase().replace(/_/g,' '))+'</span>');
  if(f.ft==='PGN') notes.push('<span class="tag tag-pgnref">↗ PGN ref</span>');
  if(f.lk)  notes.push('<span class="tag tag-lk">↗ '+esc(f.lk)+'</span>');
  if(f.blk) notes.push('<span class="tag tag-blk">⚑ '+esc(f.blk)+'</span>');
  if(f.c)   notes.push('<span class="tag tag-cond">if '+esc(f.c)+'</span>');
  if(f.m!=null) notes.push('<span class="tag tag-signed">match='+esc(f.m)+'</span>');
  if(!f.d&&!isDim) notes.push('<span class="tag tag-undoc">undocumented</span>');

  const descHtml=f.d?'<small>'+esc(f.d)+'</small>':'';

  return '<tr class="fr '+cls+'" data-fi="'+i+'">'+
    '<td class="fc-n">'+(f.n||i+1)+'</td>'+
    '<td class="fc-nm">'+esc(f.nm)+descHtml+offLabel+'</td>'+
    '<td class="fc-tp">'+typeBadge(f.ft)+'</td>'+
    '<td class="fc-b">'+esc(bits)+'</td>'+
    '<td class="fc-u">'+esc(f.u||'')+'</td>'+
    '<td class="fc-r">'+esc(res)+'</td>'+
    '<td class="fc-rng">'+esc(range)+'</td>'+
    '<td class="fc-notes"><div class="notes-wrap">'+notes.join('')+'</div></td>'+
  '</tr>';
}

// ── Render lookup tables ───────────────────────────────────────────────────────
function lutCard(name,vals,isBit){
  const displayRows=vals.slice(0,30).map(([v,n])=>'<div class="lut-row"><span class="lv">'+esc(v)+'</span><span class="ln">'+esc(n)+'</span></div>').join('');
  const usage=LUT_USAGE[name]||[];
  const sharedHtml=usage.length>1?'<div class="lut-shared">Shared by <strong>'+(usage.length)+'</strong> PGN'+(usage.length>1?'s':'')+'</div>':'';
  return '<div class="lut">'+
    '<div class="lut-hdr"><span class="lut-hdr-name">'+esc(name)+'</span><span class="lut-hdr-type">'+(isBit?'bit flags':'enum')+'</span></div>'+
    '<div class="lut-body">'+displayRows+'</div>'+
    (vals.length>30?'<div class="lut-overflow">… '+vals.length+' values total</div>':'')+
    sharedHtml+
  '</div>';
}

// ── Render one definition block ────────────────────────────────────────────────
function renderDefBlock(d,pgn){
  const metaItems=[
    pill('Type',d.type,d.type==='Fast'?'pv-fast':'pv-single'),
    d.prio!=null?pill('Priority',d.prio):'',
    d.len!=null?pill('Length',d.len+' B'):'',
    d.minLen!=null?pill('Min Len',d.minLen+' B'):'',
    fmtMs(d.ms)?pill('Interval',fmtMs(d.ms)):'',
    d.irr?pill('Interval','Irregular','pv-inc'):'',
    pill('Status',d.complete?'Complete':'Incomplete',d.complete?'pv-ok':'pv-inc'),
    d.fallback?pill('Role','Fallback','pv-fb'):'',
  ].filter(Boolean).join('');

  // collect lookups needed
  const usedLk=new Set(), usedBlk=new Set();
  for(const f of d.fields||[]){
    if(f.lk) usedLk.add(f.lk);
    if(f.blk) usedBlk.add(f.blk);
  }

  const lookupHtml=[
    ...[...usedLk].map(n=>DATA.lookups[n]?lutCard(n,DATA.lookups[n],false):''),
    ...[...usedBlk].map(n=>DATA.bitLookups[n]?lutCard(n,DATA.bitLookups[n],true):''),
  ].filter(Boolean).join('');

  const fields=d.fields||[];
  // bit budget check
  const actualBits=fields.reduce((s,f)=>s+(f.b||0),0);
  const declaredBits=d.len!=null?d.len*8:null;
  const budgetWarn=declaredBits!=null&&actualBits!==declaredBits?
    '<div class="budget-warn">⚠ Bit budget mismatch: fields sum to '+actualBits+'b but declared length is '+declaredBits+'b ('+Math.abs(actualBits-declaredBits)+'b '+(actualBits>declaredBits?'over':'under')+')</div>':'';
  // compute cumulative bit offsets for each field
  let _off=0;
  const bitOffsets=fields.map(f=>{const o=_off;_off+=f.b||0;return o;});
  let tableHtml='';
  if(fields.length){
    tableHtml='<div class="fields-wrap">'+
      '<div class="ft-title">Fields <span class="ft-count">'+fields.length+'</span></div>'+
      '<table class="ft">'+
      '<thead><tr>'+
        '<th class="fc-n">#</th>'+
        '<th class="fc-nm">Field Name</th>'+
        '<th class="fc-tp">Type</th>'+
        '<th class="fc-b">Bits</th>'+
        '<th class="fc-u">Unit</th>'+
        '<th class="fc-r">Resolution</th>'+
        '<th class="fc-rng">Range</th>'+
        '<th class="fc-notes">Attributes</th>'+
      '</tr></thead>'+
      '<tbody>'+fields.map((f,i)=>fieldRow(f,i,bitOffsets[i])).join('')+'</tbody>'+
      '</table>'+
    '</div>';
  } else {
    tableHtml='<div class="no-fields">No field definitions available for this variant.</div>';
  }

  let repeatHtml='';
  if(d.rep1||d.rep2){
    repeatHtml='<div class="repeat-box">';
    if(d.rep1) repeatHtml+='<div class="repeat-row"><span class="ri-icon">↻</span><span><strong>Repeating Set 1:</strong> '+d.rep1[0]+' fields, starting at field '+d.rep1[1]+', count from field '+d.rep1[2]+'</span></div>';
    if(d.rep2) repeatHtml+='<div class="repeat-row"><span class="ri-icon">↻</span><span><strong>Repeating Set 2:</strong> '+d.rep2[0]+' fields, starting at field '+d.rep2[1]+', count from field '+d.rep2[2]+'</span></div>';
    repeatHtml+='</div>';
  }

  return '<div class="def-card">'+
    '<div class="meta-row">'+metaItems+'</div>'+
    budgetWarn+
    (d.expl?'<div class="expl-block"><p class="expl-text">'+esc(d.expl)+'</p></div>':'')+
    (d.url?'<div class="ref-row"><span class="ref-lbl">Reference</span>'+esc(d.url)+'</div>':'')+
    (d.missing&&d.missing.length?'<div class="miss-row">⚠ Missing: '+d.missing.map(esc).join(', ')+'</div>':'')+
    tableHtml+
    repeatHtml+
    (lookupHtml?'<div class="lut-section"><div class="lut-grid">'+lookupHtml+'</div></div>':'')+
    renderFastPacket(d)+
    renderCanFrame(pgn,d)+
    renderBitLayout(d)+
    renderSampleOutput(d,pgn)+
    renderHexDump(d)+
    renderRoundTrip(d)+
    renderResCalc(d)+
    renderRelatedPgns(d,pgn)+
  '</div>';
}

function pill(label,val,valCls){
  return '<div class="pill">'+
    '<span class="pl">'+esc(label)+'</span>'+
    '<span class="pv'+(valCls?' '+valCls:'')+'">'+esc(val)+'</span>'+
  '</div>';
}

// ── Fast-packet frame diagram ──────────────────────────────────────────────────
function renderFastPacket(d){
  if(d.type!=='Fast') return '';
  const payloadLen=d.len||0;
  const nFrames=payloadLen<=6?1:Math.ceil((payloadLen-6)/7)+1;
  const rows=[];
  for(let i=0;i<nFrames;i++){
    const startByte=i===0?0:6+(i-1)*7;
    const endByte=i===0?Math.min(5,payloadLen-1):Math.min(startByte+6,payloadLen-1);
    const dataBytes=endByte-startByte+1;
    const padBytes=i===0?0:7-dataBytes;
    const cells=[
      '<div class="fp-cell fp-hdr" title="'+(i===0?'Sequence counter (3b) | Total frames (5b)':'Sequence counter (3b) | Frame # (5b)')+'">'+(i===0?'SEQ|CNT':'SEQ|'+(i))+'</div>',
      i===0?'<div class="fp-cell fp-len" title="Total payload length">LEN='+payloadLen+'</div>':'',
      '<div class="fp-cell fp-data" title="Payload bytes '+startByte+'–'+endByte+'">B'+startByte+(dataBytes>1?'–'+endByte:'')+'</div>',
      padBytes>0?'<div class="fp-cell fp-data pad" style="flex:'+padBytes+'" title="Unused bytes">pad</div>':'',
    ].filter(Boolean).join('');
    rows.push('<div class="fp-frame">'+cells+'</div>');
  }
  return '<div class="fp-section">'+
    '<div class="fp-title">Fast-Packet Frames<span class="fp-tag">'+nFrames+' CAN frame'+(nFrames>1?'s':'')+'</span></div>'+
    '<div class="fp-frames">'+rows.join('')+'</div>'+
    '<div class="fp-info">'+
      '<span class="fp-li">'+payloadLen+' byte payload</span>'+
      '<span class="fp-li">Frame 0: 1b seq + 1b len header + 6b data</span>'+
      '<span class="fp-li">Frames 1–'+(nFrames-1)+': 1b seq header + 7b data</span>'+
      '<span class="fp-li">8 bytes per CAN frame</span>'+
    '</div>'+
  '</div>';
}

// ── Hex wire format dump ───────────────────────────────────────────────────────
function setBits(bytes,bitOffset,bitLen,value){
  let v=Math.floor(value)>>>0;
  for(let i=0;i<bitLen;i++){
    const byteIdx=Math.floor((bitOffset+i)/8);
    const bitIdx=(bitOffset+i)%8;
    if(byteIdx<bytes.length){
      if(v&(1<<i)) bytes[byteIdx]|=(1<<bitIdx);
      else bytes[byteIdx]&=~(1<<bitIdx);
    }
  }
}
function buildFrameBytes(d){
  const len=d.len||Math.ceil((d.fields||[]).reduce((s,f)=>s+(f.b||0),0)/8)||0;
  if(!len) return [];
  const bytes=new Array(len).fill(0);
  let offset=0;
  for(const f of (d.fields||[])){
    const bits=f.b||0;
    if(!['RESERVED','SPARE'].includes(f.ft)){
      const sv=sampleVal(f);
      if(sv&&sv.t==='n'&&bits<=32){
        const encoded=Math.max(0,Math.round(sv.v/(f.r||1)));
        setBits(bytes,offset,Math.min(bits,32),encoded);
      } else if(sv&&sv.t==='s'){
        for(let ci=0;ci<sv.v.length&&ci*8<bits;ci++){
          setBits(bytes,offset+ci*8,8,sv.v.charCodeAt(ci));
        }
      }
    }
    offset+=bits;
  }
  return bytes;
}
function renderHexDump(d){
  if(!(d.fields||[]).length) return '';
  const bytes=buildFrameBytes(d);
  if(!bytes.length) return '';
  // build per-byte field ownership
  const owns=[];
  let offset=0;
  for(let fi=0;fi<d.fields.length;fi++){
    const f=d.fields[fi];
    const bits=f.b||0;
    const c=TYPE_COLOR[f.ft]||'#374151';
    const startB=Math.floor(offset/8);
    const endB=bits?Math.floor((offset+bits-1)/8):startB;
    for(let b=startB;b<=endB&&b<bytes.length;b++) owns[b]={color:c,name:f.nm,ft:f.ft};
    offset+=bits;
  }
  const COLS=8;let rows='';
  for(let r=0;r<bytes.length;r+=COLS){
    const slice=bytes.slice(r,r+COLS);
    const offStr='0x'+r.toString(16).toUpperCase().padStart(2,'0');
    const hexCells=slice.map((b,i)=>{
      const o=owns[r+i]||{};
      const h=b.toString(16).toUpperCase().padStart(2,'0');
      const style=o.color?'color:'+o.color+';font-weight:700':'';
      return '<span class="hd-byte" data-bi="'+(r+i)+'" style="'+style+'" title="'+esc(o.name||'')+'">'+h+'</span>';
    }).join('');
    const pad=COLS-slice.length;
    const ascCells=slice.map(b=>{const ch=b>=32&&b<127?String.fromCharCode(b):'.';return esc(ch);}).join('');
    rows+='<div class="hd-row">'+
      '<span class="hd-off">'+offStr+'</span>'+
      '<span class="hd-hex">'+hexCells+(pad?'<span style="opacity:.2">'+' &nbsp;&nbsp;'.repeat(pad)+'</span>':'')+'</span>'+
      '<span class="hd-sep">|</span>'+
      '<span class="hd-asc">'+ascCells+'</span>'+
    '</div>';
  }
  // legend: unique field types used (skip RESERVED/SPARE)
  const seen=new Set();
  const legItems=d.fields.filter(f=>!['RESERVED','SPARE'].includes(f.ft)&&!seen.has(f.ft)&&seen.add(f.ft))
    .map(f=>'<span class="hd-li"><span class="hd-ldot" style="background:'+(TYPE_COLOR[f.ft]||'#374151')+'"></span>'+esc(f.ft)+'</span>').join('');
  return '<div class="hd-section">'+
    '<div class="hd-title">Hex Wire Format<span class="hd-note">'+bytes.length+' bytes · LE bits · click byte for bit inspector</span></div>'+
    '<div class="hd-dump">'+rows+'</div>'+
    (legItems?'<div class="hd-leg">'+legItems+'</div>':'')+
  '</div>';
}

// ── Category completion stats ──────────────────────────────────────────────────
function renderCatStats(){
  const catData={};
  for(const g of DATA.groups){
    const cat=pgnCat(g.pgn);
    if(!catData[cat]) catData[cat]={total:0,complete:0};
    for(const d of g.defs){catData[cat].total++;if(d.complete)catData[cat].complete++;}
  }
  const rows=CATS.filter(c=>catData[c]).map(c=>{
    const {total,complete}=catData[c];
    const pct=total?Math.round(complete/total*100):0;
    return '<div class="cs-row">'+
      '<span class="cs-name">'+esc(c)+'</span>'+
      '<div class="cs-bar-wrap"><div class="cs-bar" style="width:'+pct+'%"></div></div>'+
      '<span class="cs-pct">'+pct+'%</span>'+
      '<span class="cs-count">'+complete+'/'+total+'</span>'+
    '</div>';
  }).join('');
  return '<div class="cs-section">'+
    '<div class="cs-title">Completeness by Category</div>'+rows+'</div>';
}

// ── Device class ───────────────────────────────────────────────────────────────
function renderDeviceClass(pgn,d){
  const desc=(((d&&d.desc)||'')+' '+((d&&d.fields||[]).map(f=>f.nm+' '+(f.d||'')).join(' '))).toLowerCase();
  const classes=[];
  if(/engine|rpm|oil pressure|fuel rate/.test(desc)) classes.push('Engine/Drive');
  if(/ais|mmsi|vessel name|call sign|class b/.test(desc)) classes.push('AIS/VHF');
  if(/gps|gnss|satellite|latitude|longitude|geoid/.test(desc)) classes.push('GPS');
  if(/heading|course over ground|speed over ground|sog|cog|speed water/.test(desc)) classes.push('Navigation');
  if(/depth|sounder|bottom/.test(desc)) classes.push('Sonar/Depth');
  if(/wind speed|wind angle|barometric|outside temperature|atmospheric/.test(desc)) classes.push('Environmental');
  if(/rudder|helm|steering|rate of turn/.test(desc)) classes.push('Helm');
  if(/tank level|fluid level/.test(desc)) classes.push('Tank Monitor');
  if(/battery|charger|inverter|ac input|dc source|alternator/.test(desc)) classes.push('Electrical');
  if(/autopilot|pilot mode/.test(desc)) classes.push('Autopilot');
  if(/transmission|drive|gear ratio/.test(desc)) classes.push('Drive System');
  if(/address claim|iso|heartbeat|pgn list|network|commanded/.test(desc)) classes.push('Network Mgmt');
  if(!classes.length) return '';
  return '<div class="dc-section">'+
    '<div class="dc-row">'+
      '<span class="dc-label">Device Class</span>'+
      classes.map(c=>'<span class="dc-chip">'+esc(c)+'</span>').join('')+
    '</div>'+
  '</div>';
}

// ── Related PGNs ───────────────────────────────────────────────────────────────
function renderRelatedPgns(d,pgn){
  const myPqs=[...new Set((d.fields||[]).map(f=>f.pq).filter(Boolean))];
  if(!myPqs.length) return '';
  const related=[];
  for(const g of DATA.groups){
    if(g.pgn===pgn) continue;
    const shared=myPqs.filter(pq=>g.defs.some(def=>def.fields.some(f=>f.pq===pq)));
    if(shared.length) related.push({g,shared});
  }
  if(!related.length) return '';
  related.sort((a,b)=>b.shared.length-a.shared.length);
  const chips=related.slice(0,12).map(({g,shared})=>
    '<div class="rel-chip" onclick="selectPgn('+g.pgn+')" title="'+esc(g.defs[0].desc)+' — shared: '+esc(shared.map(p=>p.replace(/_/g,' ').toLowerCase()).join(', '))+'">'+
      '<span class="rel-num">'+pad6(g.pgn)+'</span>'+
      '<span>'+esc(g.defs[0].desc.length>28?g.defs[0].desc.slice(0,27)+'…':g.defs[0].desc)+'</span>'+
    '</div>'
  ).join('');
  return '<div class="rel-section">'+
    '<div class="rel-title">Related PGNs <span style="font-weight:400;text-transform:none;font-size:10.5px">(share physical quantities)</span></div>'+
    '<div class="rel-grid">'+chips+'</div>'+
  '</div>';
}

// ── Bit extraction helper ──────────────────────────────────────────────────────
function extractBits(bytes,bitOffset,bitLen,signed){
  if(bitLen<=0||bitLen>32) return null;
  let v=0;
  for(let i=0;i<bitLen;i++){
    const bIdx=Math.floor((bitOffset+i)/8);
    const bitIdx=(bitOffset+i)%8;
    if(bIdx<bytes.length&&(bytes[bIdx]>>bitIdx)&1) v|=(1<<i);
  }
  v=v>>>0;
  if(signed&&bitLen<32&&(v>>(bitLen-1))&1){v=v|(0xFFFFFFFF<<bitLen);v=v|0;}
  return v;
}

// ── Round-trip decoder ─────────────────────────────────────────────────────────
function renderRoundTrip(d){
  const fields=d.fields||[];
  if(!fields.length) return '';
  const bytes=buildFrameBytes(d);
  if(!bytes.length) return '';
  let offset=0;
  const rows=fields.map(f=>{
    const bits=f.b||0;
    const raw=bits>0&&bits<=32?extractBits(bytes,offset,bits,f.sg):null;
    offset+=bits;
    if(['RESERVED','SPARE'].includes(f.ft)) return null;
    const rawStr=raw!=null?'0x'+((raw>>>0).toString(16).toUpperCase().padStart(Math.max(1,Math.ceil(bits/4)),'0'))+' ('+raw+')':'—';
    let valStr='—',unitStr='';
    if(raw!=null&&f.r!=null&&f.r!==0&&['NUMBER','FLOAT','DECIMAL','DURATION'].includes(f.ft)){
      valStr=parseFloat((raw*f.r).toPrecision(6)).toString();
      unitStr=f.u||'';
    } else if(raw!=null&&f.ft==='LOOKUP'&&f.lk&&DATA.lookups[f.lk]){
      const rawN=raw>>>0;
      const entry=DATA.lookups[f.lk].find(([k])=>Number(k)===rawN||String(k)===String(rawN));
      valStr=entry?entry[1]:'enum#'+raw;
    } else if(raw!=null&&f.ft==='BITLOOKUP'&&f.blk&&DATA.bitLookups[f.blk]){
      const active=DATA.bitLookups[f.blk].filter(([k])=>raw&(1<<parseInt(k))).map(([,n])=>n);
      valStr=active.length?active.join('|'):'0x'+(raw>>>0).toString(16).toUpperCase();
    } else if(raw!=null&&f.ft==='DATE'){
      valStr='day '+raw+' (epoch 1970-01-01)';
    } else if(raw!=null&&f.ft==='TIME'){
      valStr=(raw/10000/3600).toFixed(3)+' hr';
    } else if(raw!=null){
      valStr=String(raw);
      unitStr=f.u||'';
    }
    return '<tr>'+
      '<td>'+esc(f.nm)+'</td>'+
      '<td class="rt-raw">'+esc(rawStr)+'</td>'+
      '<td><span class="rt-val">'+esc(valStr)+'</span>'+(unitStr?'<span class="rt-unit">'+esc(unitStr)+'</span>':'')+'</td>'+
    '</tr>';
  }).filter(Boolean).join('');
  if(!rows) return '';
  return '<div class="rt-section">'+
    '<div class="rt-title">Round-Trip Decoder</div>'+
    '<table class="rt-table">'+
      '<thead><tr><th>Field</th><th>Raw (hex / int)</th><th>Decoded Value</th></tr></thead>'+
      '<tbody>'+rows+'</tbody>'+
    '</table>'+
  '</div>';
}

// ── Resolution calculator ──────────────────────────────────────────────────────
function renderResCalc(d){
  const fields=(d.fields||[]).filter(f=>
    !['RESERVED','SPARE'].includes(f.ft)&&f.r!=null&&f.r!==0&&f.r!==1&&
    ['NUMBER','FLOAT','DECIMAL','DURATION'].includes(f.ft)
  );
  if(!fields.length) return '';
  const rows=fields.map((f,i)=>
    '<div class="rc-row">'+
      '<span class="rc-fname">'+esc(f.nm)+'</span>'+
      '<span class="rc-eq">raw:</span>'+
      '<input class="rc-input" type="number" placeholder="integer" oninput="rcCalc('+i+','+f.r+','+f.b+',1,this)">'+
      '<span class="rc-eq">&times;&nbsp;'+esc(fmtRes(f.r))+'&nbsp;=</span>'+
      '<span class="rc-result" id="rc-v-'+i+'">—</span>'+
      '<span class="rc-eq">'+esc(f.u||'')+'&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;eng:</span>'+
      '<input class="rc-input" type="number" placeholder="value" oninput="rcCalc('+i+','+f.r+','+f.b+',0,this)">'+
      '<span class="rc-eq">&rarr; raw:&nbsp;</span>'+
      '<span class="rc-result" id="rc-ri-'+i+'">—</span>'+
    '</div>'
  ).join('');
  return '<div class="rc-section">'+
    '<div class="rc-title">Resolution Calculator</div>'+
    '<div class="rc-grid">'+rows+'</div>'+
  '</div>';
}
function rcCalc(i,res,bits,fromRaw,inp){
  const v=parseFloat(inp.value);
  if(isNaN(v)){
    const el=document.getElementById(fromRaw?'rc-v-'+i:'rc-ri-'+i);
    if(el) el.textContent='—';
    return;
  }
  if(fromRaw){
    const el=document.getElementById('rc-v-'+i);
    if(el) el.textContent=parseFloat((v*res).toPrecision(6)).toString();
  } else {
    const raw=Math.round(v/res);
    const maxRaw=bits?(1<<Math.min(bits,30))-1:0xFFFFFF;
    const el=document.getElementById('rc-ri-'+i);
    if(el) el.textContent=Math.min(Math.max(0,raw),maxRaw).toString();
  }
}

// ── Diff two PGNs ──────────────────────────────────────────────────────────────
function openDiff(currentPgn){
  const overlay=document.getElementById('diff-overlay');
  if(!overlay) return;
  overlay.classList.add('open');
  const sel1=document.getElementById('diff-sel-a');
  const sel2=document.getElementById('diff-sel-b');
  const opts=DATA.groups.map(g=>'<option value="'+g.pgn+'"'+(g.pgn===currentPgn?' selected':'')+'>'+pad6(g.pgn)+' '+esc(g.defs[0].desc)+'</option>').join('');
  sel1.innerHTML=opts;
  sel2.innerHTML=opts;
  const idx=DATA.groups.findIndex(g=>g.pgn===currentPgn);
  if(idx<DATA.groups.length-1) sel2.value=DATA.groups[idx+1].pgn;
  document.getElementById('diff-body').innerHTML='<div style="color:var(--text2);text-align:center;padding:20px">Select two PGNs and click Compare</div>';
}
function closeDiff(){
  const overlay=document.getElementById('diff-overlay');
  if(overlay) overlay.classList.remove('open');
}
function runDiff(){
  const p1=parseInt(document.getElementById('diff-sel-a').value);
  const p2=parseInt(document.getElementById('diff-sel-b').value);
  if(!p1||!p2||p1===p2) return;
  const g1=DATA.groups.find(g=>g.pgn===p1);
  const g2=DATA.groups.find(g=>g.pgn===p2);
  if(!g1||!g2) return;
  const d1=g1.defs[0],d2=g2.defs[0];
  const f1=d1.fields||[],f2=d2.fields||[];
  const maxLen=Math.max(f1.length,f2.length);
  let rows='';
  for(let i=0;i<maxLen;i++){
    const fa=f1[i],fb=f2[i];
    const descA=fa?esc(fa.nm)+'<br><small>'+esc(fa.ft)+' '+(fa.b||'?')+'b'+(fa.r?' \xd7'+fa.r:'')+(fa.u?' '+fa.u:'')+'</small>':'';
    const descB=fb?esc(fb.nm)+'<br><small>'+esc(fb.ft)+' '+(fb.b||'?')+'b'+(fb.r?' \xd7'+fb.r:'')+(fb.u?' '+fb.u:'')+'</small>':'';
    let clsA='diff-same',clsB='diff-same';
    if(!fa) clsA='diff-rem';
    else if(!fb) clsB='diff-add';
    else if(fa.nm!==fb.nm||fa.ft!==fb.ft||fa.b!==fb.b){clsA='diff-chg';clsB='diff-chg';}
    rows+='<div class="diff-row"><div class="diff-cell '+clsA+'">'+descA+'</div><div class="diff-cell '+clsB+'">'+descB+'</div></div>';
  }
  const metaDiffs=[];
  if(d1.type!==d2.type) metaDiffs.push('<div class="diff-row"><div class="diff-cell diff-chg">Type: '+esc(d1.type)+'</div><div class="diff-cell diff-chg">Type: '+esc(d2.type)+'</div></div>');
  if(d1.len!==d2.len) metaDiffs.push('<div class="diff-row"><div class="diff-cell diff-chg">Length: '+d1.len+'B</div><div class="diff-cell diff-chg">Length: '+d2.len+'B</div></div>');
  document.getElementById('diff-body').innerHTML=
    '<div class="diff-cols">'+
      '<div class="diff-col-hdr">'+pad6(p1)+' '+esc(d1.desc)+'</div>'+
      '<div class="diff-col-hdr">'+pad6(p2)+' '+esc(d2.desc)+'</div>'+
    '</div>'+
    (metaDiffs.length?'<div style="margin-bottom:12px">'+metaDiffs.join('')+'</div>':'')+
    '<div class="rt-title" style="margin-bottom:8px">Fields ('+maxLen+' rows)</div>'+
    (rows?'<div>'+rows+'</div>':'<div style="color:var(--text2);text-align:center;padding:16px">Identical structure</div>');
}

// ── Byte/bit inspector ─────────────────────────────────────────────────────────
function showBitInfo(byteIdx,triggerEl){
  const popup=document.getElementById('bi-popup');
  if(!popup||!S.pgn) return;
  const group=DATA.groups.find(g=>g.pgn===S.pgn);
  if(!group) return;
  const d=group.defs[S.variant||0];
  const bytes=buildFrameBytes(d);
  if(byteIdx>=bytes.length) return;
  const byteVal=bytes[byteIdx];
  const bitOwners=new Array(8).fill(null);
  let offset=0;
  for(const f of (d.fields||[])){
    const bits=f.b||0;
    for(let i=0;i<bits;i++){
      const bIdx=Math.floor((offset+i)/8);
      const bBit=(offset+i)%8;
      if(bIdx===byteIdx) bitOwners[bBit]=f;
    }
    offset+=bits;
  }
  const bitsHtml=Array.from({length:8},(_,i)=>{
    const bit=7-i;
    const isSet=(byteVal>>bit)&1;
    const owner=bitOwners[bit];
    const color=owner?(TYPE_COLOR[owner.ft]||'#374151'):'#9CA3AF';
    return '<div class="bi-bit" style="border-color:'+color+';background:'+(isSet?color+'22':'transparent')+'">'+
      '<span class="bi-bit-val" style="color:'+color+'">'+isSet+'</span>'+
      '<span class="bi-bit-idx">b'+bit+'</span>'+
    '</div>';
  }).join('');
  const owners=[...new Set(bitOwners.filter(Boolean).map(f=>f.nm))];
  popup.innerHTML='<div class="bi-title">Byte '+byteIdx+' = 0x'+byteVal.toString(16).toUpperCase().padStart(2,'0')+'</div>'+
    '<div class="bi-bits">'+bitsHtml+'</div>'+
    '<div class="bi-field">'+esc(owners.length?owners.join(', '):'(no field)')+'</div>';
  // use fixed viewport coords so popup is never clipped by parent overflow
  const rect=triggerEl.getBoundingClientRect();
  const pW=popup.offsetWidth||220;
  let left=rect.left-60;
  if(left+pW>window.innerWidth-8) left=window.innerWidth-pW-8;
  if(left<4) left=4;
  popup.style.top=(rect.bottom+4)+'px';
  popup.style.left=left+'px';
  popup.classList.add('open');
  document.querySelectorAll('.hd-byte.bi-active').forEach(el=>el.classList.remove('bi-active'));
  triggerEl.classList.add('bi-active');
}

// ── CAN frame breakdown ────────────────────────────────────────────────────────
function renderCanFrame(pgn,d){
  const prio=d.prio!=null?d.prio:6;
  const dp=(pgn>>16)&1;
  const pf=(pgn>>8)&0xFF;
  const ps=pgn&0xFF;
  const isPeer=pf<240;
  const b2=(n,w)=>n.toString(2).padStart(w,'0');
  const h2=(n)=>'0x'+n.toString(16).toUpperCase().padStart(2,'0');
  const canId=((prio<<26)|(dp<<24)|(pf<<16)|((isPeer?0:ps)<<8))>>>0;
  const canIdHex='0x'+canId.toString(16).toUpperCase().padStart(8,'0');
  const seg=(cls,flex,lbl,val,tip)=>
    '<div class="cf-seg '+cls+'" style="flex:'+flex+'" title="'+esc(tip)+'">'+
    '<span class="cf-lbl">'+lbl+'</span><span class="cf-val">'+val+'</span></div>';
  return '<div class="cf-section">'+
    '<div class="cf-title">CAN Frame (29-bit ID)<span class="cf-id">'+esc(canIdHex)+'h &middot; SA=var</span></div>'+
    '<div class="cf-bar">'+
      seg('cf-prio',3,'PRIO',b2(prio,3),'Priority: '+prio+' ('+b2(prio,3)+'b)')+
      seg('cf-r',1,'R','0','Reserved bit — always 0')+
      seg('cf-dp',1,'DP',b2(dp,1),'Data Page: '+dp+' — selects PGN page')+
      seg('cf-pf',8,'PF',b2(pf,8),'Protocol Format: '+h2(pf)+' ('+pf+') — '+(isPeer?'PDU1: addressed (PF<240)':'PDU2: broadcast (PF≥240)'))+
      seg('cf-ps',8,isPeer?'DST':'PS',isPeer?'????????':b2(ps,8),isPeer?'Destination address — peer-to-peer PGN':'Protocol Specific: '+h2(ps)+' — low byte of PGN')+
      seg('cf-sa',8,'SA','????????','Source address — set by transmitting device')+
    '</div>'+
    '<div class="cf-legend">'+
      '<span class="cf-li">PGN&nbsp;<code>0x'+pgn.toString(16).toUpperCase()+'</code></span>'+
      '<span class="cf-li">DP='+dp+'</span>'+
      '<span class="cf-li">PF='+h2(pf)+'&nbsp;('+pf+')</span>'+
      '<span class="cf-li">'+(isPeer?'PDU1 / Peer-to-peer: PS is destination address':'PDU2 / Broadcast: PS='+h2(ps)+' is part of PGN')+'</span>'+
    '</div>'+
  '</div>';
}

// ── Bit layout diagram ─────────────────────────────────────────────────────────
function renderBitLayout(d){
  const fields=d.fields||[];
  if(!fields.length) return '';
  const totalBits=d.len?d.len*8:fields.reduce((s,f)=>s+(f.b||8),0);
  let offset=0;
  const segs=fields.map(f=>{
    const bits=f.b||8;
    const isDim=['RESERVED','SPARE'].includes(f.ft);
    const c=isDim?'#6B7280':(TYPE_COLOR[f.ft]||'#374151');
    const seg={name:f.nm,bits,offset,pct:totalBits?bits/totalBits:0,color:c,vari:!!f.bv,dim:isDim};
    offset+=bits;
    return seg;
  });
  // byte boundary markers
  const marks=[];
  for(let b=8;b<totalBits;b+=8){
    marks.push('<div class="bl-byte-mark" style="left:'+((b/totalBits)*100).toFixed(3)+'%"><span class="bl-byte-lbl">B'+(b/8)+'</span></div>');
  }
  const barSegs=segs.map((s,si)=>{
    const label=s.pct>.06?('<span class="bl-label">'+esc(s.name.length>11?s.name.slice(0,10)+'…':s.name)+'<br>'+s.bits+(s.vari?'*':'')+'b</span>'):'';
    return '<div class="bl-seg" data-fi="'+si+'" style="flex:'+s.bits+';background:'+s.color+';opacity:'+(s.dim?.35:.82)+'" title="'+esc(s.name)+' — '+s.bits+(s.vari?'* ':'')+'bits @ offset '+s.offset+'">'+label+'</div>';
  }).join('');
  const legend=segs.map((s,si)=>
    '<span class="bl-li" data-fi="'+si+'" style="cursor:default">'+
    '<span class="bl-dot" style="background:'+s.color+';opacity:'+(s.dim?.5:1)+'"></span>'+
    '<span class="bl-lname">'+esc(s.name)+'</span>'+
    '<span class="bl-loff">+'+s.offset+'b / '+s.bits+(s.vari?'*':'')+'b</span>'+
    '</span>'
  ).join('');
  return '<div class="bl-section">'+
    '<div class="bl-title">Bit Layout<span class="bl-total">'+totalBits+(d.len?'':'+')+'b</span></div>'+
    '<div class="bl-bar-wrap"><div class="bl-bar">'+barSegs+'</div>'+
    '<div class="bl-byte-marks">'+marks.join('')+'</div></div>'+
    '<div class="bl-legend">'+legend+'</div>'+
  '</div>';
}

// ── Sample output ──────────────────────────────────────────────────────────────
function sampleVal(f){
  if(f.ft==='RESERVED'||f.ft==='SPARE') return null;
  if(f.lk&&DATA.lookups[f.lk]&&DATA.lookups[f.lk].length){
    return {t:'s',v:DATA.lookups[f.lk][0][1]};
  }
  if(f.blk&&DATA.bitLookups[f.blk]&&DATA.bitLookups[f.blk].length){
    return {t:'n',v:DATA.bitLookups[f.blk][0][0]};
  }
  switch(f.ft){
    case 'NUMBER':case 'FLOAT':case 'DECIMAL':{
      const mn=f.mn!=null?f.mn:0;
      const mx=f.mx!=null?f.mx:Math.pow(2,Math.min(f.b||8,16))-1;
      const r=f.r||1;
      const raw=(mn+mx)/2;
      return {t:'n',v:parseFloat((Math.round(raw/r)*r).toPrecision(6))};
    }
    case 'DATE': return {t:'s',v:'2024-06-15'};
    case 'TIME': return {t:'s',v:'12:30:00.000'};
    case 'DURATION': return {t:'n',v:120};
    case 'STRING_FIX':case 'STRING_LAU':case 'STRING_LZ': return {t:'s',v:'SAMPLE'};
    case 'BINARY': return {t:'s',v:'00'};
    case 'MMSI': return {t:'n',v:123456789};
    case 'PGN': return {t:'n',v:127250};
    case 'ISO_NAME': return {t:'n',v:0};
    default:{
      const mx2=f.b?Math.pow(2,Math.min(f.b,16))-1:100;
      return {t:'n',v:Math.floor(mx2/2)};
    }
  }
}

function renderSampleOutput(d,pgn){
  const fields=d.fields||[];
  const keep=fields.filter(f=>!['RESERVED','SPARE'].includes(f.ft));
  if(!keep.length) return '';
  let html='<span class="so-meta">{</span>\\n';
  html+='  <span class="so-key">"pgn"</span>: <span class="so-num">'+pgn+'</span>,\\n';
  html+='  <span class="so-key">"prio"</span>: <span class="so-num">'+(d.prio!=null?d.prio:6)+'</span>,\\n';
  html+='  <span class="so-key">"src"</span>: <span class="so-num">0</span>,\\n';
  html+='  <span class="so-key">"dst"</span>: <span class="so-num">255</span>,\\n';
  keep.forEach((f,i)=>{
    const val=sampleVal(f);
    if(!val) return;
    const key=f.nm.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    const isLast=i===keep.length-1;
    let vHtml;
    if(val.t==='s') vHtml='<span class="so-str">"'+esc(String(val.v))+'"</span>';
    else if(f.ft==='PGN') vHtml='<span class="so-pgnref" onclick="selectPgn('+val.v+')" title="Navigate to PGN '+val.v+'">'+esc(String(val.v))+'</span>';
    else vHtml='<span class="so-num">'+esc(String(val.v))+'</span>';
    html+='  <span class="so-key">"'+esc(key)+'"</span>: '+vHtml+(isLast?'':',')+' \\n';
  });
  html+='<span class="so-meta">}</span>';
  return '<div class="so-section">'+
    '<div class="so-hdr"><span class="so-title">Sample Decoded Output</span>'+
    '<button class="so-copy" onclick="copySample(this)">Copy</button></div>'+
    '<pre class="so-code">'+html+'</pre>'+
  '</div>';
}

// ── Render PGN detail ──────────────────────────────────────────────────────────
function renderDetail(){
  const detail=document.getElementById('detail');
  if(!S.pgn){renderWelcome();return}
  const group=DATA.groups.find(g=>g.pgn===S.pgn);
  if(!group){detail.innerHTML='<p style="padding:24px;color:#666">PGN not found.</p>';return}

  const {pgn,defs}=group;
  const isMulti=defs.length>1;

  const numBlock='<div class="pgn-hdr-num-block">'+
    '<div class="pgn-hdr-label">PGN</div>'+
    '<div class="pgn-hdr-num">'+pad6(pgn)+'</div>'+
    '<div class="pgn-hdr-alt">dec '+pgn+' · hex 0x'+pgn.toString(16).toUpperCase()+'</div>'+
  '</div>';

  const textBlock='<div class="pgn-hdr-text">'+
    '<div class="pgn-hdr-name">'+esc(defs[0].desc)+'</div>'+
    '<div class="pgn-hdr-id">'+esc(defs[0].id)+'</div>'+
    '<span class="pgn-hdr-cat">'+esc(pgnCat(pgn))+'</span>'+
  '</div>';

  const isBm=getBookmarks().indexOf(pgn)>=0;
  const actionsBlock='<div class="pgn-hdr-actions">'+
    '<button class="btn-bm'+(isBm?' active':'')+'" onclick="toggleBookmark('+pgn+',this)" title="'+(isBm?'Remove bookmark':'Bookmark')+'">'+( isBm?'★':'☆')+'</button>'+
    '<button class="btn-share" onclick="sharePgn(this)">Share</button>'+
    '<button class="btn-print" onclick="window.print()">Print</button>'+
    '<button class="btn-diff" onclick="openDiff('+pgn+')">Diff</button>'+
    '<button class="btn-copy" onclick="copyPgn('+pgn+',this)">Copy PGN</button>'+
  '</div>';

  const tabsHtml=isMulti?
    '<div class="variant-tabs">'+
      defs.map((d,i)=>'<div class="variant-tab'+(i===0?' active':'')+'" onclick="selectVariant('+i+')">'+esc(d.desc.replace(defs[0].desc,'').trim()||'Variant '+(i+1))+'</div>').join('')+
    '</div>':'';

  const panelsHtml=defs.map((d,i)=>
    '<div class="var-panel" id="vp-'+i+'" style="'+(i>0?'display:none':'')+'">'+renderDefBlock(d,pgn)+'</div>'
  ).join('');

  detail.innerHTML='<div class="detail fade-in">'+
    '<div class="pgn-hdr-card">'+
      '<div class="pgn-hdr-main">'+numBlock+textBlock+actionsBlock+'</div>'+
      tabsHtml+
      renderDeviceClass(pgn,defs[0])+
    '</div>'+
    panelsHtml+
  '</div>';
}

// ── Search & filters ───────────────────────────────────────────────────────────
function setupEvents(){
  document.getElementById('hdr-search').addEventListener('input',function(){
    S.search=this.value;
    document.getElementById('sb-search').value=this.value;
    renderSidebar();
  });
  document.getElementById('sb-search').addEventListener('input',function(){
    S.search=this.value;
    document.getElementById('hdr-search').value=this.value;
    renderSidebar();
  });
  document.querySelectorAll('.sb-filter-btn').forEach(btn=>{
    btn.addEventListener('click',function(){
      const grp=this.dataset.group;
      const val=this.dataset.val;
      if(grp==='type'){
        S.typeFilter=val;
        document.querySelectorAll('.sb-filter-btn[data-group="type"]').forEach(b=>b.classList.toggle('on',b===this));
      } else {
        S.completeFilter=val;
        document.querySelectorAll('.sb-filter-btn[data-group="complete"]').forEach(b=>b.classList.toggle('on',b===this));
      }
      renderSidebar();
    });
  });

  window.addEventListener('popstate',()=>{
    handleHash(false);
  });

  // Keyboard navigation and shortcuts
  document.addEventListener('keydown',function(e){
    const inInput=document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='SELECT';
    if(e.key==='/'&&!inInput){e.preventDefault();document.getElementById('sb-search').focus();}
    if(e.key==='Escape'){
      S.search='';
      document.getElementById('sb-search').value='';
      document.getElementById('hdr-search').value='';
      renderSidebar();
    }
    if(!inInput&&(e.key==='j'||e.key==='ArrowDown')){e.preventDefault();navigatePgn(1);}
    if(!inInput&&(e.key==='k'||e.key==='ArrowUp')){e.preventDefault();navigatePgn(-1);}
  });

  // Diff overlay background click → close
  const diffOverlay=document.getElementById('diff-overlay');
  if(diffOverlay) diffOverlay.addEventListener('click',function(e){if(e.target===this)closeDiff();});

  // Keyboard shortcut: Escape closes diff modal
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&document.getElementById('diff-overlay')&&document.getElementById('diff-overlay').classList.contains('open')){
      closeDiff();
    }
  },true);

  // Byte/bit inspector click
  document.addEventListener('click',function(e){
    const byteEl=e.target.closest('.hd-byte[data-bi]');
    if(byteEl){showBitInfo(parseInt(byteEl.dataset.bi),byteEl);return;}
    const popup=document.getElementById('bi-popup');
    if(popup&&popup.classList.contains('open')&&!popup.contains(e.target)){
      popup.classList.remove('open');
      document.querySelectorAll('.hd-byte.bi-active').forEach(el=>el.classList.remove('bi-active'));
    }
  });

  // Bit layout ↔ field table sync on hover
  document.addEventListener('mouseover',function(e){
    const seg=e.target.closest('.bl-seg[data-fi]');
    const leg=e.target.closest('.bl-legend .bl-li[data-fi]');
    const row=e.target.closest('.fr[data-fi]');
    const fi=(seg||leg||row)&&(seg||leg||row).dataset.fi;
    if(fi!=null){
      document.querySelectorAll('.bl-seg[data-fi="'+fi+'"],.fr[data-fi="'+fi+'"]').forEach(el=>el.classList.add('hl'));
    }
  });
  document.addEventListener('mouseout',function(e){
    if(!e.target.closest('.bl-seg[data-fi]')&&!e.target.closest('.bl-legend .bl-li[data-fi]')&&!e.target.closest('.fr[data-fi]')){
      document.querySelectorAll('.bl-seg.hl,.fr.hl').forEach(el=>el.classList.remove('hl'));
    }
  });
}

// ── Keyboard PGN navigation ────────────────────────────────────────────────────
function navigatePgn(dir){
  const groups=filtered();
  if(!groups.length) return;
  const cur=groups.findIndex(g=>g.pgn===S.pgn);
  const next=cur===-1?(dir>0?0:groups.length-1):Math.max(0,Math.min(groups.length-1,cur+dir));
  selectPgn(groups[next].pgn);
}

// ── Copy sample output ─────────────────────────────────────────────────────────
function copySample(btn){
  const pre=btn.closest('.so-section').querySelector('.so-code');
  navigator.clipboard?.writeText(pre.innerText).then(()=>{
    btn.textContent='Copied!';btn.classList.add('copied');
    setTimeout(()=>{btn.textContent='Copy';btn.classList.remove('copied');},1600);
  });
}

// ── Enumeration browser ────────────────────────────────────────────────────────
function renderEnumBrowser(){
  const allNames=Object.keys(DATA.lookups).concat(Object.keys(DATA.bitLookups)).sort();
  // build a map: enumName -> list of PGN numbers that use it
  const usage={};
  for(const g of DATA.groups){
    for(const d of g.defs){
      for(const f of d.fields){
        if(f.lk){(usage[f.lk]=usage[f.lk]||new Set()).add(g.pgn);}
        if(f.blk){(usage[f.blk]=usage[f.blk]||new Set()).add(g.pgn);}
      }
    }
  }
  // convert Sets to arrays for JSON compatibility (already done at this point)
  const usageArr={};
  for(const k of Object.keys(usage)) usageArr[k]=[...usage[k]];

  const lkCount=Object.keys(DATA.lookups).length;
  const blkCount=Object.keys(DATA.bitLookups).length;
  return '<div class="eb-section">'+
    '<div class="eb-hdr" onclick="toggleEnumBrowser(this)">'+
      '<div class="eb-hdr-left"><span class="eb-title">Enumeration Reference</span>'+
      '<span class="eb-meta">'+lkCount+' enums &middot; '+blkCount+' bit-flags</span></div>'+
      '<span class="eb-toggle">▾</span>'+
    '</div>'+
    '<div class="eb-body">'+
      '<input class="eb-search" type="search" placeholder="Filter enumerations…" oninput="filterEnums(this.value)" autocomplete="off">'+
      '<div class="eb-grid" id="eb-grid">'+
        allNames.map(name=>{
          const isBit=!!DATA.bitLookups[name];
          const vals=isBit?DATA.bitLookups[name]:DATA.lookups[name];
          const used=usageArr[name]||[];
          const usedHtml=used.length?'<div class="lut-overflow">Used by: PGN '+used.slice(0,5).join(', ')+(used.length>5?'…':'')+'</div>':'';
          return '<div class="lut eb-lut" data-name="'+esc(name.toLowerCase())+'">'+
            '<div class="lut-hdr"><span class="lut-hdr-name">'+esc(name)+'</span><span class="lut-hdr-type">'+(isBit?'bit-flags':'enum')+' · '+vals.length+'</span></div>'+
            '<div class="lut-body">'+vals.slice(0,20).map(([v,n])=>'<div class="lut-row"><span class="lv">'+esc(v)+'</span><span class="ln">'+esc(n)+'</span></div>').join('')+'</div>'+
            (vals.length>20?'<div class="lut-overflow">… '+vals.length+' values total</div>':'')+
            usedHtml+
          '</div>';
        }).join('')+
      '</div>'+
    '</div>'+
  '</div>';
}
function toggleEnumBrowser(hdr){
  hdr.classList.toggle('open');
  hdr.querySelector('.eb-toggle').classList.toggle('open');
  hdr.nextElementSibling.classList.toggle('open');
}
function filterEnums(q){
  const lq=q.toLowerCase().trim();
  document.querySelectorAll('.eb-lut').forEach(el=>{
    el.style.display=(!lq||el.dataset.name.includes(lq))?'':'none';
  });
  const visible=document.querySelectorAll('.eb-lut:not([style*="none"])').length;
  const empty=document.getElementById('eb-grid').querySelector('.eb-empty');
  if(!visible&&!document.getElementById('eb-grid').querySelector('.eb-empty')){
    document.getElementById('eb-grid').insertAdjacentHTML('beforeend','<div class="eb-empty">No enumerations match</div>');
  } else if(visible&&empty){empty.remove();}
}

// ── Sidebar advanced filters ───────────────────────────────────────────────────
function initAdvFilters(){
  const allPqs=[...new Set(
    DATA.groups.flatMap(g=>g.defs.flatMap(d=>d.fields.map(f=>f.pq).filter(Boolean)))
  )].sort();
  const pqOpts='<option value="">All Physical Quantities</option>'+allPqs.map(q=>'<option value="'+esc(q)+'">'+esc(q.replace(/_/g,' ').toLowerCase().replace(/\\b./g,c=>c.toUpperCase()))+'</option>').join('');
  const catOpts='<option value="">All Categories</option>'+CATS.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
  document.getElementById('sb-adv').innerHTML=
    '<select class="sb-cat" onchange="S.catFilter=this.value;renderSidebar()">'+catOpts+'</select>'+
    '<select class="sb-pq" onchange="S.pqFilter=this.value;renderSidebar()">'+pqOpts+'</select>';
}

function handleHash(pushState){
  const m=location.hash.match(/^#pgn-(\\d+)$/);
  if(m){
    selectPgn(parseInt(m[1]),false);
  } else {
    renderWelcome();
  }
}

// ── Theme management ───────────────────────────────────────────────────────────
function applyTheme(pref){
  const dark=pref==='dark'||(pref==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.setAttribute('data-theme',dark?'dark':'light');
  document.querySelectorAll('.tt-btn').forEach(b=>b.classList.toggle('active',b.dataset.t===pref));
}
function setTheme(pref){
  localStorage.setItem('nmea-theme',pref);
  applyTheme(pref);
}
function initTheme(){
  const stored=localStorage.getItem('nmea-theme')||'system';
  applyTheme(stored);
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{
    if((localStorage.getItem('nmea-theme')||'system')==='system') applyTheme('system');
  });
}

// ── Boot ───────────────────────────────────────────────────────────────────────
function init(){
  initTheme();
  initAdvFilters();
  const urlQ=new URLSearchParams(location.search).get('q');
  if(urlQ){
    S.search=urlQ;
    document.getElementById('sb-search').value=urlQ;
    document.getElementById('hdr-search').value=urlQ;
  }
  renderSidebar();
  setupEvents();
  handleHash(false);
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(function(){});
  }
}

document.addEventListener('DOMContentLoaded',init);
`;

// ── HTML ───────────────────────────────────────────────────────────────────────
const totalGroups = groups.length;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NMEA 2000 PGN Reference</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚓</text></svg>">
  <link rel="manifest" href="manifest.json">
  <script>
    (function(){
      var t=localStorage.getItem('nmea-theme')||'system';
      var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
      document.documentElement.setAttribute('data-theme',dark?'dark':'light');
    })();
  </script>
  <style>${CSS}</style>
</head>
<body>

<header class="hdr">
  <a class="hdr-logo" href="#" onclick="S.pgn=null;renderWelcome();return false">
    <span class="hdr-anchor">⚓</span>
    <span class="hdr-brand">NMEA&thinsp;2000<sup>®</sup></span>
  </a>
  <div class="hdr-sep"></div>
  <span class="hdr-title">PGN Reference</span>
  <div class="hdr-search-wrap">
    <span class="hdr-search-icon">🔍</span>
    <input id="hdr-search" class="hdr-search" type="search" placeholder="Search PGN, name, field, unit…" autocomplete="off" spellcheck="false">
  </div>
  <div class="theme-toggle" title="Switch theme">
    <button class="tt-btn" data-t="light"  onclick="setTheme('light')"  title="Light">☀</button>
    <button class="tt-btn" data-t="system" onclick="setTheme('system')" title="System">⊙</button>
    <button class="tt-btn" data-t="dark"   onclick="setTheme('dark')"   title="Dark">☾</button>
  </div>
  <span class="hdr-ver">v${raw.Version ?? '—'}</span>
</header>

<div class="app">
  <aside class="sidebar">
    <div class="sb-top">
      <div class="sb-search-wrap">
        <span class="sb-search-icon">🔍</span>
        <input id="sb-search" class="sb-search" type="search" placeholder="Filter PGNs…" autocomplete="off" spellcheck="false">
      </div>
      <div class="sb-filters">
        <button class="sb-filter-btn on"  data-group="type"     data-val="all"   >All</button>
        <button class="sb-filter-btn"     data-group="type"     data-val="fast"  >Fast</button>
        <button class="sb-filter-btn"     data-group="type"     data-val="single">Single</button>
        <span id="sb-count" class="sb-count">${totalGroups} / ${totalGroups}</span>
      </div>
    </div>
    <div class="sb-adv" id="sb-adv"></div>
    <div class="sb-list" id="sb-list"></div>
  </aside>

  <main class="content" id="content">
    <div id="detail"></div>
  </main>
</div>

<div id="bi-popup" class="bi-popup"></div>

<div id="diff-overlay" class="diff-overlay">
  <div class="diff-modal">
    <div class="diff-hdr">
      <span class="diff-title">Compare PGNs — Field Diff</span>
      <button class="diff-close" onclick="closeDiff()">&#215;</button>
    </div>
    <div class="diff-sel">
      <select id="diff-sel-a" class="diff-pgn-sel"></select>
      <span style="color:var(--text2);font-weight:700;padding:0 4px">vs</span>
      <select id="diff-sel-b" class="diff-pgn-sel"></select>
      <button class="diff-run" onclick="runDiff()">Compare</button>
    </div>
    <div class="diff-body" id="diff-body">
      <div style="color:var(--text2);text-align:center;padding:24px">Select two PGNs and click Compare</div>
    </div>
  </div>
</div>

<script>${JS}</script>
</body>
</html>`;

// ── Write ──────────────────────────────────────────────────────────────────────
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, HTML, 'utf8');

const size = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`Built ${OUT}  (${size} KB, ${totalGroups} PGN groups, ${TOTAL_DEFS} definitions)`);
console.log(`Open: file://${OUT}`);

// ── Service Worker ─────────────────────────────────────────────────────────────
const SW_VERSION = `nmea2000-v${raw.Version ?? '1'}-${totalGroups}`;
const SW = `const CACHE='${SW_VERSION}';
const FILES=['./','./index.html'];
self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(cached=>cached||
      fetch(e.request).then(res=>{
        if(res.ok){const c=res.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));}
        return res;
      })
    )
  );
});
`;
fs.writeFileSync(path.join(DIST, 'sw.js'), SW, 'utf8');

// ── Web App Manifest ────────────────────────────────────────────────────────────
const MANIFEST = JSON.stringify({
  name: 'NMEA 2000 PGN Reference',
  short_name: 'PGN Ref',
  description: 'Interactive technical reference for NMEA 2000 Parameter Group Numbers',
  start_url: './',
  display: 'standalone',
  background_color: '#0D1117',
  theme_color: '#1B3A5C',
  icons: [{
    src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚓</text></svg>",
    sizes: 'any',
    type: 'image/svg+xml',
    purpose: 'any maskable'
  }]
}, null, 2);
fs.writeFileSync(path.join(DIST, 'manifest.json'), MANIFEST, 'utf8');
console.log(`PWA: sw.js + manifest.json written`);
