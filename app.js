// ============================================================
//  app.js  —  Logika Utama Alpine.js
//  DATA PERIKANAN BUDIDAYA — DPKPP Kab. Mempawah
// ============================================================

function cleanBlueApp() {
  return {
    // ── State UI ──────────────────────────────────────────────
    currentDate: "",
    currentTime: "",
    chartFilter: "",
    chartType: "pie",
    isLoading: true,
    sidebarOpen: false,
    statsOpen: true,
    filterOpen: true,

    // ── Data ──────────────────────────────────────────────────
    sheetURL:
      "https://docs.google.com/spreadsheets/d/1WvFGRiuiJiGGdhLp1EqtKPhqHi7yNn8UipH_VRK-zFo/gviz/tq?tqx=out:json",
    rawData: [],
    filtered: [],
    searchQuery: "",
    totalCount: 0,

    // ── Peta ──────────────────────────────────────────────────
    map: null,
    markers: [],
    geoFiles: [{ file: null, name: null }, { file: null, name: null }],
    geoFileNames: [
      "id6104080_jongkat.geojson",
      "id6104081_segedong.geojson",
      "id6104090_sungai_pinyuh.geojson",
      "id6104091_anjongan.geojson",
      "id6104100_mempawah_hilir.geojson",
      "id6104101_mempawah_timur.geojson",
      "id6104110_sungai_kunyit.geojson",
      "id6104120_toho.geojson",
      "id6104121_sadaniang.geojson",
    ],
    geoLayers: { kecamatan: null, desa: null },
    layerColors: { kecamatan: {}, desa: {} },
    layerVisible: { kecamatan: false, desa: false },
    _legendControl: null,

    // ── Statistik ─────────────────────────────────────────────
    stats: [
      { label: "Kusuka",              value: 0, percent: 0    },
      { label: "NIB",                 value: 0, percent: 0    },
      { label: "CPIB",                value: 0, percent: 0    },
      { label: "CBIB",                value: 0, percent: 0    },
      { label: "Kusuka Kelompok",     value: 0, percent: null },
      { label: "Jumlah Kelompok",     value: 0, percent: null },
      { label: "Jumlah Kolam",        value: 0, percent: null },
      { label: "Luas Lahan (m²)",     value: 0, percent: null },
      { label: "Produksi (Kg)",       value: 0, percent: null },
    ],

    // ── Filter ────────────────────────────────────────────────
    filtersDef: {
      kecamatan:      { label: "Kecamatan",      options: [] },
      desa:           { label: "Desa",            options: [] },
      kelompok:       { label: "Kelompok",        options: [] },
      jenis_usaha:    { label: "Jenis Usaha",     options: [] },
      wadah_budidaya: { label: "Wadah Budidaya",  options: [] },
      jenis_ikan:     { label: "Jenis Ikan",      options: [] },
    },
    selected: {
      kecamatan:      [],
      desa:           [],
      kelompok:       [],
      jenis_usaha:    [],
      wadah_budidaya: [],
      jenis_ikan:     [],
    },

    // ══════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════
    async init() {
      // --- Jam & Tanggal Realtime ---
      const fmtDate = (d) => {
        const days   = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
        const months = ["Januari","Februari","Maret","April","Mei","Juni",
                        "Juli","Agustus","September","Oktober","November","Desember"];
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      };
      const fmtTime = (d) => {
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };
      const updateClock = () => {
        const now = new Date();
        this.currentDate = fmtDate(now);
        this.currentTime = fmtTime(now) + " WIB";
      };
      updateClock();
      setInterval(updateClock, 1000);

      // --- Ambil Data Google Sheet ---
      try {
        const res  = await fetch(this.sheetURL);
        const text = await res.text();
        const json = JSON.parse(text.match(/setResponse\(([^]*?)\);/)[1]);
        const cols = json.table.cols.map((c) => (c.label || "").trim());
        const rows = json.table.rows.map((r) => {
          const obj = {};
          (r.c || []).forEach(
            (c, i) => (obj[cols[i]] = c ? (c.v !== undefined ? c.v : c.f || "") : "")
          );
          return obj;
        });

        this.rawData = rows.map((r) => ({
          nama:           r["NAMA PELAKU USAHA"] || "",
          kelompok:       r["KELOMPOK"] || r["NAMA KELOMPOK"] || "",
          kecamatan:      r["KECAMATAN"] || "",
          desa:           r["LOKASI USAHA (DESA)"] || "",
          jenis_usaha:    r["JENIS USAHA"] || "",
          wadah_budidaya: r["WADAH BUDIDAYA"] || "",
          jenis_ikan:     [r["JENIS IKAN UTAMA"], r["JENIS IKAN TAMBAHAN 1"], r["JENIS IKAN TAMBAHAN 2"]]
                            .filter((v) => v && v.trim() !== "")
                            .join(", "),
          kolam:    parseFloat(r["JUMLAH KOLAM"]   || r["P"] || 0) || 0,
          lahan:    parseFloat(r["LUAS LAHAN (m2)"] || r["Q"] || 0) || 0,
          produksi: parseFloat((r["PRODUKSI (Kg)"] || r["U"] || "0").toString().replace(/,/g, "")) || 0,
          kusuka:          parseInt(r["KUSUKA"]         || r["W"] || 0),
          nib:             parseInt(r["NIB"]            || r["X"] || 0),
          cpib:            r["CPIB"]                    || r["Y"] || "",
          cbib:            parseInt(r["CBIB"]           || r["Z"] || 0),
          kusuka_kelompok: parseInt(r["KUSUKA KELOMPOK"] || r["AA"] || 0),
          lat: parseFloat(r["LAT"]  || r["LATITUDE"]  || ""),
          lng: parseFloat(r["LONG"] || r["LONGITUDE"] || ""),
        }));

        this.totalCount = this.rawData.length;
        this.updateFilterOptions();
        this.applyFilters();
        this.isLoading = false;
      } catch (err) {
        console.error("Error loading sheet:", err);
        this.isLoading = false;
      }

      // --- Inisialisasi Peta ---
      // ⚠️  Koordinat sudah dikoreksi ke Mempawah, Kalimantan Barat
      this.map = L.map("map").setView([0.4, 109.1], 10);
      L.tileLayer("https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
      }).addTo(this.map);

      await this.loadAllGeoJSON();
      this.updateMapMarkers();
    },

    // ══════════════════════════════════════════════════════════
    //  PETA
    // ══════════════════════════════════════════════════════════
    updateMapMarkers() {
      if (!this.map) return;

      if (this.markerLayer) this.map.removeLayer(this.markerLayer);
      this.markerLayer = L.layerGroup();
      this.markers = [];

      this.filtered.forEach((r) => {
        if (!r.lat || !r.lng) return;

        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
        const waUrl    = `https://wa.me/?text=${encodeURIComponent(
          `📍 Lokasi Budidaya Perikanan\n👤 ${r.nama}\n🏘️ ${r.kelompok}\n🐟 ${r.jenis_ikan}\n📌 ${r.desa}, ${r.kecamatan}\n\n🗺️ Buka di Google Maps:\nhttps://www.google.com/maps?q=${r.lat},${r.lng}`
        )}`;

        const m = L.marker([r.lat, r.lng]);
        m.bindPopup(`
          <div style="min-width:200px;font-family:sans-serif;">
            <div style="font-weight:700;font-size:13px;color:#0e7490;margin-bottom:4px;">${r.nama}</div>
            <div style="font-size:11px;color:#374151;line-height:1.6;">
              🏘️ <b>Kelompok:</b> ${r.kelompok || "-"}<br>
              🐟 <b>Ikan:</b> ${r.jenis_ikan || "-"}<br>
              🏠 <b>Wadah:</b> ${r.wadah_budidaya || "-"}<br>
              📌 ${r.desa}, ${r.kecamatan}
            </div>
            <div style="margin-top:10px;display:flex;gap:6px;">
              <a href="${gmapsUrl}" target="_blank"
                style="flex:1;background:#1a73e8;color:white;text-align:center;
                       padding:6px 4px;border-radius:8px;font-size:11px;
                       font-weight:600;text-decoration:none;display:block;">
                🗺️ Google Maps
              </a>
              <a href="${waUrl}" target="_blank"
                style="flex:1;background:#25d366;color:white;text-align:center;
                       padding:6px 4px;border-radius:8px;font-size:11px;
                       font-weight:600;text-decoration:none;display:block;">
                💬 WhatsApp
              </a>
            </div>
          </div>
        `);

        this.markerLayer.addLayer(m);
        this.markers.push(m);
      });

      this.markerLayer.addTo(this.map);

      // Zoom otomatis ke area marker (dengan pengecekan bounds kosong)
      const validCoords = this.filtered.filter((r) => r.lat && r.lng).map((r) => [r.lat, r.lng]);
      if (validCoords.length > 0) {
        this.map.fitBounds(L.latLngBounds(validCoords));
      }
    },

    // ══════════════════════════════════════════════════════════
    //  FILTER
    // ══════════════════════════════════════════════════════════
    toggleSelect(k, v) {
      const arr = this.selected[k];
      const i   = arr.indexOf(v);
      if (i === -1) arr.push(v);
      else arr.splice(i, 1);
      this.updateFilterOptions();
      this.applyFilters();
    },

    resetFilters() {
      Object.keys(this.selected).forEach((k) => (this.selected[k] = []));
      this.updateFilterOptions();
      this.applyFilters();
      this.sidebarOpen = false;
    },

    updateFilterOptions() {
      const uniq = (a) =>
        Array.from(new Set(a.filter((v) => v))).sort((a, b) => a.localeCompare(b));

      // Kecamatan: selalu dari semua data
      this.filtersDef.kecamatan.options = uniq(this.rawData.map((r) => r.kecamatan));

      // Filter bertingkat (cascading)
      let d1 = [...this.rawData];
      if (this.selected.kecamatan.length) d1 = d1.filter((r) => this.selected.kecamatan.includes(r.kecamatan));
      this.filtersDef.desa.options = uniq(d1.map((r) => r.desa));

      let d2 = [...d1];
      if (this.selected.desa.length) d2 = d2.filter((r) => this.selected.desa.includes(r.desa));
      this.filtersDef.kelompok.options = uniq(d2.map((r) => r.kelompok));

      let d3 = [...d2];
      if (this.selected.kelompok.length) d3 = d3.filter((r) => this.selected.kelompok.includes(r.kelompok));
      this.filtersDef.jenis_usaha.options = uniq(d3.map((r) => r.jenis_usaha));

      let d4 = [...d3];
      if (this.selected.jenis_usaha.length) d4 = d4.filter((r) => this.selected.jenis_usaha.includes(r.jenis_usaha));
      this.filtersDef.wadah_budidaya.options = uniq(d4.map((r) => r.wadah_budidaya));

      let d5 = [...d4];
      if (this.selected.wadah_budidaya.length) d5 = d5.filter((r) => this.selected.wadah_budidaya.includes(r.wadah_budidaya));
      this.filtersDef.jenis_ikan.options = uniq(
        d5.flatMap((r) => r.jenis_ikan.split(",").map((v) => v.trim())).filter((v) => v)
      );
    },

    applyFilters() {
      this.filtered = this.rawData.filter((r) => {
        const match = Object.keys(this.selected).every((k) => {
          if (this.selected[k].length === 0) return true;
          if (k === "jenis_ikan") return this.selected[k].some((val) => r.jenis_ikan.includes(val));
          return this.selected[k].includes(r[k]);
        });
        const search =
          this.searchQuery.trim() === "" ||
          Object.values(r).join(" ").toLowerCase().includes(this.searchQuery.toLowerCase());
        return match && search;
      });

      this.updateStats();
      this.updateJumlahKelompok();
      this.updateMapMarkers();
      this.updateGeoFilter();
    },

    // ══════════════════════════════════════════════════════════
    //  STATISTIK & CHART
    // ══════════════════════════════════════════════════════════
    updateStats() {
      const total        = this.totalCount || 1;
      const f            = this.filtered;
      const sum          = (a, k) => a.reduce((t, x) => t + (x[k] || 0), 0);
      const count        = (a, k) => a.filter((x) => x[k] > 0).length;
      const countNonEmpty = (data, key) =>
        data.reduce((tot, row) => {
          const val = row[key];
          return val !== null && val !== undefined && val.toString().trim() !== "" ? tot + 1 : tot;
        }, 0);

      const kusuka          = count(f, "kusuka");
      const nib             = count(f, "nib");
      const cpib            = countNonEmpty(f, "cpib");
      const cbib            = count(f, "cbib");
      const kusuka_kelompok = f.reduce((acc, x) => acc + (x.kusuka_kelompok ? 1 : 0), 0);
      const kolam           = sum(f, "kolam");
      const lahan           = sum(f, "lahan");
      const produksi        = sum(f, "produksi");

      this.stats = [
        { label: "Kusuka",              value: kusuka,                      percent: ((kusuka  / total) * 100).toFixed(1) },
        { label: "NIB",                 value: nib,                         percent: ((nib     / total) * 100).toFixed(1) },
        { label: "CPIB",                value: cpib,                        percent: ((cpib    / total) * 100).toFixed(1) },
        { label: "CBIB",                value: cbib,                        percent: ((cbib    / total) * 100).toFixed(1) },
        { label: "Kusuka Kelompok",     value: kusuka_kelompok,             percent: null },
        { label: "Jumlah Kolam",        value: kolam.toLocaleString(),      percent: null },
        { label: "Luas Lahan (m²)",     value: lahan.toLocaleString(),      percent: null },
        { label: "Jumlah Kelompok",     value: 0,                           percent: null },
        { label: "Jumlah Pelaku Usaha", value: f.length,                    percent: null },
        { label: "Produksi (Kg)",       value: produksi.toLocaleString(),   percent: null },
      ];

      this.updatePieChart();
      this.updateJumlahKelompok();
    },

    updatePieChart() {
      const filteredData = [...this.filtered];
      const groupKey     = this.chartFilter;
      const type         = this.chartType || "pie";
      let chartLabels    = [];
      let chartData      = [];

      if (groupKey) {
        const groupMap = new Map();
        filteredData.forEach((item) => {
          let keys = [];
          if (groupKey === "jenis_ikan") {
            keys = item.jenis_ikan.split(",").map((v) => v.trim()).filter((v) => v !== "");
          } else {
            const val = item[groupKey];
            if (val && val.trim() !== "") keys = [val.trim()];
          }
          keys.forEach((key) => groupMap.set(key, (groupMap.get(key) || 0) + 1));
        });
        chartLabels = Array.from(groupMap.keys());
        chartData   = Array.from(groupMap.values());
      } else {
        const excluded = ["Kusuka Kelompok", "Jumlah Kelompok"];
        const visible  = this.stats.filter((s) => s.value !== null && !excluded.includes(s.label));
        chartLabels    = visible.map((s) => s.label);
        chartData      = visible.map((s) => {
          const v = s.value;
          return typeof v === "number" ? v : Number(v.toString().replace(/,/g, "")) || 0;
        });
      }

      const colors = chartLabels.map((_, i) => `hsl(${(i * 137.5) % 360}, 70%, 60%)`);
      if (this.barChart)       this.barChart.destroy();
      if (this.barChartMobile) this.barChartMobile.destroy();

      Chart.register(ChartDataLabels);
      const isPie = type === "pie";

      const makeChart = (canvasId) => {
        const el = document.getElementById(canvasId);
        if (!el) return null;
        return new Chart(el.getContext("2d"), {
          type: isPie ? "pie" : "bar",
          data: {
            labels: chartLabels,
            datasets: [{
              data:            chartData,
              backgroundColor: colors,
              borderColor:     isPie ? undefined : colors.map((c) => c.replace("60%", "45%")),
              borderWidth:     isPie ? 0 : 1,
            }],
          },
          options: {
            responsive: true,
            indexAxis: isPie ? undefined : "y",
            plugins: {
              legend: { display: isPie, labels: { color: "#1f2937", font: { size: 13 } } },
              tooltip: {
                bodyColor: "#1f2937",
                backgroundColor: "#f9fafb",
                callbacks: {
                  label(context) {
                    const value   = isPie ? (context.parsed || 0) : (context.parsed.x || 0);
                    const data    = context.chart.data.datasets[0].data;
                    const total   = data.reduce((s, v) => s + v, 0);
                    const percent = ((value / total) * 100).toFixed(1);
                    return `${context.label}: ${value.toLocaleString()} (${percent}%)`;
                  },
                },
              },
              datalabels: {
                color:           isPie ? "#fff" : "#1f2937",
                textShadowColor: isPie ? "rgba(0,0,0,0.6)" : undefined,
                textShadowBlur:  isPie ? 4 : undefined,
                anchor:          isPie ? "center" : "end",
                align:           isPie ? "center" : "end",
                formatter(value, context) {
                  const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                  const pct   = ((value / total) * 100).toFixed(1);
                  return isPie ? `${pct}%` : `${value} (${pct}%)`;
                },
                font:    { weight: "bold", size: isPie ? 12 : 10 },
                display(context) {
                  if (!isPie) return true;
                  const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                  return context.dataset.data[context.dataIndex] / total >= 0.03;
                },
              },
            },
            scales: isPie ? {} : {
              x: { beginAtZero: true, ticks: { color: "#1f2937", font: { size: 10 } }, grid: { color: "#e5e7eb" } },
              y: { ticks: { color: "#1f2937", font: { size: 10 } }, grid: { display: false } },
            },
            layout: isPie ? {} : { padding: { right: 60 } },
          },
          plugins: [ChartDataLabels],
        });
      };

      this.barChart       = makeChart("barChart");
      this.barChartMobile = makeChart("barChartMobile");
    },

    updateJumlahKelompok() {
      const kelompokSet = new Set();
      this.filtered.forEach((r) => {
        if (r.kelompok && r.kelompok.trim() !== "") kelompokSet.add(r.kelompok.trim());
      });
      this.stats = this.stats.map((stat) => {
        if (stat.label === "Jumlah Kelompok")     return { ...stat, value: kelompokSet.size };
        if (stat.label === "Jumlah Pelaku Usaha") return { ...stat, value: this.filtered.length };
        return stat;
      });
    },

    // ══════════════════════════════════════════════════════════
    //  UNDUH
    // ══════════════════════════════════════════════════════════
    downloadExcel() {
      if (this.filtered.length === 0) { alert("Tidak ada data untuk diunduh."); return; }

      const exportData = this.filtered.map((row, i) => ({
        "No":                i + 1,
        "Nama Pelaku Usaha": row.nama          || "",
        "Kelompok":          row.kelompok      || "",
        "Kecamatan":         row.kecamatan     || "",
        "Desa":              row.desa          || "",
        "Jenis Usaha":       row.jenis_usaha   || "",
        "Wadah Budidaya":    row.wadah_budidaya || "",
        "Jenis Ikan":        row.jenis_ikan    || "",
      }));

      const ws        = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"]     = Object.keys(exportData[0]).map((key) => ({
        wch: Math.max(key.length, ...exportData.map((r) => (r[key] || "").toString().length)) + 2,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Pelaku Usaha");
      XLSX.writeFile(wb, `data_perikanan_${new Date().toLocaleDateString("id-ID").replace(/\//g, "-")}.xlsx`);
    },

    downloadPDF() {
      if (this.filtered.length === 0) { alert("Tidak ada data untuk diunduh."); return; }

      const { jsPDF } = window.jspdf;
      const doc       = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFontSize(13);
      doc.setTextColor(14, 116, 144);
      doc.setFont(undefined, "bold");
      doc.text("DATA PERIKANAN BUDIDAYA DPKPP KAB. MEMPAWAH", 14, 14);

      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.setTextColor(80, 80, 80);
      const tgl = new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      doc.text(`Dicetak: ${tgl}  |  Total Data: ${this.filtered.length} orang`, 14, 20);

      const activeFilters = [];
      if (this.selected.kecamatan.length)      activeFilters.push(`Kecamatan: ${this.selected.kecamatan.join(", ")}`);
      if (this.selected.desa.length)           activeFilters.push(`Desa: ${this.selected.desa.join(", ")}`);
      if (this.selected.kelompok.length)       activeFilters.push(`Kelompok: ${this.selected.kelompok.join(", ")}`);
      if (this.selected.jenis_usaha.length)    activeFilters.push(`Jenis Usaha: ${this.selected.jenis_usaha.join(", ")}`);
      if (this.selected.wadah_budidaya.length) activeFilters.push(`Wadah: ${this.selected.wadah_budidaya.join(", ")}`);
      if (this.selected.jenis_ikan.length)     activeFilters.push(`Ikan: ${this.selected.jenis_ikan.join(", ")}`);
      if (this.searchQuery.trim())             activeFilters.push(`Cari: "${this.searchQuery.trim()}"`);

      if (activeFilters.length > 0) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        doc.text(`Filter aktif: ${activeFilters.join("  |  ")}`, 14, 25);
      }

      const startY = activeFilters.length > 0 ? 29 : 25;
      const head   = [["No", "Nama Pelaku Usaha", "Kelompok", "Kecamatan", "Desa", "Jenis Usaha", "Wadah Budidaya", "Jenis Ikan"]];
      const body   = this.filtered.map((row, i) => [
        i + 1, row.nama || "", row.kelompok || "", row.kecamatan || "",
        row.desa || "", row.jenis_usaha || "", row.wadah_budidaya || "", row.jenis_ikan || "",
      ]);

      doc.autoTable({
        head, body, startY,
        styles:             { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
        headStyles:         { fillColor: [14, 116, 144], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 249, 255] },
        columnStyles: {
          0: { cellWidth: 8  }, 1: { cellWidth: 38 }, 2: { cellWidth: 32 },
          3: { cellWidth: 30 }, 4: { cellWidth: 28 }, 5: { cellWidth: 25 },
          6: { cellWidth: 28 }, 7: { cellWidth: 40 },
        },
        didDrawPage(data) {
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(
            `Halaman ${data.pageNumber} dari ${pageCount}  —  © ${new Date().getFullYear()} Perikanan Budidaya DPKPP Kab. Mempawah`,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 5,
            { align: "center" }
          );
        },
      });

      doc.save(`data_perikanan_${new Date().toLocaleDateString("id-ID").replace(/\//g, "-")}.pdf`);
    },

    // ══════════════════════════════════════════════════════════
    //  GEOJSON
    // ══════════════════════════════════════════════════════════
    async loadAllGeoJSON() {
      const filenames = [
        "id6104080_jongkat.geojson",    "id6104081_segedong.geojson",
        "id6104090_sungai_pinyuh.geojson", "id6104091_anjongan.geojson",
        "id6104100_mempawah_hilir.geojson","id6104101_mempawah_timur.geojson",
        "id6104110_sungai_kunyit.geojson", "id6104120_toho.geojson",
        "id6104121_sadaniang.geojson",
      ];

      for (const fname of filenames) {
        const path = `geojson/${fname}`;
        try {
          const res = await fetch(path);
          if (!res.ok) throw new Error(res.statusText);
          const geo    = await res.json();
          const sample = geo.features?.[0]?.properties ?? {};
          if (sample.district && !sample.village) {
            this._addGeoLayer(geo, "kecamatan", fname);
          } else {
            this._addGeoLayer(geo, "desa", fname);
          }
        } catch (err) {
          console.warn("Tidak bisa load", path, err);
        }
      }

      this._finalizeKecamatanLayer();
      if (this.updateGeoFilter) this.updateGeoFilter();
    },

    _addGeoLayer(geojson, type, sourceName) {
      if (!this._rawGeo)        this._rawGeo = [];
      if (!this._layersByType)  this._layersByType = {};
      if (!this._layersByType[type]) this._layersByType[type] = [];

      this._rawGeo.push({ geojson, type, sourceName });

      const layer = L.geoJSON(geojson, {
        style: (f) => ({
          color:       this._getColorForFeature(type, f),
          weight:      1.2,
          fillOpacity: 0.12,
        }),
        onEachFeature: (f, l) => {
          const keyProp  = type === "kecamatan" ? "district" : "village";
          const name     = f.properties?.[keyProp] || f.properties?.NAME || f.properties?.name || "-";
          const area     = f.geometry ? turf.area(f) : 0;
          const readableArea = (area / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 });
          l.bindPopup(`<b>${name}</b><br/>Luas Wilayah: ${readableArea} ha`);
          l.on("mouseover", () => l.setStyle({ weight: 2.5, fillOpacity: 0.25 }));
          l.on("mouseout",  () => l.setStyle({ weight: 1.2, fillOpacity: 0.12 }));
        },
      });

      this._layersByType[type].push({ layer, sourceName });
      layer.addTo(this.map);
      this.layerVisible[type] = false;
      this._updateLegendFromLayers(type);
    },

    _getColorForFeature(type, feature) {
      const keyProp = type === "kecamatan" ? "district" : "village";
      const id =
        feature.properties?.[keyProp] ||
        feature.properties?.NAME ||
        feature.properties?.name ||
        JSON.stringify(feature.properties).slice(0, 30);
      if (!this.layerColors[type]) this.layerColors[type] = {};
      if (this.layerColors[type][id]) return this.layerColors[type][id];
      const hash  = Array.from(id).reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0);
      const color = `hsl(${Math.abs(hash) % 360},70%,55%)`;
      this.layerColors[type][id] = color;
      return color;
    },

    _updateLegendFromLayers(type) {
      const items      = [];
      const seen       = new Set();
      const layers     = this._layersByType?.[type] ?? [];
      const keyProp    = type === "kecamatan" ? "district" : "village";
      const selectedKec  = this.selected.kecamatan.map((k) => k.toLowerCase());
      const selectedDesa = this.selected.desa.map((d) => d.toLowerCase());

      if (selectedKec.length === 0 && selectedDesa.length === 0) {
        if (this._legendControl) {
          try { this.map.removeControl(this._legendControl); } catch (_) {}
          this._legendControl = null;
        }
        return;
      }

      layers.forEach((obj) => {
        obj.layer.eachLayer((l) => {
          const f    = l.feature;
          const name = (f.properties?.[keyProp] || f.properties?.NAME || f.properties?.name || "").trim();
          const kec  = (f.properties?.district || "").trim();
          if (!name || seen.has(name)) return;

          let show = true;
          if (type === "desa") {
            const matchKec  = selectedKec.length  === 0 || selectedKec.includes(kec.toLowerCase());
            const matchDesa = selectedDesa.length === 0 || selectedDesa.includes(name.toLowerCase());
            show = matchKec && matchDesa;
          } else if (type === "kecamatan") {
            show = selectedKec.length === 0 || selectedKec.includes(name.toLowerCase());
          }
          if (!show) return;

          seen.add(name);
          items.push({ name, color: this._getColorForFeature(type, f), area: f.geometry ? turf.area(f) : 0 });
        });
      });

      if (items.length === 0) {
        if (this._legendControl) {
          try { this.map.removeControl(this._legendControl); } catch (_) {}
          this._legendControl = null;
        }
        return;
      }

      items.sort((a, b) => a.name.localeCompare(b.name));
      const legendItems = items.slice(0, 20);

      if (this._legendControl) try { this.map.removeControl(this._legendControl); } catch (_) {}

      const legend = L.control({ position: "bottomright" });
      legend.onAdd = function () {
        const div   = L.DomUtil.create("div", "bg-white p-2 rounded shadow text-xs");
        const title = type === "kecamatan" ? "KECAMATAN" : "DESA";
        div.innerHTML = `<b>${title}</b><br/>`;
        legendItems.forEach((it) => {
          const ha = (it.area / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 });
          div.innerHTML += `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="width:18px;height:12px;background:${it.color};display:inline-block;border-radius:3px;border:1px solid #ccc"></span>
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;display:inline-block">
                ${it.name} — ${ha} ha
              </span>
            </div>`;
        });
        return div;
      };
      legend.addTo(this.map);
      this._legendControl = legend;
    },

    _finalizeKecamatanLayer() {
      if (!this._layersByType?.["kecamatan"]) return;
      const group = L.featureGroup();
      this._layersByType["kecamatan"].forEach((obj) => group.addLayer(obj.layer));
      this.geoLayers.kecamatan  = group;
      this.layerVisible.kecamatan = true;
      group.addTo(this.map);
    },

    updateGeoFilter() {
      try {
        const hasKecFilter  = this.selected.kecamatan.length > 0;
        const hasDesaFilter = this.selected.desa.length > 0;

        if (!hasKecFilter && !hasDesaFilter) {
          this.geoLayers.kecamatan?.eachLayer((l) => { if (this.map.hasLayer(l)) this.map.removeLayer(l); });
          this._layersByType?.["desa"]?.forEach((obj) => {
            obj.layer.eachLayer((l) => { if (this.map.hasLayer(l)) this.map.removeLayer(l); });
          });
          if (this._legendControl) {
            try { this.map.removeControl(this._legendControl); } catch (_) {}
            this._legendControl = null;
          }
          return;
        }

        const selectedKec  = this.selected.kecamatan.map((k) => k.toLowerCase().trim());
        const selectedDesa = this.selected.desa.map((d) => d.toLowerCase().trim());

        // Filter layer kecamatan
        this.geoLayers.kecamatan?.eachLayer((layer) => {
          const kec  = (layer.feature?.properties?.district || layer.feature?.properties?.NAME || layer.feature?.properties?.name || "").toLowerCase().trim();
          const show = selectedKec.length === 0 || selectedKec.some((k) => kec.includes(k));
          if (show) { if (!this.map.hasLayer(layer)) layer.addTo(this.map); layer.setStyle({ opacity: 1, fillOpacity: 0.15 }); }
          else      { if (this.map.hasLayer(layer)) this.map.removeLayer(layer); }
        });

        // Filter layer desa
        this._layersByType?.["desa"]?.forEach((obj) => {
          obj.layer.eachLayer((layer) => {
            const desa = (layer.feature?.properties?.village || layer.feature?.properties?.NAME || layer.feature?.properties?.name || "").toLowerCase().trim();
            const kec  = (layer.feature?.properties?.district || "").toLowerCase().trim();
            const matchKec  = selectedKec.length  === 0 || selectedKec.some((k) => kec.includes(k));
            const matchDesa = selectedDesa.length === 0 || selectedDesa.some((d) => desa.includes(d));
            const show = matchKec && matchDesa;
            if (show) { if (!this.map.hasLayer(layer)) layer.addTo(this.map); layer.setStyle({ opacity: 1, fillOpacity: 0.15 }); }
            else      { if (this.map.hasLayer(layer)) this.map.removeLayer(layer); }
          });
        });

        this._updateLegendFromLayers(hasDesaFilter ? "desa" : "desa");
      } catch (e) {
        console.warn("updateGeoFilter error:", e);
      }
    },
  };
} // end cleanBlueApp


// ── Toggle Legend (mobile) ───────────────────────────────────
function toggleLegend() {
  const legend = document.querySelector(".leaflet-bottom.leaflet-right");
  if (!legend) return;
  legend.style.display = legend.style.display === "none" ? "block" : "none";
}

window.addEventListener("load", () => {
  const btn    = document.getElementById("toggleLegendBtn");
  const legend = document.querySelector(".leaflet-bottom.leaflet-right");

  // Auto-hide legend di mobile
  if (window.innerWidth < 768 && legend) legend.style.display = "none";

  // Animasi slide-up tombol
  if (btn && window.innerWidth < 768) {
    setTimeout(() => {
      btn.classList.remove("translate-y-8", "opacity-0");
      btn.classList.add("translate-y-0", "opacity-100");
    }, 400);
  }
});
