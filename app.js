/**
 * RAMRT // PGIMER Renal Allograft Risk Terminal
 * Core Application Logic & 3D Bioluminescent Visualizations
 * Primary Model: ElasticNet Logistic Regression (Tier 3 Multimodal, N = 443)
 */

// Cohort Standardization Parameters (Derived strictly from Tier 3 Multimodal Cohort, N = 443)
const COHORT_STATS = {
    donorAge: { mean: 46.4086, sd: 9.5739 },
    totalMM: { mean: 3.1716, sd: 1.7463 },
    mmA: { mean: 0.9255, sd: 0.6241 },
    mmB: { mean: 0.9842, sd: 0.6064 },
    mmDRB1: { mean: 0.8330, sd: 0.6438 },
    mmDQB1: { mean: 0.7901, sd: 0.5364 },
    mcsT: { mean: 19.0308, sd: 42.8138 },
    mcsB: { mean: 71.6557, sd: 67.6920 },
    totalEplets: { mean: 4.71, sd: 5.18 }
};

// ElasticNet Standardized Regression Coefficients (Audited Locked 11-Feature Model)
// Intercept is from .intercept_ on fitted ElasticNet (-2.1944)
const COEFFS = {
    intercept: -2.1944,
    donorAge: 0.2773,
    siblingDonor: -0.8236, // Protective OR = 0.439
    deceasedDonor: -0.6943,
    standardInduction: 0.6993,
    totalMM: -1.6432, // Regularization constraint
    mmA: 0.4497,  // HLA-A mismatch OR = 1.568
    mmB: 0.5006,  // HLA-B mismatch OR = 1.650
    mmDRB1: 0.9327, // Primary Class II risk driver OR = 2.541
    mmDQB1: 0.3720, // HLA-DQB1 mismatch OR = 1.451
    mcsT: 0.3542, // Flow crossmatch T-cell shift OR = 1.425
    mcsB: 0.1093  // Flow crossmatch B-cell shift OR = 1.116
};

// Validated Quintile Boundaries (Derived from out-of-fold predicted probabilities in oof_predictions.parquet)
const QUINTILE_BOUNDS = [0.0834, 0.1316, 0.1816, 0.2924];

const QUINTILE_DATA = {
    1: {
        title: "Quintile 1 — Very Low Risk",
        desc: "Observed Rejection in Cohort: 5.6% (5/89) [95% CI: 2.4%–12.5%]",
        recommendations: [
            "<strong>Induction Therapy:</strong> Standard IL-2RA (basiliximab) induction is appropriate; avoid lymphocyte-depleting agents.",
            "<strong>Maintenance Target:</strong> Standard tacrolimus trough (6–8 ng/mL post month 1). Lowest immunological exposure.",
            "<strong>Corticosteroid Protocol:</strong> Candidate for early steroid withdrawal under institutional guidelines.",
            "<strong>Surveillance Protocol:</strong> Routine clinical follow-up; protocol biopsy optional at 12 months."
        ]
    },
    2: {
        title: "Quintile 2 — Low Risk",
        desc: "Observed Rejection in Cohort: 10.2% (9/88) [95% CI: 5.5%–18.3%]",
        recommendations: [
            "<strong>Induction Therapy:</strong> Standard basiliximab (IL-2RA) induction.",
            "<strong>Maintenance Target:</strong> Target tacrolimus trough 7–9 ng/mL through month 3, stepping down to 6–8 ng/mL thereafter.",
            "<strong>Biopsy Protocol:</strong> Protocol biopsy at 6 or 12 months; prompt biopsy for creatinine rise > 20%.",
            "<strong>Humoral Surveillance:</strong> Semi-annual SAB screening to exclude subclinical antibody development."
        ]
    },
    3: {
        title: "Quintile 3 — Moderate Risk",
        desc: "Observed Rejection in Cohort: 20.2% (18/89) [95% CI: 13.2%–29.7%]",
        recommendations: [
            "<strong>Induction Therapy:</strong> Standard basiliximab induction; consider low-dose rATG if donor age > 55 years.",
            "<strong>Maintenance Target:</strong> Maintain strict tacrolimus trough levels between 8–10 ng/mL through month 3.",
            "<strong>Biopsy Protocol:</strong> Protocol biopsy at month 6; prompt indication biopsy for unexplained graft dysfunction.",
            "<strong>Humoral Surveillance:</strong> Longitudinal Luminex SAB monitoring at 3, 6, and 12 months for de novo DSA emergence."
        ]
    },
    4: {
        title: "Quintile 4 — High Risk",
        desc: "Observed Rejection in Cohort: 21.6% (19/88) [95% CI: 14.3%–31.3%]",
        recommendations: [
            "<strong>Induction Therapy:</strong> Strongly consider T-cell depleting induction (rATG, 3.0–4.5 mg/kg total dose).",
            "<strong>Maintenance Target:</strong> Target tacrolimus trough 8–11 ng/mL with mycophenolate mofetil 1.5–2.0 g/day.",
            "<strong>Corticosteroid Protocol:</strong> Maintain continuous low-dose oral prednisolone (5–7.5 mg/day); avoid rapid taper.",
            "<strong>Surveillance Protocol:</strong> Mandatory protocol biopsies at 3 and 6 months post-transplantation."
        ]
    },
    5: {
        title: "Quintile 5 — Extreme Risk",
        desc: "Observed Rejection in Cohort: 36.0% (32/89) [95% CI: 26.8%–46.3%]",
        recommendations: [
            "<strong>Induction Therapy:</strong> Mandatory intensified T-cell depleting induction with rabbit ATG (4.5–6.0 mg/kg total dose).",
            "<strong>Maintenance Target:</strong> Aggressive triple-drug maintenance with therapeutic drug monitoring to prevent subtherapeutic exposure.",
            "<strong>Intensified Surveillance:</strong> Protocol biopsies at 1, 3, and 6 months; quarterly Luminex SAB antibody monitoring.",
            "<strong>Infection Prophylaxis:</strong> Extended cytomegalovirus (valganciclovir) and Pneumocystis jirovecii prophylaxis for 6 months."
        ]
    }
};

function updateTotalEplets() {
    const ep1 = parseInt(document.getElementById('eplet-class1') ? document.getElementById('eplet-class1').value : 1, 10) || 0;
    const ep2 = parseInt(document.getElementById('eplet-class2') ? document.getElementById('eplet-class2').value : 1, 10) || 0;
    const totalEl = document.getElementById('total-eplets');
    if (totalEl) totalEl.value = ep1 + ep2;
}

// Auto-compute Total HLA Mismatches (A + B + DR) and Extended Total (A + B + DR + DQ)
function updateTotalMM() {
    const mmA = parseInt(document.getElementById('mm-a') ? document.getElementById('mm-a').value : 1, 10) || 0;
    const mmB = parseInt(document.getElementById('mm-b') ? document.getElementById('mm-b').value : 1, 10) || 0;
    const mmDR = parseInt(document.getElementById('mm-drb1') ? document.getElementById('mm-drb1').value : 1, 10) || 0;
    const mmDQ = parseInt(document.getElementById('mm-dqb1') ? document.getElementById('mm-dqb1').value : 1, 10) || 0;

    const totalMM = mmA + mmB + mmDR;
    const totalEl = document.getElementById('total-mm');
    if (totalEl) totalEl.value = totalMM;

    const extTotalEl = document.getElementById('extended-total-mm');
    if (extTotalEl) extTotalEl.value = totalMM + mmDQ;
}

function standardize(val, stat) {
    return (val - stat.mean) / stat.sd;
}

function sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
}

function calculateRisk() {
    // 1. Model Covariates: Demographics & Induction
    const donorAge = parseFloat(document.getElementById('donor-age').value);
    const donorSource = parseInt(document.getElementById('donor-source').value, 10);
    const siblingDonor = parseInt(document.getElementById('sibling-donor').value, 10);
    const standardInduction = parseInt(document.getElementById('standard-induction').value, 10);

    // 2. Model Covariates: HLA Mismatch (Per-Locus & Auto-Computed Total MM)
    const mmA = parseInt(document.getElementById('mm-a') ? document.getElementById('mm-a').value : 1, 10);
    const mmB = parseInt(document.getElementById('mm-b') ? document.getElementById('mm-b').value : 1, 10);
    const mmDRB1 = parseInt(document.getElementById('mm-drb1') ? document.getElementById('mm-drb1').value : 1, 10);
    const mmDQB1 = parseInt(document.getElementById('mm-dqb1') ? document.getElementById('mm-dqb1').value : 1, 10);
    
    // Auto-update total inputs
    updateTotalMM();
    const totalMM = mmA + mmB + mmDRB1;

    // 3. Model Covariates: Flow Crossmatch (T-MCS & B-MCS)
    const mcsT = parseFloat(document.getElementById('mcs-t').value);
    const mcsB = parseFloat(document.getElementById('mcs-b') ? document.getElementById('mcs-b').value : 48);

    // Standardize Continuous Predictors via Exact Cohort (N = 443) Parameters
    const zDonorAge = standardize(donorAge, COHORT_STATS.donorAge);
    const zTotalMM = standardize(totalMM, COHORT_STATS.totalMM);
    const zMMA = standardize(mmA, COHORT_STATS.mmA);
    const zMMB = standardize(mmB, COHORT_STATS.mmB);
    const zMMDRB1 = standardize(mmDRB1, COHORT_STATS.mmDRB1);
    const zMMDQB1 = standardize(mmDQB1, COHORT_STATS.mmDQB1);
    const zMCST = standardize(mcsT, COHORT_STATS.mcsT);
    const zMCSB = standardize(mcsB, COHORT_STATS.mcsB);

    // Linear Predictor: Locked 11-Feature ElasticNet Equation
    let logOdds = COEFFS.intercept;
    logOdds += COEFFS.donorAge * zDonorAge;
    logOdds += (siblingDonor === 1) ? COEFFS.siblingDonor : 0;
    logOdds += (donorSource === 1) ? COEFFS.deceasedDonor : 0;
    logOdds += (standardInduction === 1) ? COEFFS.standardInduction : 0;
    logOdds += COEFFS.totalMM * zTotalMM;
    logOdds += COEFFS.mmA * zMMA;
    logOdds += COEFFS.mmB * zMMB;
    logOdds += COEFFS.mmDRB1 * zMMDRB1;
    logOdds += COEFFS.mmDQB1 * zMMDQB1;
    logOdds += COEFFS.mcsT * zMCST;
    logOdds += COEFFS.mcsB * zMCSB;

    // Unclamped Probability Formulation
    const predProb = sigmoid(logOdds);
    const percentStr = (predProb * 100).toFixed(1) + "%";

    // Direct Quintile Lookup on Unclamped Calibrated Probability
    let quintile = 1;
    if (predProb <= QUINTILE_BOUNDS[0]) {
        quintile = 1;
    } else if (predProb <= QUINTILE_BOUNDS[1]) {
        quintile = 2;
    } else if (predProb <= QUINTILE_BOUNDS[2]) {
        quintile = 3;
    } else if (predProb <= QUINTILE_BOUNDS[3]) {
        quintile = 4;
    } else {
        quintile = 5;
    }

    const qInfo = QUINTILE_DATA[quintile];

    // Update Result Hero Display
    document.getElementById('risk-percent').textContent = percentStr;
    document.getElementById('quintile-title').textContent = qInfo.title;
    document.getElementById('quintile-subtext').textContent = qInfo.desc;

    // Update Table Highlighting
    for (let i = 1; i <= 5; i++) {
        const row = document.getElementById(`row-q${i}`);
        if (i === quintile) {
            row.className = "active-stratum";
            const firstCell = row.cells[0];
            if (!firstCell.querySelector('.active-pill')) {
                firstCell.innerHTML = `<span class="active-pill"></span><strong>${firstCell.textContent.trim()}</strong>`;
            }
        } else {
            row.className = "";
            const firstCell = row.cells[0];
            const pill = firstCell.querySelector('.active-pill');
            if (pill) {
                firstCell.innerHTML = `<span class="stratum-bullet"></span>${firstCell.textContent.trim()}`;
            }
        }
    }

    // Update Protocol Items (integrating Eplet Advisory)
    const ep1 = parseInt(document.getElementById('eplet-class1') ? document.getElementById('eplet-class1').value : 1, 10) || 0;
    const ep2 = parseInt(document.getElementById('eplet-class2') ? document.getElementById('eplet-class2').value : 1, 10) || 0;
    const totalEplets = ep1 + ep2;
    const dominantEpletEl = document.getElementById('dominant-eplet');
    const dominantEplet = dominantEpletEl ? parseInt(dominantEpletEl.value, 10) : 0;

    const protocolList = document.getElementById('protocol-items');
    const recommendations = [...qInfo.recommendations];
    if (totalEplets >= 8 || dominantEplet > 0) {
        const targetDesc = dominantEplet === 1 ? 'Class I (163LG/65GK)' : (dominantEplet === 2 ? 'Class II (130Q/86G2)' : (dominantEplet === 3 ? 'Dual Class (163LG + 130Q)' : 'Elevated Molecular Load'));
        recommendations.push(`<strong>Molecular Eplet Advisory (Objective 3):</strong> ${totalEplets} total eplet mismatches with ${targetDesc} specificity. <em>Clinical Context:</em> In the audited PGIMER cohort, numerical eplet burden alone does not predict acute cellular rejection (AUC = 0.501, Objective 3 locked result), but guides longitudinal Luminex single-antigen bead (SAB) surveillance at 3, 6, and 12 months to detect de novo anti-eplet DSA development.`);
    }
    protocolList.innerHTML = recommendations.map(item => `<li>${item}</li>`).join('');
    if (window.UX && typeof UX.afterRisk === 'function') UX.afterRisk();
}

function resetDefaults() {
    document.getElementById('donor-age').value = 46;
    document.getElementById('donor-source').value = "0";
    document.getElementById('sibling-donor').value = "0";
    document.getElementById('standard-induction').value = "1";

    if (document.getElementById('mm-a')) document.getElementById('mm-a').value = "1";
    if (document.getElementById('mm-b')) document.getElementById('mm-b').value = "1";
    if (document.getElementById('mm-drb1')) document.getElementById('mm-drb1').value = "1";
    if (document.getElementById('mm-dqb1')) document.getElementById('mm-dqb1').value = "1";
    updateTotalMM();

    document.getElementById('mcs-t').value = 12;

    if (document.getElementById('mcs-b')) document.getElementById('mcs-b').value = 48;
    if (document.getElementById('recipient-age')) document.getElementById('recipient-age').value = 38;
    if (document.getElementById('pre-creat')) document.getElementById('pre-creat').value = 7.5;
    if (document.getElementById('gender')) document.getElementById('gender').value = "1";
    if (document.getElementById('eplet-class1')) document.getElementById('eplet-class1').value = 1;
    if (document.getElementById('eplet-class2')) document.getElementById('eplet-class2').value = 1;
    if (document.getElementById('dominant-eplet')) document.getElementById('dominant-eplet').value = "0";
    updateTotalEplets();

    calculateRisk();
}

/* ==========================================================================
   RESPONSIVE HAMBURGER NAVIGATION CONTROLLER
   ========================================================================== */
function toggleNav() {
    const navLinks = document.getElementById('nav-links');
    const hamburger = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('nav-overlay');
    
    if (navLinks && hamburger) {
        const isOpen = navLinks.classList.toggle('open');
        hamburger.classList.toggle('active', isOpen);
        if (overlay) {
            if (isOpen) {
                overlay.style.display = 'block';
                requestAnimationFrame(() => overlay.classList.add('visible'));
            } else {
                overlay.classList.remove('visible');
                setTimeout(() => { overlay.style.display = 'none'; }, 300);
            }
        }
        // Prevent body scroll when drawer is open
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }
}

function closeNav() {
    const navLinks = document.getElementById('nav-links');
    const hamburger = document.getElementById('hamburger-btn');
    const overlay = document.getElementById('nav-overlay');
    
    if (navLinks) navLinks.classList.remove('open');
    if (hamburger) hamburger.classList.remove('active');
    if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
    document.body.style.overflow = '';
}

// Close drawer on window resize past mobile breakpoint
window.addEventListener('resize', () => {
    if (window.innerWidth > 860) {
        closeNav();
    }
});

/* ==========================================================================
   RAMRT 3D BIOLUMINESCENT PARTICLE SPHERE VISUAL
   Teal-cyan and lavender-pink particles orbiting in 3D space
   ========================================================================== */
function initParticleSphere() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    if (window.__ramrtStopAnim) return;          // reduced-motion preference (see ux.js)
    window.__ramrtAnimRunning = true;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    // Reduce particles on mobile for performance
    const isMobile = window.innerWidth < 640;
    const numParticles = isMobile ? 300 : 650;
    const radius = Math.min(width, height) * (isMobile ? 0.32 : 0.38);
    const particles = [];

    // Distribute particles across sphere surface via Fibonacci lattice
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < numParticles; i++) {
        const theta = 2 * Math.PI * i / goldenRatio;
        const phi = Math.acos(1 - 2 * (i + 0.5) / numParticles);
        particles.push({
            x: radius * Math.cos(theta) * Math.sin(phi),
            y: radius * Math.sin(theta) * Math.sin(phi),
            z: radius * Math.cos(phi),
            baseRadius: 1 + Math.random() * 1.5,
            isPink: Math.random() > 0.85 // 15% lavender-pink particles
        });
    }

    let angleX = 0.001;
    let angleY = 0.002;

    function render() {
        ctx.clearRect(0, 0, width, height);
        if (window.__ramrtStopAnim) { window.__ramrtAnimRunning = false; return; }   // stop when motion is switched off

        // Center orb — shift towards right on desktop, center on mobile
        const centerX = width < 640 ? width * 0.5 : width * 0.65;
        const centerY = height * 0.42;

        const cosX = Math.cos(angleX);
        const sinX = Math.sin(angleX);
        const cosY = Math.cos(angleY);
        const sinY = Math.sin(angleY);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // 3D Rotations
            const y1 = p.y * cosX - p.z * sinX;
            const z1 = p.z * cosX + p.y * sinX;

            const x2 = p.x * cosY + z1 * sinY;
            const z2 = z1 * cosY - p.x * sinY;

            p.x = x2;
            p.y = y1;
            p.z = z2;

            // Perspective Projection
            const fov = 400;
            const scale = fov / (fov + z2);
            const x2d = centerX + x2 * scale;
            const y2d = centerY + y1 * scale;

            // Opacity based on depth (water immersion)
            const alpha = Math.max(0.08, Math.min(0.8, (z2 + radius) / (2 * radius)));

            ctx.beginPath();
            ctx.arc(x2d, y2d, p.baseRadius * scale, 0, Math.PI * 2);

            if (p.isPink) {
                // Lavender Phosphor
                ctx.fillStyle = `rgba(253, 233, 255, ${alpha * 0.9})`;
            } else {
                // Teal-Cyan
                ctx.fillStyle = `rgba(203, 255, 252, ${alpha * 0.75})`;
            }
            ctx.fill();
        }

        requestAnimationFrame(render);
    }

    render();
}

/* ==========================================================================
   RAMRT GEOMETRIC MOLECULAR DIAGRAM (Right Column Illustration)
   White/silver circles and thin connector lines forming abstract topology
   ========================================================================== */
function initMolecularDiagram() {
    const canvas = document.getElementById('molecule-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 450;
    canvas.height = 260;

    const w = canvas.width;
    const h = canvas.height;

    // Fixed geometric topology points representing the immunogenetic axes
    const nodes = [
        { x: w * 0.20, y: h * 0.45, r: 8, label: "PD-L1", color: "#edfffe" },
        { x: w * 0.40, y: h * 0.25, r: 12, label: "FCXM", color: "#ffffff" },
        { x: w * 0.45, y: h * 0.70, r: 10, label: "DRB1", color: "#edfffe" },
        { x: w * 0.65, y: h * 0.35, r: 16, label: "SENESCENCE", color: "#fde9ff" }, // Lavender pink anchor
        { x: w * 0.80, y: h * 0.65, r: 9, label: "EPLET", color: "#ffffff" },
        { x: w * 0.85, y: h * 0.20, r: 6, label: "TCR", color: "#bbc7c6" },
        { x: w * 0.15, y: h * 0.75, r: 5, label: "CTLA4", color: "#bbc7c6" }
    ];

    const edges = [
        [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 4], [3, 5], [2, 6], [0, 6]
    ];

    ctx.clearRect(0, 0, w, h);

    // Draw Edges (Thin silver connector lines)
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    edges.forEach(([i, j]) => {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
    });

    // Draw Nodes (Flat circles with no fills, just clean outlines and solid cores)
    nodes.forEach(node => {
        // Outer ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Node center
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Uppercase tracked label
        ctx.font = "10px 'DM Sans', sans-serif";
        ctx.fillStyle = "#bbc7c6";
        ctx.letterSpacing = "1.5px";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + node.r + 16);
    });
}

/* ==========================================================================
   VIEW SWITCHING & NAVIGATION CONTROLLER (Landing Page <-> Calculator Dashboard)
   ========================================================================== */
function switchView(viewName) {
    const landingView = document.getElementById('landing-view');
    const calcView = document.getElementById('calculator-view');
    const navLanding = document.getElementById('nav-btn-landing');
    const navCalc = document.getElementById('nav-btn-calc');
    const navLaunchBtn = document.getElementById('nav-launch-btn');

    if (viewName === 'calculator') {
        landingView.classList.remove('active-view');
        calcView.classList.add('active-view');

        if (navLanding) navLanding.classList.remove('active');
        if (navCalc) navCalc.classList.add('active');
        if (navLaunchBtn) {
            navLaunchBtn.innerHTML = '<span>← VIEW OVERVIEW</span><span>↗</span>';
            navLaunchBtn.onclick = () => switchView('landing');
            navLaunchBtn.style.display = 'inline-flex';
        }

        if (!/^#(dashboard|hla)/.test(window.location.hash)) window.location.hash = 'dashboard';
        calculateRisk();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        calcView.classList.remove('active-view');
        landingView.classList.add('active-view');

        if (navCalc) navCalc.classList.remove('active');
        if (navLanding) navLanding.classList.add('active');
        if (navLaunchBtn) {
            navLaunchBtn.innerHTML = '<span>ENTER CALCULATOR</span><span>↗</span>';
            navLaunchBtn.onclick = () => switchView('calculator');
            navLaunchBtn.style.display = 'inline-flex';
        }

        window.location.hash = 'landing';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function scrollToSection(sectionId) {
    const landingView = document.getElementById('landing-view');
    if (!landingView.classList.contains('active-view')) {
        switchView('landing');
    }
    setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

/* ==========================================================================
   CALCULATOR TAB SWITCHER (NOMOGRAM vs IMMUNOGENIC EPLET ADVISORY)
   ========================================================================== */
function switchCalculatorTab(tabName) {
    const tabNomogram = document.getElementById('calc-tab-nomogram');
    const tabEplet = document.getElementById('calc-tab-eplet');
    const paneNomogram = document.getElementById('pane-nomogram');
    const paneEplet = document.getElementById('pane-eplet');

    if (tabName === 'eplet') {
        if (tabNomogram) tabNomogram.classList.remove('active');
        if (tabEplet) tabEplet.classList.add('active');
        if (paneNomogram) paneNomogram.classList.add('hidden-tab');
        if (paneEplet) paneEplet.classList.remove('hidden-tab');
        if (window.HLAUI) HLAUI.recalculate();
        if (!/^#hla/.test(window.location.hash)) window.location.hash = 'hla';
    } else {
        if (tabEplet) tabEplet.classList.remove('active');
        if (tabNomogram) tabNomogram.classList.add('active');
        if (paneEplet) paneEplet.classList.add('hidden-tab');
        if (paneNomogram) paneNomogram.classList.remove('hidden-tab');
        calculateRisk();
        if (/^#hla/.test(window.location.hash)) window.location.hash = 'dashboard';
    }
}

function updateAdvisoryEplets() {
    const epABC = parseInt(document.getElementById('adv-eplet-abc') ? document.getElementById('adv-eplet-abc').value : 0, 10) || 0;
    const epDR = parseInt(document.getElementById('adv-eplet-dr') ? document.getElementById('adv-eplet-dr').value : 0, 10) || 0;
    const epDQ = parseInt(document.getElementById('adv-eplet-dq') ? document.getElementById('adv-eplet-dq').value : 0, 10) || 0;
    const totalAdv = epABC + epDR + epDQ;

    const totalEl = document.getElementById('adv-eplet-total');
    if (totalEl) totalEl.value = totalAdv;

    // Check specific dominant targets (163LG, 65GK, 130Q, 86G2)
    const t163LG = document.getElementById('target-163lg') ? document.getElementById('target-163lg').checked : false;
    const t65GK = document.getElementById('target-65gk') ? document.getElementById('target-65gk').checked : false;
    const t130Q = document.getElementById('target-130q') ? document.getElementById('target-130q').checked : false;
    const t86G2 = document.getElementById('target-86g2') ? document.getElementById('target-86g2').checked : false;

    const matchedList = [];
    if (t163LG) matchedList.push('163LG (Class I Dominant)');
    if (t65GK) matchedList.push('65GK (Class I High-Frequency)');
    if (t130Q) matchedList.push('130Q (Class II Dominant)');
    if (t86G2) matchedList.push('86G2 (Class II High-Frequency)');

    const targetsContainer = document.getElementById('adv-matched-targets');
    if (targetsContainer) {
        if (matchedList.length > 0) {
            targetsContainer.innerHTML = matchedList.map(t => `<span class="eplet-tag-pill eplet-tag-matched">✓ ${t}</span>`).join(' ');
        } else {
            targetsContainer.innerHTML = '<span class="eplet-tag-pill eplet-tag-unmatched">No dominant clinical targets selected</span>';
        }
    }

    const summaryText = document.getElementById('adv-eplet-summary-text');
    if (summaryText) {
        let text = `<strong>Cataloged Molecular Burden:</strong> ${totalAdv} total immunogenic eplet mismatches (${epABC} ABC, ${epDR} DR, ${epDQ} DQ). `;
        if (matchedList.length > 0) {
            text += `Includes high-frequency clinical targets: <strong>${matchedList.join(', ')}</strong>. Recommend tailored post-transplant Luminex single-antigen bead (SAB) monitoring at 3, 6, and 12 months for donor-specific anti-eplet antibody emergence.`;
        } else {
            text += `Standard institutional post-transplant surveillance protocol applies.`;
        }
        summaryText.innerHTML = text;
    }
}

// Deep links: #landing, #dashboard (risk calculator), #hla (HLA & eplet analysis), #hla-example (with the example pair)
function routeFromHash() {
    const h = window.location.hash;
    if (h === '#hla' || h === '#hla-example' || h === '#hla-grid-example' || h === '#hla-3d-example') {
        switchView('calculator');
        switchCalculatorTab('eplet');
        if (h !== '#hla' && window.HLAUI) HLAUI.loadExample();
        if (h === '#hla-grid-example' && window.HLAUI) HLAUI.setMode('grid');
        if (h === '#hla-3d-example' && window.HLA3D) setTimeout(function () { HLA3D.showFirstWithMismatches(); }, 50);
    } else if (h === '#dashboard') {
        switchView('calculator');
    } else {
        switchView('landing');
    }
}

// Handle browser back/forward buttons
window.addEventListener('hashchange', () => {
    routeFromHash();
});

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    updateTotalEplets();
    calculateRisk();
    initParticleSphere();
    initMolecularDiagram();

    // Check initial route
    routeFromHash();
});

