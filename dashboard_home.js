/*
 * dashboard_home.js — dashboard home pane: recent HLA analyses, recent risk estimates (localStorage, this browser
 * only), reference-data status. Items are saved by hla_ui.js (HLAUI.saveRecent) and app.js (saveEstimate).
 */
(function () {
    'use strict';
    const $ = function (id) { return document.getElementById(id); };
    const KEY_HLA = 'ramrt-recent-hla', KEY_RISK = 'ramrt-recent-risk', MAX = 20;

    function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function read(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
    function write(key, list) { try { localStorage.setItem(key, JSON.stringify(list.slice(0, MAX))); } catch (e) { /* storage unavailable */ } }
    function when(ts) { const d = new Date(ts); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

    function add(key, entry, idField) {
        const list = read(key).filter(function (e) { return !idField || e[idField] !== entry[idField]; });
        list.unshift(entry);
        write(key, list);
        render();
    }
    function remove(key, idx) { const list = read(key); list.splice(idx, 1); write(key, list); render(); }
    function clear(key) { write(key, []); render(); }

    function oneLine(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
    function attr(t) { return esc(oneLine(t)); }

    function renderHla() {
        const el = $('home-recent-hla');
        if (!el) return;
        const list = read(KEY_HLA);
        if (!list.length) { el.innerHTML = '<p class="hla-na">No saved analyses yet. In the HLA &amp; eplets tool, press <em>Save to recent</em> (sending to the risk calculator also saves).</p>'; return; }
        el.innerHTML = '<ul class="recent-list">' +
            list.map(function (e, i) {
                const mm = e.summary.antigenABDR === null ? '–' : e.summary.antigenABDR + '<small>/6</small>';
                const ep = e.summary.eplets === null ? '–' : e.summary.eplets;
                const ie = e.summary.immunogenic === null ? '–' : e.summary.immunogenic;
                return '<li class="recent-item">' +
                    '<div class="recent-head">' +
                        '<span class="recent-when">' + esc(when(e.ts)) + ' <small class="ux-muted">ID ' + esc(e.id) + '</small></span>' +
                        '<span class="recent-metrics"><b>' + mm + '</b> MM · <b>' + esc(String(ep)) + '</b> eplets · <b>' + esc(String(ie)) + '</b> immunogenic</span>' +
                    '</div>' +
                    '<div class="recent-typing"><span class="recent-role">R</span><code title="' + attr(e.recipient) + '">' + esc(oneLine(e.recipient)) + '</code></div>' +
                    '<div class="recent-typing"><span class="recent-role">D</span><code title="' + attr(e.donor) + '">' + esc(oneLine(e.donor)) + '</code></div>' +
                    '<div class="recent-actions">' +
                        '<button type="button" class="ux-link-btn" onclick="DashboardHome.openHla(' + i + ')">Open</button>' +
                        '<button type="button" class="ux-link-btn ux-danger" onclick="DashboardHome.removeHla(' + i + ')">Delete</button>' +
                    '</div></li>';
            }).join('') + '</ul>' +
            '<div class="ux-more-actions"><button type="button" onclick="DashboardHome.clearHla()">Clear list</button></div>';
    }
    function renderRisk() {
        const el = $('home-recent-risk');
        if (!el) return;
        const list = read(KEY_RISK);
        if (!list.length) { el.innerHTML = '<p class="hla-na">No saved estimates yet. In the risk calculator, press <em>Save estimate</em>.</p>'; return; }
        el.innerHTML = '<ul class="recent-list">' +
            list.map(function (e, i) {
                const inp = e.inputs;
                const desc = 'Donor ' + inp.donorAge + ' y, ' +
                    (inp.donorSource === '1' ? 'deceased' : 'living') +
                    (inp.siblingDonor === '1' ? ', sibling' : '') + ', ' +
                    (inp.standardInduction === '1' ? 'basiliximab' : 'depleting') +
                    '; MM A' + inp.mmA + ' B' + inp.mmB + ' DR' + inp.mmDRB1 + ' DQ' + inp.mmDQB1 +
                    '; T-MCS ' + inp.mcsT + ', B-MCS ' + inp.mcsB;
                return '<li class="recent-item">' +
                    '<div class="recent-head">' +
                        '<span class="recent-when">' + esc(when(e.ts)) + '</span>' +
                        '<span class="recent-metrics"><b>' + esc(e.risk) + '</b> · ' + esc(e.band) + '</span>' +
                    '</div>' +
                    '<div class="recent-typing"><code title="' + attr(desc) + '">' + esc(oneLine(desc)) + '</code></div>' +
                    '<div class="recent-actions">' +
                        '<button type="button" class="ux-link-btn" onclick="DashboardHome.openRisk(' + i + ')">Open</button>' +
                        '<button type="button" class="ux-link-btn ux-danger" onclick="DashboardHome.removeRisk(' + i + ')">Delete</button>' +
                    '</div></li>';
            }).join('') + '</ul>' +
            '<div class="ux-more-actions"><button type="button" onclick="DashboardHome.clearRisk()">Clear list</button></div>';
    }
    function renderStatus() {
        const el = $('home-status');
        if (!el) return;
        const m = window.HLA_REF && window.HLA_REF.meta;
        const v = window.HLA_VALIDATION && window.HLA_VALIDATION.nodeRun;
        const ie = window.HLA_REF && window.HLA_REF.ie;
        const tiles = [
            ['Risk model', 'ElasticNet, 443 recipients', 'AUC 0.693 · Hosmer-Lemeshow p = 0.51'],
            ['HLA reference', m ? (m.classI_alleles + ' class I · ' + m.classII_beta_alleles + ' class II β · ' + m.classII_alpha_alleles + ' α alleles') : 'not loaded', m ? 'HLAMatchmaker 3.1 tables, built ' + m.built.slice(0, 10) : ''],
            ['Immunogenic catalogue', ie ? (ie.classI.length + ' class I · ' + ie.classII.length + ' class II eplets') : 'not loaded', 'PGIMER IE.xlsx'],
            ['Engine tests', v ? (v.pass + ' passed · ' + v.fail + ' failed') : 'not run', v ? 'last offline run ' + v.date.slice(0, 10) : '']
        ];
        el.innerHTML = tiles.map(function (t) { return '<div class="hla-tile"><div class="hla-tile-value hla-tile-value-sm">' + esc(t[1]) + '</div><div class="hla-tile-label">' + esc(t[0]) + '</div><div class="hla-tile-sub">' + esc(t[2]) + '</div></div>'; }).join('');
    }
    function render() { renderHla(); renderRisk(); renderStatus(); }

    function openHla(i) {
        const e = read(KEY_HLA)[i];
        if (!e || !window.HLAUI) return;
        HLAUI.restore(e);
        if (typeof switchCalculatorTab === 'function') switchCalculatorTab('eplet');
    }
    function openRisk(i) {
        const e = read(KEY_RISK)[i];
        if (!e || typeof restoreEstimate !== 'function') return;
        restoreEstimate(e);
        if (typeof switchCalculatorTab === 'function') switchCalculatorTab('nomogram');
    }

    window.DashboardHome = {
        render: render,
        addHla: function (entry) { add(KEY_HLA, entry, 'id'); },
        addRisk: function (entry) { add(KEY_RISK, entry, null); },
        openHla: openHla, openRisk: openRisk,
        removeHla: function (i) { remove(KEY_HLA, i); }, removeRisk: function (i) { remove(KEY_RISK, i); },
        clearHla: function () { clear(KEY_HLA); }, clearRisk: function () { clear(KEY_RISK); }
    };
    document.addEventListener('DOMContentLoaded', render);
})();
