class BitcoinPriceGauge {
    constructor() {
        this.apiUrl = '/api/summary';
        this.refreshBtn = document.getElementById('refreshBtn');
        this.statusElement = document.getElementById('status');
        this.tab30d = document.getElementById('tab30d');
        this.tab365d = document.getElementById('tab365d');
        this.showMathBtn = document.getElementById('showMathBtn');
        this.mathDetails = document.getElementById('mathDetails');
        this.currentTimeFrame = '365d';
        
        this.bindEvents();
        this.buildDialLegend = () => {}; // no legend anymore
        this.loadInitialData();
    }

    bindEvents() {
        this.refreshBtn.addEventListener('click', () => this.refreshData());
        if (this.tab30d && this.tab365d) {
            this.tab30d.addEventListener('click', () => this.setTab('30d'));
            this.tab365d.addEventListener('click', () => this.setTab('365d'));
        }
        if (this.showMathBtn) {
            this.showMathBtn.addEventListener('click', () => this.toggleMath());
        }
    }

    toggleMath() {
        if (!this.mathDetails) return;
        const isHidden = this.mathDetails.classList.contains('hidden');
        if (isHidden) {
            this.renderMathDetails();
            this.mathDetails.classList.remove('hidden');
            this.showMathBtn.textContent = 'Hide math';
        } else {
            this.mathDetails.classList.add('hidden');
            this.showMathBtn.textContent = 'Show math';
        }
    }

    renderMathDetails() {
        if (!this.currentAnalysisData || !this.mathDetails) return;
        const a = this.currentAnalysisData.horizons[this.currentTimeFrame];
        const tfText = this.currentTimeFrame === '30d' ? '30 days' : '365 days';
        const sma = isNaN(a.sma) ? '--' : `$${a.sma.toLocaleString()}`;
        const price = this.currentAnalysisData.currentPriceUSD;
        const multiple = this.formatMultiple(a.multiple);
        const pct = (a.percentile * 100).toFixed(1);
        const ht = (a.higherThanPercent * 100).toFixed(1);
        const diffPct = ((a.multiple - 1) * 100).toFixed(1);
        const histAvg = this.formatMultiple(a.historicalAverage);
        const asOf = this.currentAnalysisData.asOfUTC;
        const priceAsOf = this.currentAnalysisData.priceAsOfUTC;

        this.mathDetails.innerHTML = `
            <div class="space-y-3">
                <div class="text-sm text-gray-600">As of <span class="hl">${new Date(asOf).toISOString()}</span> (price tick at <span class="hl">${new Date(priceAsOf).toISOString()}</span>)</div>

                <div class="font-semibold">Definitions</div>
                <ul class="list-disc pl-6 text-sm">
                    <li><span class="font-semibold">Price Multiple (R)</span>: R = Current Price ÷ Simple Moving Average (SMA).</li>
                    <li><span class="font-semibold">SMA (${tfText})</span>: Average of prior ${tfText} prices only (current period excluded).</li>
                    <li><span class="font-semibold">Percentile</span>: Share of historical multiples ≤ current R.</li>
                    <li><span class="font-semibold">Higher-than share</span>: Share of historical multiples > current R.</li>
                    <li><span class="font-semibold">Winsorization</span>: Historical multiples are clipped at the 1st/99th percentiles to reduce outlier impact.</li>
                </ul>

                <div class="font-semibold">Data sources and intervals</div>
                <ul class="list-disc pl-6 text-sm">
                    <li><span class="font-semibold">Current price</span>: Bull Bitcoin Index USD (fetched live).</li>
                    <li><span class="font-semibold">365d horizon</span>: Uses daily averages from historical data.</li>
                    <li><span class="font-semibold">30d horizon</span>: Uses hourly averages from historical data.</li>
                    <li><span class="font-semibold">Trailing window</span>: SMA timestamp is aligned to the start of the current day/hour and excludes the current period.</li>
                </ul>

                <div class="font-semibold">Current values (${tfText})</div>
                <div><span class="font-semibold">Current price (USD):</span> $${price.toLocaleString()}</div>
                <div><span class="font-semibold">SMA (${tfText}):</span> ${sma}</div>
                <div><span class="font-semibold">Price multiple (R):</span> currentPrice / SMA = ${multiple}</div>
                <div><span class="font-semibold">Price vs SMA:</span> ${diffPct}%</div>
                <div><span class="font-semibold">Historical average R:</span> ${histAvg}</div>
                <div><span class="font-semibold">Percentile of current R:</span> ${pct}%</div>

                <div class="font-semibold">How to interpret</div>
                <ul class="list-disc pl-6 text-sm space-y-1">
                    <li><span class="font-semibold">1) The multiple (R)</span>: R compares price to its ${tfText} moving average.
                        <ul class="list-disc pl-6 mt-1">
                            <li>R = 1.10 → price is ~10% above its ${tfText} trend (potential pump).</li>
                            <li>R = 0.90 → price is ~10% below its ${tfText} trend (potential dip).</li>
                            <li>Useful for gauging the <span class="hl">magnitude</span> of deviation from trend right now.</li>
                        </ul>
                    </li>
                    <li><span class="font-semibold">2) The percentile</span>: Rank of today’s R within the historical R distribution for this horizon.
                        <ul class="list-disc pl-6 mt-1">
                            <li>80% means today’s R is higher than 80% of past R values for this horizon.</li>
                            <li>Percentile is <span class="hl">regime-aware</span>: it normalizes across different market levels so you can compare conditions over time or across horizons.</li>
                            <li>Extremes (very low or very high percentiles) indicate <span class="hl">statistically unusual</span> deviations relative to this horizon’s history.</li>
                            <li>Interpretation differs from R: while R shows the absolute ratio to trend, percentile shows how <span class="hl">rare/common</span> that ratio is historically.</li>
                        </ul>
                    </li>
                    <li><span class="font-semibold">3) 30 days vs 365 days</span>:
                        <ul class="list-disc pl-6 mt-1">
                            <li><span class="font-semibold">30d (hourly)</span>: faster-reacting, more noise; good for short-term context.</li>
                            <li><span class="font-semibold">365d (daily)</span>: slower, smoother; good for macro context.</li>
                            <li>The same R can map to different percentiles because each horizon has its own historical distribution and volatility profile.</li>
                        </ul>
                    </li>
                    <li><span class="font-semibold">4) Labels</span>: Derived from percentile bands.
                        <ul class="list-disc pl-6 mt-1">
                            <li>Tails → stronger dip/pump labels; middle → “Around average”.</li>
                            <li>Labels are summaries of <span class="hl">rank</span>, not trading signals.</li>
                        </ul>
                    </li>
                    <li><span class="font-semibold">Practical context</span> (not financial advice):
                        <ul class="list-disc pl-6 mt-1">
                            <li>Use R to understand <span class="hl">how far</span> price is from trend.</li>
                            <li>Use percentile to understand <span class="hl">how unusual</span> that deviation is for this horizon.</li>
                            <li>Compare 30d vs 365d to separate <span class="hl">short-term noise</span> from <span class="hl">long-term posture</span>.</li>
                        </ul>
                    </li>
                </ul>

                <div class="font-semibold">Computation notes</div>
                <ul class="list-disc pl-6 text-sm">
                    <li>SMA is computed from exactly ${tfText} prior samples in the selected horizon.</li>
                    <li>Historical multiples are computed by walking through the history with trailing SMAs (no look-ahead).</li>
                    <li>Percentile is computed against the winsorized distribution of historical multiples. Higher-than share equals 100% − percentile.</li>
                    <li>Window-only comparison shows how many recent samples in the last window exceeded the current R.</li>
                </ul>

                <div class="font-semibold">Label scale (by percentile)</div>
                <div class="text-sm text-gray-600">Labels are assigned from the <span class="hl">percentile of the current R</span> within the historical R distribution for this horizon (<span class="hl">${tfText}</span>). Percentiles are computed using winsorized historical multiples derived from the same horizon's aggregation (30 days uses hourly data; 365 days uses daily data) built from the bootstrap CSV and subsequent live ticks.</div>
                <ul class="list-disc pl-6 text-sm">
                    <li>0% – 10%: Extreme dip</li>
                    <li>10% – 20%: Very big dip</li>
                    <li>20% – 30%: Big dip</li>
                    <li>30% – 40%: Dip</li>
                    <li>40% – 50%: Small dip</li>
                    <li>50% – 60%: Around average</li>
                    <li>60% – 70%: Small pump</li>
                    <li>70% – 80%: Pump</li>
                    <li>80% – 90%: Big pump</li>
                    <li>90% – 100%: Extreme pump</li>
                </ul>
            </div>
        `;
    }

    setTab(tf) {
        this.currentTimeFrame = tf;
        if (this.tab30d && this.tab365d) {
            if (tf === '30d') {
                this.tab30d.classList.add('tab-active');
                this.tab30d.classList.remove('tab-inactive');
                this.tab365d.classList.remove('tab-active');
                this.tab365d.classList.add('tab-inactive');
            } else {
                this.tab365d.classList.add('tab-active');
                this.tab365d.classList.remove('tab-inactive');
                this.tab30d.classList.remove('tab-active');
                this.tab30d.classList.add('tab-inactive');
            }
        }
        if (this.currentAnalysisData) this.updateUI(this.currentAnalysisData);
    }

    async loadInitialData() {
        this.setStatus('Loading initial data...');
        await this.refreshData();
        this.setTab('365d');
    }

    async refreshData() {
        try {
            this.setStatus('Fetching latest data...');
            this.refreshBtn.disabled = true;
            this.refreshBtn.textContent = 'Loading...';

            const response = await fetch(this.apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.updateUI(data);
            this.setStatus('Data updated successfully');
        } catch (error) {
            console.error('Error fetching data:', error);
            this.setStatus(`Error: ${error.message}`);
        } finally {
            this.refreshBtn.disabled = false;
            this.refreshBtn.textContent = 'Refresh Analysis';
        }
    }

    updateUI(data) {
        this.currentAnalysisData = data;
        const currentPriceEl = document.getElementById('currentPrice');
        if (currentPriceEl) currentPriceEl.textContent = `$${data.currentPriceUSD.toLocaleString()}`;

        const a = data.horizons[this.currentTimeFrame];
        const multipleEl = document.getElementById('priceMultiple');
        if (multipleEl) multipleEl.textContent = this.formatMultiple(a.multiple);

        // Status pill color match
        this.updateStatusPill(a);

        // Update dial marker
        this.updateDial(a.percentile);

        // Combined analysis text (includes price diff, timeframe, SMA, historical context)
        this.renderCombinedAnalysis(a);
    }

    formatMultiple(multiple) { return (multiple == null || isNaN(multiple)) ? '--' : multiple.toFixed(3); }

    updateStatusPill(analysis) {
        const statusPill = document.getElementById('statusLabelPill');
        if (!statusPill) return;
        const labelText = analysis.label || '--';
        statusPill.textContent = labelText;
        statusPill.classList.remove('status-dip','status-neutral','status-pump','status-pill');
        statusPill.classList.add('status-pill');
        const p = analysis.percentile;
        if (isNaN(p)) { statusPill.classList.add('status-neutral'); return; }
        if (p < 0.45) statusPill.classList.add('status-dip');
        else if (p > 0.55) statusPill.classList.add('status-pump');
        else statusPill.classList.add('status-neutral');
    }

    updateDial(percentile) {
        const marker = document.getElementById('dialMarker');
        const bar = document.getElementById('dialBar');
        if (!marker || !bar || percentile == null || isNaN(percentile)) return;
        const p = Math.max(0, Math.min(1, percentile));
        marker.style.left = `${(p * 100).toFixed(1)}%`;
    }

    renderCombinedAnalysis(a) {
        const el = document.getElementById('analysisCombined');
        if (!el) return;

        const is30d = this.currentTimeFrame === '30d';
        const periodLabel = is30d ? 'past month' : 'past year';
        const horizonText = is30d ? '30 day' : '365 day';
        const unitLabel = is30d ? 'hours' : 'days';
        const priceUSD = this.currentAnalysisData?.currentPriceUSD;
        const priceText = (priceUSD == null || isNaN(priceUSD)) ? '--' : `$${priceUSD.toLocaleString()}`;
        const smaText = (a.sma == null || isNaN(a.sma)) ? '--' : `$${a.sma.toLocaleString()}`;
        const multipleText = this.formatMultiple(a.multiple);
        const histAvgText = this.formatMultiple(a.historicalAverage);
        const priceDiffPct = ((a.multiple - 1) * 100).toFixed(1);
        const percentileText = (a.percentile * 100).toFixed(1);
        const countHigher = a.countHigherInWindow ?? Math.round((1 - a.percentile) * a.windowLength);

        const p1 = `Bitcoin's current price of <span class="hl">${priceText}</span> is <span class="hl">${Math.abs(+priceDiffPct)}% ${+priceDiffPct >= 0 ? 'higher' : 'lower'}</span> than the average of the <span class="hl">${periodLabel}</span>, which was <span class="hl">${smaText}</span>.`;
        const p2 = `This yields a ${horizonText} Price multiple of <span class="hl">${multipleText}</span> versus a historical average multiple of <span class="hl">${histAvgText}</span>.`;
        const p3 = `The current multiple ranks in the <span class="hl">${percentileText}%</span> percentile, which means that <span class="hl">${countHigher.toLocaleString()} ${unitLabel}</span> over the ${periodLabel} the multiple was higher.`;
        const conclusion = `<div class="mt-4 p-4 rounded-md border status-dip text-base sm:text-lg"><span class="font-semibold">Conclusion:</span> <span class="font-semibold hl">${a.label}</span> relative to the price trends of the ${periodLabel}.</div>`;

        el.innerHTML = `<p class="text-base">${p1}</p><p class="text-base mt-2">${p2}</p><p class="text-base mt-2">${p3}</p>${conclusion}`;
    }

    setStatus(message) { this.statusElement.textContent = message; console.log(message); }
}

document.addEventListener('DOMContentLoaded', () => { new BitcoinPriceGauge(); });
