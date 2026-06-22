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
[data-theme="dark"] .fr.dim td{color:#4B5563}
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
`;

// ── JS app ─────────────────────────────────────────────────────────────────────
// Note: inner template literals are escaped as \` and \${ for embedding
const JS = `
const DATA = ${DATA};

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

// ── State ──────────────────────────────────────────────────────────────────────
const S={search:'',typeFilter:'all',completeFilter:'all',pgn:null,variant:0};

function filtered(){
  let g=DATA.groups;
  const q=S.search.trim().toLowerCase();
  if(q){
    g=g.filter(gr=>{
      const num=String(gr.pgn);
      return num.includes(q)||gr.defs.some(d=>d.desc.toLowerCase().includes(q)||d.id.toLowerCase().includes(q));
    });
  }
  if(S.typeFilter!=='all'){
    const tf=S.typeFilter;
    g=g.filter(gr=>gr.defs.some(d=>d.type.toLowerCase()===tf));
  }
  if(S.completeFilter==='complete') g=g.filter(gr=>gr.defs.every(d=>d.complete));
  if(S.completeFilter==='incomplete') g=g.filter(gr=>gr.defs.some(d=>!d.complete));
  return g;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function renderSidebar(){
  const groups=filtered();
  document.getElementById('sb-count').textContent=groups.length+' / '+DATA.groups.length;
  const html=groups.map(g=>{
    const active=g.pgn===S.pgn;
    const t=g.defs[0].type;
    const typeCls=t==='Fast'?'fast':'single';
    const typeLabel=t==='Fast'?'F':'S';
    return '<div class="pi'+(active?' active':'')+'" onclick="selectPgn('+g.pgn+')" data-pgn="'+g.pgn+'">'+
      '<span class="pi-num">'+pad6(g.pgn)+'</span>'+
      '<div class="pi-info">'+
        '<div class="pi-name">'+esc(g.defs[0].desc)+'</div>'+
      '</div>'+
      '<span class="pi-type '+typeCls+'">'+typeLabel+'</span>'+
      (g.defs.length>1?'<span class="pi-multi">'+g.defs.length+'</span>':'')+
    '</div>';
  }).join('');
  document.getElementById('sb-list').innerHTML=html||'<div class="sb-empty">No PGNs match your search</div>';
}

// ── Select PGN ─────────────────────────────────────────────────────────────────
function selectPgn(pgn,pushState){
  if(pushState===undefined)pushState=true;
  S.pgn=pgn; S.variant=0;
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
  '</div>';
}

// ── Render field row ───────────────────────────────────────────────────────────
function fieldRow(f,i){
  const isDim=['RESERVED','SPARE'].includes(f.ft);
  const cls=isDim?'dim':(i%2===0?'ev':'od');
  const bits=f.bv?(f.b||'?')+'*':String(f.b||'?');
  const range=(f.mn!=null&&f.mx!=null)?(f.mn+' – '+f.mx):'';
  const res=fmtRes(f.r);

  const notes=[];
  if(f.sg) notes.push('<span class="tag tag-signed">signed</span>');
  if(f.key) notes.push('<span class="tag tag-key">⚷ key</span>');
  if(f.pq) notes.push('<span class="tag tag-pq">'+esc(f.pq.toLowerCase().replace(/_/g,' '))+'</span>');
  if(f.lk)  notes.push('<span class="tag tag-lk">↗ '+esc(f.lk)+'</span>');
  if(f.blk) notes.push('<span class="tag tag-blk">⚑ '+esc(f.blk)+'</span>');
  if(f.c)   notes.push('<span class="tag tag-cond">if '+esc(f.c)+'</span>');
  if(f.m!=null) notes.push('<span class="tag tag-signed">match='+esc(f.m)+'</span>');

  const descHtml=f.d?'<small>'+esc(f.d)+'</small>':'';

  return '<tr class="fr '+cls+'">'+
    '<td class="fc-n">'+(f.n||i+1)+'</td>'+
    '<td class="fc-nm">'+esc(f.nm)+descHtml+'</td>'+
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
  const rows=vals.map(([v,n])=>'<div class="lut-row"><span class="lv">'+esc(v)+'</span><span class="ln">'+esc(n)+'</span></div>').join('');
  const overflow=vals.length>30?'<div class="lut-overflow">'+vals.length+' entries total</div>':'';
  const displayRows=vals.slice(0,30).map(([v,n])=>'<div class="lut-row"><span class="lv">'+esc(v)+'</span><span class="ln">'+esc(n)+'</span></div>').join('');
  return '<div class="lut">'+
    '<div class="lut-hdr"><span class="lut-hdr-name">'+esc(name)+'</span><span class="lut-hdr-type">'+(isBit?'bit flags':'enum')+'</span></div>'+
    '<div class="lut-body">'+displayRows+'</div>'+
    (overflow?'<div class="lut-overflow">… '+vals.length+' values total</div>':'')+
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
      '<tbody>'+fields.map(fieldRow).join('')+'</tbody>'+
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
    (d.expl?'<div class="expl-block"><p class="expl-text">'+esc(d.expl)+'</p></div>':'')+
    (d.url?'<div class="ref-row"><span class="ref-lbl">Reference</span>'+esc(d.url)+'</div>':'')+
    (d.missing&&d.missing.length?'<div class="miss-row">⚠ Missing: '+d.missing.map(esc).join(', ')+'</div>':'')+
    tableHtml+
    repeatHtml+
    (lookupHtml?'<div class="lut-section"><div class="lut-grid">'+lookupHtml+'</div></div>':'')+
    renderBitLayout(d)+
    renderSampleOutput(d,pgn)+
  '</div>';
}

function pill(label,val,valCls){
  return '<div class="pill">'+
    '<span class="pl">'+esc(label)+'</span>'+
    '<span class="pv'+(valCls?' '+valCls:'')+'">'+esc(val)+'</span>'+
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
  const barSegs=segs.map(s=>{
    const label=s.pct>.06?('<span class="bl-label">'+esc(s.name.length>11?s.name.slice(0,10)+'…':s.name)+'<br>'+s.bits+(s.vari?'*':'')+'b</span>'):'';
    return '<div class="bl-seg" style="flex:'+s.bits+';background:'+s.color+';opacity:'+(s.dim?.35:.82)+'" title="'+esc(s.name)+' — '+s.bits+(s.vari?'* ':'')+'bits @ offset '+s.offset+'">'+label+'</div>';
  }).join('');
  const legend=segs.map(s=>
    '<span class="bl-li">'+
    '<span class="bl-dot" style="background:'+s.color+';opacity:'+(s.dim?.5:1)+'"></span>'+
    '<span class="bl-lname">'+esc(s.name)+'</span>'+
    '<span class="bl-loff">+'+s.offset+'b / '+s.bits+(s.vari?'*':'')+'b</span>'+
    '</span>'
  ).join('');
  return '<div class="bl-section">'+
    '<div class="bl-title">Bit Layout<span class="bl-total">'+totalBits+(d.len?'':'+')+'b</span></div>'+
    '<div class="bl-bar">'+barSegs+'</div>'+
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
  let html='<span class="so-meta">{</span>\n';
  html+='  <span class="so-key">"pgn"</span>: <span class="so-num">'+pgn+'</span>,\n';
  html+='  <span class="so-key">"prio"</span>: <span class="so-num">'+(d.prio!=null?d.prio:6)+'</span>,\n';
  html+='  <span class="so-key">"src"</span>: <span class="so-num">0</span>,\n';
  html+='  <span class="so-key">"dst"</span>: <span class="so-num">255</span>,\n';
  keep.forEach((f,i)=>{
    const val=sampleVal(f);
    if(!val) return;
    const key=f.nm.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    const isLast=i===keep.length-1;
    const vHtml=val.t==='s'?'<span class="so-str">"'+esc(String(val.v))+'"</span>':'<span class="so-num">'+esc(String(val.v))+'</span>';
    html+='  <span class="so-key">"'+esc(key)+'"</span>: '+vHtml+(isLast?'':',')+'\n';
  });
  html+='<span class="so-meta">}</span>';
  return '<div class="so-section">'+
    '<div class="so-title">Sample Decoded Output</div>'+
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
  '</div>';

  const actionsBlock='<div class="pgn-hdr-actions">'+
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

  // Keyboard shortcut: / to focus search
  document.addEventListener('keydown',function(e){
    if(e.key==='/'&&document.activeElement.tagName!=='INPUT'){
      e.preventDefault();
      document.getElementById('sb-search').focus();
    }
    if(e.key==='Escape'){
      S.search='';
      document.getElementById('sb-search').value='';
      document.getElementById('hdr-search').value='';
      renderSidebar();
    }
  });
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
  renderSidebar();
  setupEvents();
  handleHash(false);
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
    <input id="hdr-search" class="hdr-search" type="search" placeholder="Search PGN number or name…" autocomplete="off" spellcheck="false">
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
    <div class="sb-list" id="sb-list"></div>
  </aside>

  <main class="content" id="content">
    <div id="detail"></div>
  </main>
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
