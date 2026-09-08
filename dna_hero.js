/*
 * dna_hero.js — dependency-free 3D DNA helix on a 2D canvas (perspective projection, depth shading).
 *   DNA.start(canvas, { ambient: false })  -> handle with stop()
 * Hero mode: bright, rotating helix receding into depth. Ambient mode: faint, slow, behind the dashboard.
 * Honours the OS reduced-motion preference (draws a single static frame).
 */
(function () {
    'use strict';
    function start(canvas, opts) {
        opts = Object.assign({ ambient: false, points: 84, turns: 2.6, speed: 1 }, opts || {});
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let w = 1, h = 1, raf = null, running = true, t = 0;
        const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        function resize() {
            const r = canvas.getBoundingClientRect();
            const nw = Math.max(1, Math.floor(r.width * dpr)), nh = Math.max(1, Math.floor(r.height * dpr));
            if (nw !== w || nh !== h) {
                w = canvas.width = nw; h = canvas.height = nh;   // resizing clears the bitmap: redraw at once
                if (typeof draw === 'function') draw();
            }
        }

        function sphere(x, y, r, depth, alpha) {
            const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
            if (opts.ambient) {
                g.addColorStop(0, 'rgba(219,234,254,' + alpha + ')');
                g.addColorStop(0.55, 'rgba(147,197,253,' + alpha * 0.9 + ')');
                g.addColorStop(1, 'rgba(59,130,246,' + alpha * 0.55 + ')');
            } else {
                g.addColorStop(0, 'rgba(224,242,254,' + alpha + ')');
                g.addColorStop(0.5, 'rgba(96,165,250,' + alpha + ')');
                g.addColorStop(1, 'rgba(30,64,175,' + alpha * 0.85 + ')');
            }
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const n = opts.points, turns = opts.turns;
            const portrait = !opts.ambient && h > w * 1.1;        // phones: smaller helix in the lower part, under the text
            const cx = w * (opts.ambient ? 0.55 : portrait ? 0.5 : 0.58), cy = h * (portrait ? 0.84 : 0.5);
            const span = portrait ? w * 1.9 : w * (opts.ambient ? 1.5 : 1.35);
            const R = portrait ? w * 0.17 : h * (opts.ambient ? 0.22 : 0.26);
            const tilt = opts.ambient ? 0.35 : portrait ? 0.5 : 0.62;   // rotation about the vertical axis: the helix recedes to one side
            const fov = w * 0.75;
            const base = portrait ? w * 0.026 : h * (opts.ambient ? 0.02 : 0.03);
            const pts = [];
            for (let i = 0; i < n; i++) {
                const u = i / (n - 1);
                const x0 = (u - 0.5) * span;
                const ang = u * turns * Math.PI * 2 + t;
                const pair = [];
                for (let s = 0; s < 2; s++) {
                    const a = ang + s * Math.PI;
                    const y0 = Math.sin(a) * R, z0 = Math.cos(a) * R;
                    const x = x0 * Math.cos(tilt), z = z0 + x0 * Math.sin(tilt);
                    const sc = fov / (fov + z + span * 0.6);
                    pair.push({ X: cx + x * sc, Y: cy + y0 * sc, sc: sc, z: z });
                }
                pts.push({ i: i, a: pair[0], b: pair[1], z: (pair[0].z + pair[1].z) / 2 });
            }
            // rungs (every second base pair), far to near
            const rungs = pts.filter(function (p) { return p.i % 2 === 0; }).sort(function (p, q) { return q.z - p.z; });
            rungs.forEach(function (p) {
                const depth = Math.max(0.15, Math.min(1, p.a.sc));
                ctx.strokeStyle = opts.ambient ? 'rgba(147,197,253,' + (0.22 * depth) + ')' : 'rgba(125,183,255,' + (0.55 * depth) + ')';
                ctx.lineWidth = Math.max(0.6, base * 0.28 * depth);
                ctx.beginPath(); ctx.moveTo(p.a.X, p.a.Y); ctx.lineTo(p.b.X, p.b.Y); ctx.stroke();
            });
            // spheres, far to near
            const balls = [];
            pts.forEach(function (p) { balls.push(p.a); balls.push(p.b); });
            balls.sort(function (p, q) { return q.z - p.z; });
            balls.forEach(function (p) {
                const depth = Math.max(0.12, Math.min(1.1, p.sc));
                const alpha = opts.ambient ? 0.35 * depth : Math.min(1, 0.25 + 0.8 * depth);
                sphere(p.X, p.Y, base * depth * 1.05, depth, alpha);
            });
        }
        function loop() {
            if (!running) return;
            draw();
            t += 0.0075 * opts.speed;
            raf = requestAnimationFrame(loop);
        }
        resize();
        window.addEventListener('resize', resize);
        if (reduce) { running = false; draw(); }       // one static frame for reduced-motion users
        else loop();
        return {
            stop: function () { running = false; if (raf) cancelAnimationFrame(raf); window.removeEventListener('resize', resize); },
            resume: function () { if (!running && !reduce) { running = true; loop(); } }
        };
    }
    window.DNA = { start: start };
})();
