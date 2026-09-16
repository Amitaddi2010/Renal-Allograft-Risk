/*
 * external_tools.js — External HLA Tool Integration
 *
 * Manages the "External HLA Tools" tab pane, providing a tool-picker UI
 * and lazy iframe loading for:
 *   1. HLAdiv.net — HLA Evolutionary Divergence (HED) calculator
 *   2. HLA AAMS & EMS3D — Amino Acid Mismatch Score & Electrostatic Mismatch Score 3D
 */
(function () {
    'use strict';

    var TOOLS = {
        hed: {
            id: 'hed',
            name: 'HLA Evolutionary Divergence (HED)',
            url: 'https://hladiv.net',
            icon: '🧬',
            description: 'Calculate evolutionary divergence between HLA class I alleles. Supports pair-wise, loci mean, and batch TSV processing.',
            citations: [
                'Chowell D et al. (2019) Evolutionary divergence of HLA class I genotype impacts efficacy of cancer immunotherapy. <em>Nature Medicine</em>, 25(11), 1715–1720.',
                'Pierini F & Lenz TL (2018) Divergent Allele Advantage at Human MHC Genes. <em>Mol Biol Evol</em>, 35(9), 2145–2158.'
            ],
            contributors: 'CIPI / CCF — Chan, Chowell, Pierini, Lenz labs'
        },
        aams: {
            id: 'aams',
            name: 'HLA AAMS & EMS3D',
            url: 'https://mohorianulab.org/shiny/kosmoliaptsis/HLA_Algorithms/',
            icon: '⚡',
            description: 'Quantify amino acid sequence, structural, and physicochemical disparity between donor and recipient HLA using AAMS and EMS3D algorithms.',
            citations: [
                'Kosmoliaptsis V et al. (2009) Predicting HLA Class I Alloantigen Immunogenicity. <em>Transplantation</em>, 88(6), 791–8.',
                'Kosmoliaptsis V et al. (2011) Predicting HLA Class II Alloantigen Immunogenicity. <em>Transplantation</em>, 91, 183–90.',
                'Mallon DH et al. (2018) Predicting Humoral Alloimmunity from Differences in Donor and Recipient HLA Surface Electrostatic Potential. <em>J Immunol</em>, 201(12), 3780–3792.'
            ],
            contributors: 'Kosmoliaptsis Lab, University of Cambridge'
        }
    };

    var currentTool = null;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function render() {
        var pane = document.getElementById('pane-external');
        if (!pane) return;

        pane.innerHTML =
            '<div class="module-header">' +
                '<div>' +
                    '<h1 class="module-title">External HLA Tools</h1>' +
                    '<p class="module-desc">Integrate with published HLA immunogenicity and divergence calculators. These tools run on their own servers — select one to load it below.</p>' +
                '</div>' +
            '</div>' +
            '<div class="ext-tool-picker" id="ext-tool-picker">' +
                renderCard(TOOLS.hed) +
                renderCard(TOOLS.aams) +
            '</div>' +
            '<div class="ext-iframe-wrap" id="ext-iframe-wrap">' +
                '<div class="ext-placeholder" id="ext-placeholder">' +
                    '<div class="ext-placeholder-icon">↑</div>' +
                    '<p>Select a tool above to load it here</p>' +
                '</div>' +
            '</div>';
    }

    function renderCard(tool) {
        return '<button type="button" class="ext-tool-card" id="ext-card-' + tool.id + '" onclick="ExternalTools.switchTool(\'' + tool.id + '\')">' +
            '<div class="ext-tool-icon">' + tool.icon + '</div>' +
            '<div class="ext-tool-info">' +
                '<h3 class="ext-tool-name">' + esc(tool.name) + '</h3>' +
                '<p class="ext-tool-desc">' + esc(tool.description) + '</p>' +
                '<p class="ext-tool-contrib">' + esc(tool.contributors) + '</p>' +
            '</div>' +
            '<span class="ext-tool-arrow">→</span>' +
        '</button>';
    }

    function switchTool(toolId) {
        var tool = TOOLS[toolId];
        if (!tool) return;
        currentTool = toolId;

        // Highlight active card
        var cards = document.querySelectorAll('.ext-tool-card');
        cards.forEach(function (c) { c.classList.remove('active'); });
        var active = document.getElementById('ext-card-' + toolId);
        if (active) active.classList.add('active');

        // Build iframe area
        var wrap = document.getElementById('ext-iframe-wrap');
        if (!wrap) return;

        wrap.innerHTML =
            '<div class="ext-iframe-header">' +
                '<div class="ext-iframe-title">' +
                    '<span class="ext-tool-icon-sm">' + tool.icon + '</span>' +
                    '<strong>' + esc(tool.name) + '</strong>' +
                '</div>' +
                '<div class="ext-iframe-actions">' +
                    '<a href="' + esc(tool.url) + '" target="_blank" rel="noopener noreferrer" class="btn-ghost btn-sm">Open in new tab ↗</a>' +
                '</div>' +
            '</div>' +
            '<div class="ext-iframe-loading" id="ext-iframe-loading">' +
                '<div class="ext-spinner"></div>' +
                '<p>Loading ' + esc(tool.name) + '…</p>' +
            '</div>' +
            '<iframe id="ext-iframe" class="ext-iframe" src="' + esc(tool.url) + '" ' +
                'sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" ' +
                'loading="lazy" ' +
                'title="' + esc(tool.name) + '">' +
            '</iframe>' +
            '<div class="ext-citations">' +
                '<details>' +
                    '<summary>References & citations</summary>' +
                    '<ul>' + tool.citations.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul>' +
                '</details>' +
            '</div>';

        // Hide loader when iframe loads
        var iframe = document.getElementById('ext-iframe');
        var loader = document.getElementById('ext-iframe-loading');
        if (iframe) {
            iframe.addEventListener('load', function () {
                if (loader) loader.style.display = 'none';
                iframe.classList.add('loaded');
            });
            // Fallback: hide loader after 15 seconds even if load event doesn't fire
            setTimeout(function () {
                if (loader) loader.style.display = 'none';
                if (iframe) iframe.classList.add('loaded');
            }, 15000);
        }
    }

    window.ExternalTools = {
        render: render,
        switchTool: switchTool,
        getCurrentTool: function () { return currentTool; }
    };

    document.addEventListener('DOMContentLoaded', render);
})();
