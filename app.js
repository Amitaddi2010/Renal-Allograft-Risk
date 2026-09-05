/**
 * AUROS // PGIMER Renal Allograft Risk Terminal
 * Core Application Logic & 3D Bioluminescent Visualizations
 * Primary Model: ElasticNet Logistic Regression (Tier 3 Multimodal, N = 443)
 */

// Cohort Standardization Parameters
const COHORT_STATS = {
    donorAge: { mean: 45.2, sd: 12.1 },
    recipientAge: { mean: 38.4, sd: 11.2 },
    preCreatinine: { mean: 7.45, sd: 2.30 },
    mmA: { mean: 0.95, sd: 0.69 },
    mmB: { mean: 0.98, sd: 0.70 },
    mmDRB1: { mean: 0.82, sd: 0.66 },
    totalMM: { mean: 3.50, sd: 1.66 },
    mcsT: { mean: 13.8, sd: 18.5 },
    mcsB: { mean: 58.2, sd: 52.4 },
    totalEplets: { mean: 4.71, sd: 5.18 }
};

// ElasticNet Standardized Regression Coefficients
const COEFFS = {
    intercept: -1.542,
    donorAge: 0.2773,
    recipientAge: -0.0188,
    siblingDonor: -0.8236, // Protective OR = 0.439
    deceasedDonor: -0.6943,
    standardInduction: 0.6993,
    recipientMale: 0.1713,
    mmA: 0.4497,
    mmB: 0.5006,
    mmDRB1: 0.9327, // Nominal risk driver OR = 2.541
    totalMM: -1.6432, // Regularization constraint
    mcsT: 0.3542, // Flow crossmatch T-cell shift OR = 1.425
    mcsB: 0.1093, // Flow crossmatch B-cell shift
    fcxmQualPositive: 0.4735
};

// Validated Quintile Boundaries
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

function updateTotalMM() {
    const mmA = parseInt(document.getElementById('mm-a').value, 10) || 0;
    const mmB = parseInt(document.getElementById('mm-b').value, 10) || 0;
    const mmDRB1 = parseInt(document.getElementById('mm-drb1').value, 10) || 0;
    document.getElementById('total-mm').value = mmA + mmB + mmDRB1;
}

function updateTotalEplets() {
    const ep1 = parseInt(document.getElementById('eplet-class1') ? document.getElementById('eplet-class1').value : 1, 10) || 0;
    const ep2 = parseInt(document.getElementById('eplet-class2') ? document.getElementById('eplet-class2').value : 1, 10) || 0;
    const totalEl = document.getElementById('total-eplets');
    if (totalEl) totalEl.value = ep1 + ep2;
}

function standardize(val, stat) {
    return (val - stat.mean) / stat.sd;
}

function sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
}

function calculateRisk() {
    const recAge = parseFloat(document.getElementById('recipient-age').value);
    const donorAge = parseFloat(document.getElementById('donor-age').value);
    const donorSource = parseInt(document.getElementById('donor-source').value, 10);
    const siblingDonor = parseInt(document.getElementById('sibling-donor').value, 10);
    const standardInduction = parseInt(document.getElementById('standard-induction').value, 10);
    const gender = parseInt(document.getElementById('gender').value, 10);

    const mmA = parseInt(document.getElementById('mm-a').value, 10);
    const mmB = parseInt(document.getElementById('mm-b').value, 10);
    const mmDRB1 = parseInt(document.getElementById('mm-drb1').value, 10);
    const totalMM = mmA + mmB + mmDRB1;

    const mcsT = parseFloat(document.getElementById('mcs-t').value);
    const mcsB = parseFloat(document.getElementById('mcs-b').value);
    const fcxmQual = parseInt(document.getElementById('fcxm-qual').value, 10);

    // Objective 3: Molecular Eplet Mismatches
    const ep1 = parseInt(document.getElementById('eplet-class1') ? document.getElementById('eplet-class1').value : 1, 10) || 0;
    const ep2 = parseInt(document.getElementById('eplet-class2') ? document.getElementById('eplet-class2').value : 1, 10) || 0;
    const totalEplets = ep1 + ep2;
    const dominantEpletEl = document.getElementById('dominant-eplet');
    const dominantEplet = dominantEpletEl ? parseInt(dominantEpletEl.value, 10) : 0;

    const zDonorAge = standardize(donorAge, COHORT_STATS.donorAge);
    const zRecAge = standardize(recAge, COHORT_STATS.recipientAge);
    const zMMA = standardize(mmA, COHORT_STATS.mmA);
    const zMMB = standardize(mmB, COHORT_STATS.mmB);
    const zMMDRB1 = standardize(mmDRB1, COHORT_STATS.mmDRB1);
    const zTotalMM = standardize(totalMM, COHORT_STATS.totalMM);
    const zMCST = standardize(mcsT, COHORT_STATS.mcsT);
    const zMCSB = standardize(mcsB, COHORT_STATS.mcsB);
    const zTotalEplets = standardize(totalEplets, COHORT_STATS.totalEplets);

    let logOdds = COEFFS.intercept;
    logOdds += COEFFS.donorAge * zDonorAge;
    logOdds += COEFFS.recipientAge * zRecAge;
    logOdds += (siblingDonor === 1) ? COEFFS.siblingDonor : 0;
    logOdds += (donorSource === 1) ? COEFFS.deceasedDonor : 0;
    logOdds += (standardInduction === 1) ? COEFFS.standardInduction : 0;
    logOdds += (gender === 1) ? COEFFS.recipientMale : 0;

    logOdds += COEFFS.mmA * zMMA;
    logOdds += COEFFS.mmB * zMMB;
    logOdds += COEFFS.mmDRB1 * zMMDRB1;
    logOdds += COEFFS.totalMM * zTotalMM;

    logOdds += COEFFS.mcsT * zMCST;
    logOdds += COEFFS.mcsB * zMCSB;
    logOdds += (fcxmQual === 1) ? COEFFS.fcxmQualPositive : 0;

    // Molecular Eplet Repertoire Weight (Phase 3 Objective 3)
    logOdds += 0.082 * zTotalEplets;
    if (dominantEplet === 1) logOdds += 0.120; // Class I dominant target (163LG/65GK)
    if (dominantEplet === 2) logOdds += 0.185; // Class II dominant target (130Q/86G2)
    if (dominantEplet === 3) logOdds += 0.320; // Dual Class high-risk target repertoire

    let predProb = sigmoid(logOdds);
    predProb = Math.max(0.02, Math.min(0.75, predProb));
    const percentStr = (predProb * 100).toFixed(1) + "%";

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
    const protocolList = document.getElementById('protocol-items');
    const recommendations = [...qInfo.recommendations];
    if (totalEplets >= 8 || dominantEplet > 0) {
        const targetDesc = dominantEplet === 1 ? 'Class I (163LG/65GK)' : (dominantEplet === 2 ? 'Class II (130Q/86G2)' : (dominantEplet === 3 ? 'Dual Class (163LG + 130Q)' : 'Elevated Molecular Load'));
        recommendations.push(`<strong>Molecular Eplet Advisory (Obj 3):</strong> ${totalEplets} eplet mismatches with ${targetDesc} specificity. Indication for longitudinal post-Tx Luminex single-antigen bead (SAB) surveillance to monitor for de novo anti-eplet antibody development.`);
    }
    protocolList.innerHTML = recommendations.map(item => `<li>${item}</li>`).join('');
}

function resetDefaults() {
    document.getElementById('recipient-age').value = 38;
    document.getElementById('donor-age').value = 45;
    document.getElementById('donor-source').value = "0";
    document.getElementById('sibling-donor').value = "0";
    document.getElementById('standard-induction').value = "1";
    document.getElementById('pre-creat').value = 7.5;
    document.getElementById('gender').value = "1";

    document.getElementById('mm-a').value = "1";
    document.getElementById('mm-b').value = "1";
    document.getElementById('mm-drb1').value = "1";
    updateTotalMM();

    document.getElementById('mcs-t').value = 12;
    document.getElementById('mcs-b').value = 48;
    document.getElementById('fcxm-qual').value = "0";

    if (document.getElementById('eplet-class1')) document.getElementById('eplet-class1').value = 1;
    if (document.getElementById('eplet-class2')) document.getElementById('eplet-class2').value = 1;
    if (document.getElementById('dominant-eplet')) document.getElementById('dominant-eplet').value = "0";
    updateTotalEplets();

    calculateRisk();
}

/* ==========================================================================
   AUROS 3D BIOLUMINESCENT PARTICLE SPHERE VISUAL
   Teal-cyan and lavender-pink particles orbiting in 3D space
   ========================================================================== */
function initParticleSphere() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const numParticles = 650;
    const radius = Math.min(width, height) * 0.38;
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

        // Center orb in top right / hero quadrant
        const centerX = width * 0.65;
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
   AUROS GEOMETRIC MOLECULAR DIAGRAM (Right Column Illustration)
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

        window.location.hash = 'dashboard';
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

// Handle browser back/forward buttons
window.addEventListener('hashchange', () => {
    if (window.location.hash === '#dashboard') {
        switchView('calculator');
    } else {
        switchView('landing');
    }
});

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    updateTotalMM();
    updateTotalEplets();
    calculateRisk();
    initParticleSphere();
    initMolecularDiagram();

    // Check initial route
    if (window.location.hash === '#dashboard') {
        switchView('calculator');
    } else {
        switchView('landing');
    }
});

