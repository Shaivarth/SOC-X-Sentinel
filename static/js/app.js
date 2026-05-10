/**
 * SOC-X SENTINEL PLATFORM — app.js
 * Main JavaScript for SOC-X dashboard interface
 */

'use strict';

/* ── GLOBAL STATE ─────────────────────────────────────────────── */
const SOC = {
    data: window.SOC_DATA || { total: 0, critical: 0, high: 0, medium: 0, low: 0, alerts: [] },
    autoRefresh: true,
    refreshInterval: null,
    refreshDelay: 2000,  // 2s
    activeFilter: 'ALL',
    searchQuery: '',
    charts: {},
    liveBuffer: [],

    initialized: false,
    knownAlerts: new Set(),
};

/* ── DOM READY ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initTopbar();
    initCharts();
    initAlertFeed();
    initSearch();
    initFilters();
    initNotifications();
    initStatusBar();
    startAutoRefresh();
    updateThreatLevel();
    animateLiveChart();
});

/* ══════════════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════════════ */
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle  = document.getElementById('sidebarToggle');
    const wrapper = document.getElementById('mainWrapper');

    if (!sidebar || !toggle) return;

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        wrapper.classList.toggle('sidebar-collapsed');
    });

    // Nav item clicks
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            // If it's an anchor, let default scroll happen
        });
    });

    // Mobile menu
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            sidebar.style.display = sidebar.style.display === 'flex' ? 'none' : 'flex';
        });
    }
}

/* ══════════════════════════════════════════════════════════════
   TOPBAR — refresh, search, auto-refresh toggle
══════════════════════════════════════════════════════════════ */
function initTopbar() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('spinning');
            fetchAndRefresh().finally(() => {
                setTimeout(() => refreshBtn.classList.remove('spinning'), 800);
            });
        });
    }

    // Auto-refresh toggle
    const autoToggle = document.getElementById('autoRefreshToggle');
    if (autoToggle) {
        SOC.autoRefresh = autoToggle.checked;
        autoToggle.addEventListener('change', () => {
            SOC.autoRefresh = autoToggle.checked;
            if (SOC.autoRefresh) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });
    }

    // Global search (synced with alert search)
    const globalSearch = document.getElementById('globalSearch');
    const alertSearch  = document.getElementById('alertSearch');

    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            SOC.searchQuery = e.target.value.toLowerCase();
            if (alertSearch) alertSearch.value = e.target.value;
            applyFilters();
        });
    }
}

/* ══════════════════════════════════════════════════════════════
   AUTO REFRESH
══════════════════════════════════════════════════════════════ */
function startAutoRefresh() {
    stopAutoRefresh();
    if (SOC.autoRefresh) {
        SOC.refreshInterval = setInterval(fetchAndRefresh, SOC.refreshDelay);
    }
}

function stopAutoRefresh() {
    if (SOC.refreshInterval) {
        clearInterval(SOC.refreshInterval);
        SOC.refreshInterval = null;
    }
}

async function fetchAndRefresh() {
    try {
        const [alertsRes, statsRes] = await Promise.all([
            fetch('/api/alerts'),
            fetch('/api/stats')
        ]);

        if (!alertsRes.ok || !statsRes.ok) return;

        const alerts = await alertsRes.json();
        const stats  = await statsRes.json();

        SOC.data.alerts   = alerts;
        SOC.data.total    = stats.total;
        SOC.data.critical = stats.critical;
        SOC.data.high     = stats.high;
        SOC.data.medium   = stats.medium;
        SOC.data.low      = stats.low;

        updateMetrics(stats);
        updateChartData(stats);
        if (!SOC.initialized) {

    renderAlertFeed(alerts);

    alerts.forEach(alert => {
        SOC.knownAlerts.add(alert.alert_id);
    });

    SOC.initialized = true;

} else {

    const trulyNewAlerts = alerts.filter(alert =>
        !SOC.knownAlerts.has(alert.alert_id)
    );

    trulyNewAlerts.forEach(alert => {
        SOC.knownAlerts.add(alert.alert_id);
    });

    prependNewAlerts(trulyNewAlerts);
}
        updateThreatLevel();
        updateSidebarCount(stats.total);

    } catch (err) {
        console.warn('[SOC-X] Refresh failed:', err);
    }
}

function updateMetrics(stats) {
    animateCount('metricTotal',     stats.total    ?? 0);
    animateCount('metricCritical',  stats.critical ?? 0);
    animateCount('metricHigh',      stats.high     ?? 0);
    animateCount('metricMedium',    stats.medium   ?? 0);
    animateCount('metricAttackers', stats.unique_attackers ?? 0);

    // Update bar widths
    if (stats.total > 0) {
        setBarWidth('.red-fill',    (stats.critical / stats.total * 100));
        setBarWidth('.orange-fill', (stats.high     / stats.total * 100));
        setBarWidth('.yellow-fill', (stats.medium   / stats.total * 100));
    }

    document.getElementById('sbAlertCount').textContent = stats.total ?? 0;
    document.getElementById('donutTotal').textContent   = stats.total ?? 0;
    document.getElementById('notifBadge').textContent   = stats.critical ?? 0;

    const sidebarCount = document.getElementById('sidebar-alert-count');
    if (sidebarCount) sidebarCount.textContent = stats.total ?? 0;
}

function updateSidebarCount(total) {
    const el = document.getElementById('sidebar-alert-count');
    if (el) el.textContent = total;
}

function setBarWidth(selector, pct) {
    document.querySelectorAll(selector).forEach(el => {
        el.style.width = Math.min(100, Math.max(0, pct)) + '%';
    });
}

/* ══════════════════════════════════════════════════════════════
   ANIMATED COUNTER
══════════════════════════════════════════════════════════════ */
function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;

    const start    = parseInt(el.textContent.replace(/\D/g, '')) || 0;
    const duration = 600;
    const startTs  = performance.now();

    function step(ts) {
        const elapsed = ts - startTs;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * ease);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/* ══════════════════════════════════════════════════════════════
   THREAT LEVEL BADGE
══════════════════════════════════════════════════════════════ */
function updateThreatLevel() {
    const badge = document.getElementById('threatLevelBadge');
    if (!badge) return;

    const { critical, high, total } = SOC.data;
    let level, color;

    if (critical > 5 || (total > 0 && critical / total > 0.3)) {
        level = 'CRITICAL'; color = 'var(--red)';
    } else if (critical > 0 || high > 10) {
        level = 'HIGH'; color = 'var(--orange)';
    } else if (high > 0) {
        level = 'ELEVATED'; color = 'var(--yellow)';
    } else {
        level = 'LOW'; color = 'var(--green)';
    }

    badge.textContent = level;
    badge.style.color = color;
}

/* ══════════════════════════════════════════════════════════════
   CHARTS
══════════════════════════════════════════════════════════════ */
function initCharts() {
    const defaults = {
        color: '#7b93b0',
        borderColor: '#1a2d4a',
        font: { family: "'Share Tech Mono', monospace", size: 10 },
    };

    Chart.defaults.color       = defaults.color;
    Chart.defaults.borderColor = defaults.borderColor;
    Chart.defaults.font        = defaults.font;

    buildTimelineChart();
    buildSeverityDonut();
    buildAttackVectorChart();
    buildLiveEventChart();
}

function buildTimelineChart() {
    const ctx = document.getElementById('alertTimelineChart');
    if (!ctx) return;

    const labels = generateHourLabels(12);
    const critData = generateMockTrend(12, SOC.data.critical);
    const highData = generateMockTrend(12, SOC.data.high);

    SOC.charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Critical',
                    data: critData,
                    borderColor: 'rgba(255,59,59,0.9)',
                    backgroundColor: 'rgba(255,59,59,0.08)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: 'rgba(255,59,59,0.9)',
                },
                {
                    label: 'High',
                    data: highData,
                    borderColor: 'rgba(255,140,0,0.85)',
                    backgroundColor: 'rgba(255,140,0,0.06)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: 'rgba(255,140,0,0.85)',
                },
                {
                    label: 'Total',
                    data: generateMockTrend(12, SOC.data.total, 0.7),
                    borderColor: 'rgba(0,212,255,0.6)',
                    backgroundColor: 'rgba(0,212,255,0.04)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { boxWidth: 10, padding: 12 }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,17,32,0.95)',
                    borderColor: '#1a2d4a',
                    borderWidth: 1,
                    padding: 10,
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(26,45,74,0.5)' },
                    ticks: { maxRotation: 0 },
                },
                y: {
                    grid: { color: 'rgba(26,45,74,0.5)' },
                    beginAtZero: true,
                    ticks: { precision: 0 },
                }
            }
        }
    });
}

function buildSeverityDonut() {
    const ctx = document.getElementById('severityDonutChart');
    if (!ctx) return;

    const { critical, high, medium, low } = SOC.data;

    SOC.charts.donut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Critical', 'High', 'Medium', 'Low'],
            datasets: [{
                data: [critical || 0, high || 0, medium || 0, low || 0],
                backgroundColor: [
                    'rgba(255,59,59,0.85)',
                    'rgba(255,140,0,0.85)',
                    'rgba(245,197,24,0.85)',
                    'rgba(59,130,246,0.85)',
                ],
                borderColor: [
                    'rgba(255,59,59,0.3)',
                    'rgba(255,140,0,0.3)',
                    'rgba(245,197,24,0.3)',
                    'rgba(59,130,246,0.3)',
                ],
                borderWidth: 1,
                hoverOffset: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 10, boxWidth: 8 }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,17,32,0.95)',
                    borderColor: '#1a2d4a',
                    borderWidth: 1,
                }
            }
        }
    });
}

function buildAttackVectorChart() {
    const ctx = document.getElementById('attackVectorChart');
    if (!ctx) return;

    // Build from real alert type data if available
    const typeMap = {};
    SOC.data.alerts.forEach(a => {
        const t = a.alert_type || 'Unknown';
        typeMap[t] = (typeMap[t] || 0) + 1;
    });

    let labels = Object.keys(typeMap);
    let values = Object.values(typeMap);

    // Fallback if no data
    if (labels.length === 0) {
        labels = ['Brute Force', 'Cred Stuffing', 'Port Scan', 'Login Flood', 'Other'];
        values = [0, 0, 0, 0, 0];
    }

    // Truncate long labels
    const shortLabels = labels.map(l => l.length > 18 ? l.substring(0, 16) + '…' : l);

    SOC.charts.vector = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: shortLabels,
            datasets: [{
                label: 'Occurrences',
                data: values,
                backgroundColor: 'rgba(0,212,255,0.18)',
                borderColor: 'rgba(0,212,255,0.7)',
                borderWidth: 1,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(0,212,255,0.35)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10,17,32,0.95)',
                    borderColor: '#1a2d4a',
                    borderWidth: 1,
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(26,45,74,0.5)' },
                    beginAtZero: true,
                    ticks: { precision: 0 },
                },
                y: {
                    grid: { color: 'rgba(26,45,74,0.3)' },
                }
            }
        }
    });
}

/* Live event sparkline */
function buildLiveEventChart() {
    const ctx = document.getElementById('liveEventChart');
    if (!ctx) return;

    const points = 20;
    SOC.liveBuffer = Array.from({ length: points }, () => Math.floor(Math.random() * 8));
    const labels   = Array.from({ length: points }, (_, i) => '');

    SOC.charts.live = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Events/s',
                data: [...SOC.liveBuffer],
                borderColor: 'rgba(0,230,118,0.8)',
                backgroundColor: 'rgba(0,230,118,0.07)',
                fill: true,
                tension: 0.4,
                borderWidth: 1.5,
                pointRadius: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: {
                    grid: { color: 'rgba(26,45,74,0.4)' },
                    beginAtZero: true,
                    max: 20,
                    ticks: { precision: 0, maxTicksLimit: 4 },
                }
            }
        }
    });
}

function animateLiveChart() {
    setInterval(() => {
        if (!SOC.charts.live) return;
        const newVal = Math.floor(Math.random() * 12);
        SOC.liveBuffer.push(newVal);
        SOC.liveBuffer.shift();

        SOC.charts.live.data.datasets[0].data = [...SOC.liveBuffer];
        SOC.charts.live.update('none');
    }, 1500);
}

function updateChartData(stats) {
    if (SOC.charts.donut) {
        SOC.charts.donut.data.datasets[0].data = [
            stats.critical || 0,
            stats.high     || 0,
            stats.medium   || 0,
            stats.low      || 0,
        ];
        SOC.charts.donut.update();
    }

    if (SOC.charts.vector && SOC.data.alerts.length) {
        const typeMap = {};
        SOC.data.alerts.forEach(a => {
            const t = a.alert_type || 'Unknown';
            typeMap[t] = (typeMap[t] || 0) + 1;
        });
        SOC.charts.vector.data.labels   = Object.keys(typeMap).map(l => l.length > 18 ? l.substring(0,16)+'…' : l);
        SOC.charts.vector.data.datasets[0].data = Object.values(typeMap);
        SOC.charts.vector.update();
    }
}

/* ══════════════════════════════════════════════════════════════
   ALERT FEED
══════════════════════════════════════════════════════════════ */
function initAlertFeed() {
    // Expand / collapse alert detail panels
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.expand-btn');
        if (!btn) return;

        const idx    = btn.dataset.idx;
        const panel  = document.getElementById('detail-' + idx);
        const isOpen = btn.classList.contains('open');

        // Close all
        document.querySelectorAll('.alert-detail-panel').forEach(p => p.classList.remove('open'));
        document.querySelectorAll('.expand-btn').forEach(b => { b.classList.remove('open'); b.textContent = 'Details'; });

        if (!isOpen && panel) {
            panel.classList.add('open');
            btn.classList.add('open');
            btn.textContent = 'Close';
        }
    });

    // Detail action buttons (visual feedback only)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.detail-action-btn');
        if (!btn) return;
        const original = btn.textContent;
        btn.textContent = '✓ Done';
        btn.disabled = true;
        setTimeout(() => {
            btn.textContent = original;
            btn.disabled = false;
        }, 1500);
    });
}

function renderAlertFeed(alerts) {

    const feed = document.getElementById('alertFeed');

    if (!feed) return;

    if (!alerts.length) {

        if (!feed.dataset.initialized) {

            feed.innerHTML = `
                <div class="no-alerts">
                    <div class="no-alerts-icon">✓</div>
                    <div>No alerts detected</div>
                    <div class="no-alerts-sub">
                        System nominal — monitoring active
                    </div>
                </div>
            `;
        }

        return;
    }

    if (!feed.dataset.initialized) {

        const fragment = document.createDocumentFragment();

        alerts.forEach((alert, idx) => {

            const row = createAlertRow(alert, idx + 1);

            row.dataset.alertId = alert.alert_id || idx;

            fragment.appendChild(row);
        });

        feed.innerHTML = '';

        feed.appendChild(fragment);

        feed.dataset.initialized = 'true';
    }

    applyFilters();
}

function prependNewAlerts(alerts) {

    const feed = document.getElementById('alertFeed');

    if (!feed) return;

    alerts.reverse().forEach((alert, idx) => {

        const existing = feed.querySelector(
            `[data-alert-id="${alert.alert_id}"]`
        );

        if (existing) return;

        const row = createAlertRow(alert, idx + 1);

        row.dataset.alertId = alert.alert_id;

        row.style.opacity = '0';
        row.style.transform = 'translateY(-10px)';

        feed.prepend(row);

        requestAnimationFrame(() => {

            row.style.transition =
                'opacity 0.3s ease, transform 0.3s ease';

            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        });
    });

    while (feed.children.length > 50) {

        feed.removeChild(feed.lastChild);
    }
}

function createAlertRow(alert, idx) {
    const sev   = (alert.severity || 'LOW').toLowerCase();
    const user  = alert.username  || '—';
    const atype = alert.alert_type|| 'Unknown';
    const ts    = alert.timestamp || '—';

    const row = document.createElement('div');
    row.className = `alert-row severity-${sev}`;
    row.dataset.severity  = (alert.severity || '').toUpperCase();
    row.dataset.username  = user;
    row.dataset.type      = atype;
    row.dataset.timestamp = ts;

    row.innerHTML = `
        <div class="alert-row-severity">
            <span class="sev-badge sev-${sev}">
                ${sev === 'critical' ? '<span class="sev-blink">●</span>' : ''}
                ${(alert.severity || 'LOW')}
            </span>
        </div>
        <div class="alert-row-type">
            <span class="alert-type-icon">⚡</span>
            <span class="alert-type-text">${escHtml(atype)}</span>
        </div>
        <div class="alert-row-user">
            <div class="user-chip">
                <span class="user-initial">${escHtml(user.charAt(0).toUpperCase())}</span>
                <span class="user-name">${escHtml(user)}</span>
            </div>
        </div>
        <div class="alert-row-time">
            <span class="ts-text">${escHtml(ts)}</span>
        </div>
        <div class="alert-row-action">
            <button class="expand-btn" data-idx="${idx}">Details</button>
        </div>
        <div class="alert-detail-panel" id="detail-${idx}">
            <div class="detail-grid">
                <div class="detail-field">
                    <span class="detail-label">Alert ID</span>
                    <span class="detail-val">#SOC-${String(idx).padStart(5,'0')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Severity</span>
                    <span class="detail-val sev-${sev}">${escHtml(alert.severity || '')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Type</span>
                    <span class="detail-val">${escHtml(atype)}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">User</span>
                    <span class="detail-val">${escHtml(user)}</span>
                </div>
                ${alert.source_ip ? `
                <div class="detail-field">
                    <span class="detail-label">Source IP</span>
                    <span class="detail-val mono">${escHtml(alert.source_ip)}</span>
                </div>` : ''}
                <div class="detail-field">
                    <span class="detail-label">Timestamp</span>
                    <span class="detail-val mono">${escHtml(ts)}</span>
                </div>
                ${alert.attempts ? `
                <div class="detail-field">
                    <span class="detail-label">Attempts</span>
                    <span class="detail-val">${escHtml(String(alert.attempts))}</span>
                </div>` : ''}
            </div>
            <div class="detail-actions">
                <button class="detail-action-btn action-investigate">Investigate</button>
                <button class="detail-action-btn action-suppress">Suppress</button>
                <button class="detail-action-btn action-escalate">Escalate</button>
            </div>
        </div>`;
    return row;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════════════
   FILTERING & SEARCH
══════════════════════════════════════════════════════════════ */
function initFilters() {
    // Severity filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            SOC.activeFilter = btn.dataset.filter;
            applyFilters();
        });
    });

    // Sort select
    const sortSel = document.getElementById('sortSelect');
    if (sortSel) {
        sortSel.addEventListener('change', () => {
            applyFilters(sortSel.value);
        });
    }
}

function initSearch() {
    const alertSearch = document.getElementById('alertSearch');
    if (!alertSearch) return;

    alertSearch.addEventListener('input', (e) => {
        SOC.searchQuery = e.target.value.toLowerCase();
        // Sync global search
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) globalSearch.value = e.target.value;
        applyFilters();
    });
}

function applyFilters(sortMode) {
    const rows   = document.querySelectorAll('#alertFeed .alert-row');
    const filter = SOC.activeFilter;
    const query  = SOC.searchQuery;
    let visible  = 0;

    rows.forEach(row => {
        const severity = row.dataset.severity || '';
        const user     = (row.dataset.username  || '').toLowerCase();
        const type     = (row.dataset.type      || '').toLowerCase();
        const ts       = (row.dataset.timestamp || '').toLowerCase();

        const matchFilter = filter === 'ALL' || severity === filter;
        const matchSearch = !query ||
            user.includes(query) ||
            type.includes(query) ||
            ts.includes(query);

        if (matchFilter && matchSearch) {
            row.classList.remove('hidden');
            visible++;
        } else {
            row.classList.add('hidden');
        }
    });

    const countEl = document.getElementById('visibleCount');
    if (countEl) countEl.textContent = visible;

    // Sort if requested
    if (sortMode) {
        sortAlertFeed(sortMode);
    }
}

function sortAlertFeed(mode) {
    const feed = document.getElementById('alertFeed');
    if (!feed) return;

    const rows = Array.from(feed.querySelectorAll('.alert-row'));
    const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

    rows.sort((a, b) => {
        if (mode === 'severity') {
            return (sevOrder[a.dataset.severity] || 9) - (sevOrder[b.dataset.severity] || 9);
        }
        if (mode === 'oldest') {
            return (a.dataset.timestamp || '').localeCompare(b.dataset.timestamp || '');
        }
        // newest (default) — already reversed server-side
        return (b.dataset.timestamp || '').localeCompare(a.dataset.timestamp || '');
    });

    rows.forEach(row => feed.appendChild(row));
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATIONS PANEL
══════════════════════════════════════════════════════════════ */
function initNotifications() {
    const btn   = document.getElementById('notifBtn');
    const panel = document.getElementById('notifPanel');
    const close = document.getElementById('notifClose');

    if (btn && panel) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('open');
        });
    }

    if (close && panel) {
        close.addEventListener('click', () => panel.classList.remove('open'));
    }

    document.addEventListener('click', (e) => {
        if (panel && !panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.remove('open');
        }
    });
}

/* ══════════════════════════════════════════════════════════════
   STATUS BAR CLOCK
══════════════════════════════════════════════════════════════ */
function initStatusBar() {
    const el = document.getElementById('sbTime');
    function tick() {
        if (el) el.textContent = new Date().toUTCString().replace(' GMT', ' UTC');
    }
    tick();
    setInterval(tick, 1000);
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function generateHourLabels(count) {
    const now = new Date();
    return Array.from({ length: count }, (_, i) => {
        const d = new Date(now.getTime() - (count - 1 - i) * 3600000);
        return d.getHours().toString().padStart(2, '0') + ':00';
    });
}

function generateMockTrend(points, total, scale = 1) {
    // Distribute total across points with randomness
    const base   = Math.max(1, Math.floor(total / points));
    const values = Array.from({ length: points }, () =>
        Math.max(0, Math.floor((base + (Math.random() - 0.5) * base * 1.5) * scale))
    );
    // Make last value match total roughly
    return values;
}