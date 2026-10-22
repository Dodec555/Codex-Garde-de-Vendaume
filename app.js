(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const LAWS = window.LAWS, INF = window.INFRACTIONS, DOM = window.DOMAINES;

  /* ---------- Helpers ---------- */
  const norm = s => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, " ");
  const esc = s => (s || "").toString().replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nf = n => n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ");
  const plural = (n, s, p) => n > 1 ? p : s;
  const CAT = { contravention: "Contravention", delit: "Délit", crime: "Crime" };
  const catLabel = c => CAT[c] || c;
  const CAT_ORDER = { contravention: 0, delit: 1, crime: 2 };

  // Article index
  const ART = {};
  LAWS.forEach(law => law.sections.forEach(sec => sec.articles.forEach(a => {
    ART[a.id] = { ...a, law, sec };
  })));
  const artText = a => a.paras.map(p => typeof p === "string" ? p : "• " + p.li).join(" ");
  const refLabel = id => { const a = ART[id]; if (!a) return id; return a.law.doc === "fiche" ? `Fiche de poche, ${a.num}` : `Codex, ${a.num}`; };

  // Infractions linked to an article
  const INF_BY_ART = {};
  INF.forEach(i => i.refs.forEach(r => (INF_BY_ART[r] = INF_BY_ART[r] || []).push(i)));

  // Search haystack for infractions
  INF.forEach(i => {
    i._hay = norm([i.nom, i.keys, i.qualif, (i.notes || []).join(" "), (i.mesures || []).join(" "), DOM[i.dom],
      catLabel(i.cat), i.base, i.refs.map(r => ART[r] ? ART[r].titre + " " + ART[r].law.titre : "").join(" ")].join(" "));
    i._name = norm(i.nom + " " + i.keys);
  });

  const rng = (v, unit) => v == null ? null : typeof v === "number" ? `${nf(v)}${unit}` : `${nf(v.min)} à ${nf(v.max)}${unit}`;
  const fmtAmende = a => rng(a, " septims");
  const fmtHeures = h => rng(h, " h");
  const DEFERE = "Rétention 24 h + déféré au magistrat";
  function sanctionHTML(i) {
    let html;
    if (i.deferre) html = `<span class="s-special">${DEFERE}</span>`;
    else {
      const a = fmtAmende(i.amende), h = fmtHeures(i.heures);
      html = [a && `<span class="s-amende">${a}</span>`, h && `<span class="s-prison">${h} corvée / prison</span>`]
        .filter(Boolean).join(` <em class="s-op">ou</em> `);
    }
    (i.mesures || []).forEach(m => { html += ` <em class="s-op">+</em> <span class="s-mesure">${esc(m)}</span>`; });
    return html;
  }
  function sanctionText(i) {
    let t = i.deferre ? DEFERE : [fmtAmende(i.amende) && `Amende de ${fmtAmende(i.amende)}`, fmtHeures(i.heures) && `${fmtHeures(i.heures)} de corvée`, fmtHeures(i.heures) && `${fmtHeures(i.heures)} d'emprisonnement`].filter(Boolean).join(" OU ");
    (i.mesures || []).forEach(m => t += " + " + m.charAt(0).toLowerCase() + m.slice(1));
    return t;
  }

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  if (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) root.dataset.theme = "dark";
  $("#theme-toggle").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  });

  /* ---------- Barème ---------- */
  const state = { q: "", cat: "all", dom: "all", open: null };
  const domSel = $("#dom-select");
  domSel.innerHTML = `<option value="all">Tous les domaines</option>` +
    Object.entries(DOM).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");

  function score(i, tokens) {
    if (!tokens.length) return 1;
    let s = 0;
    for (const t of tokens) {
      if (i._name.includes(t)) s += 3;
      else if (i._hay.includes(t)) s += 1;
      else return 0;
    }
    return s;
  }
  function renderBareme() {
    const tokens = norm(state.q).split(/\s+/).filter(t => t.length > 1);
    let list = INF.filter(i => (state.cat === "all" || i.cat === state.cat) && (state.dom === "all" || i.dom === state.dom))
      .map(i => ({ i, s: score(i, tokens) })).filter(x => x.s > 0);
    if (tokens.length) list.sort((a, b) => b.s - a.s);
    else list.sort((a, b) => CAT_ORDER[a.i.cat] - CAT_ORDER[b.i.cat]);

    $("#result-count").textContent = `${list.length} ${plural(list.length, "infraction", "infractions")}` +
      (tokens.length ? ` pour « ${state.q.trim()} »` : "");
    const ul = $("#inf-list");
    if (!list.length) {
      ul.innerHTML = `<li class="empty"><p><strong>Aucune infraction ne correspond.</strong></p><p>Essayez un mot plus simple (ex. « vol », « arme », « magie ») ou cherchez dans le <a href="#/recueil">recueil des lois</a>.</p></li>`;
      return;
    }
    ul.innerHTML = list.map(({ i }) => infRow(i)).join("");
  }
  function infRow(i) {
    const open = state.open === i.id;
    const inD = dossier.some(d => d.id === i.id);
    return `<li class="inf ${open ? "is-open" : ""}" id="inf-${i.id}">
      <button class="inf-head" type="button" aria-expanded="${open}" data-open="${i.id}">
        <span class="pill pill-${i.cat}">${catLabel(i.cat)}</span>
        <span class="inf-name">${esc(i.nom)}</span>
        <span class="inf-sanction">${sanctionHTML(i)}</span>
        <span class="inf-dom">${esc(DOM[i.dom])}</span>
        <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      ${open ? infDetail(i, inD) : ""}
    </li>`;
  }
  function infDetail(i, inD) {
    const refs = i.refs.map(r => ART[r]).filter(Boolean);
    return `<div class="inf-body">
      <dl class="facts">
        <div><dt>Catégorie</dt><dd>${catLabel(i.cat)}</dd></div>
        <div><dt>Sanction</dt><dd>${esc(sanctionText(i))}</dd></div>
        <div><dt>Fondement légal</dt><dd>${esc(i.base)}</dd></div>
        <div><dt>Procédure</dt><dd>${i.deferre ? "Arrestation, rétention conservatoire (24 h max) et présentation au magistrat" : "Sanction directe par la Garde ; rétention 24 h en cas de refus ou de contestation"}</dd></div>
      </dl>
      ${i.notes && i.notes.length ? `<ul class="notes">${i.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      ${refs.length ? `<div class="refs"><h4>Textes applicables</h4>${refs.map(a => `
        <blockquote class="ref">
          <a class="ref-title" href="#/recueil/${a.id}">${esc(a.law.doc === "fiche" ? "Fiche de poche" : "Grand Codex")} — ${esc(a.num)} · ${esc(a.titre)}</a>
          <p>${esc(artText(a))}</p>
        </blockquote>`).join("")}</div>` : ""}
      <div class="inf-actions">
        <button type="button" class="btn ${inD ? "btn-ghost" : "btn-primary"}" data-add="${i.id}">${inD ? "Retirer du dossier" : "Ajouter au dossier"}</button>
      </div>
    </div>`;
  }

  $("#q").addEventListener("input", e => { state.q = e.target.value; state.open = null; renderBareme(); });
  $("#cat-chips").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    state.cat = b.dataset.cat;
    $$("#cat-chips .chip").forEach(c => c.classList.toggle("is-on", c === b));
    renderBareme();
  });
  domSel.addEventListener("change", e => { state.dom = e.target.value; renderBareme(); });
  $("#inf-list").addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { toggleDossier(add.dataset.add); renderBareme(); return; }
    const o = e.target.closest("[data-open]");
    if (o) { state.open = state.open === o.dataset.open ? null : o.dataset.open; renderBareme(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      if (location.hash.startsWith("#/recueil")) $("#q-lois").focus(); else { location.hash = "#/bareme"; $("#q").focus(); }
    }
  });

  /* ---------- Dossier ---------- */
  let dossier = [];
  let dossierSummary = { mesures: "", nom: "", lieu: "" };
  const lo = v => v == null ? 0 : typeof v === "number" ? v : v.min;
  const hi = v => v == null ? 0 : typeof v === "number" ? v : v.max;
  const MODES = { amende: "Amende", corvee: "Corvée", prison: "Prison" };
  function toggleDossier(id) {
    const idx = dossier.findIndex(d => d.id === id);
    const i = INF.find(x => x.id === id);
    if (idx >= 0) { dossier.splice(idx, 1); toast("Retiré du dossier"); }
    else {
      dossier.push({ id, choix: i.deferre ? "deferre" : "amende", amende: lo(i.amende), heures: lo(i.heures) });
      toast("Ajouté au dossier");
    }
    renderDossier();
  }
  function lineValues(d) {
    const i = INF.find(x => x.id === d.id);
    const v = { i, amende: 0, corvee: 0, prison: 0, deferre: !!i.deferre };
    if (!i.deferre) {
      if (d.choix === "amende") v.amende = d.amende;
      else if (d.choix === "corvee") v.corvee = d.heures;
      else v.prison = d.heures;
    }
    return v;
  }
  const retenuText = v => v.deferre ? DEFERE : v.amende ? `amende de ${nf(v.amende)} septims` : v.corvee ? `${nf(v.corvee)} h de corvée` : `${nf(v.prison)} h d'emprisonnement`;
  function renderDossier() {
    const cnt = $("#dossier-count");
    cnt.hidden = !dossier.length; cnt.textContent = dossier.length;
    $("#dossier-empty").hidden = !!dossier.length;
    $("#total-card").classList.toggle("is-empty", !dossier.length);
    const ul = $("#dossier-list");
    ul.innerHTML = dossier.map((d, k) => {
      const i = INF.find(x => x.id === d.id);
      let ctrl = "";
      if (!i.deferre) {
        ctrl += `<div class="seg" role="radiogroup" aria-label="Option choisie par le prévenu">${Object.entries(MODES).map(([m, lab]) =>
          `<button type="button" class="${d.choix === m ? "is-on" : ""}" data-choix="${m}" data-k="${k}">${lab}</button>`).join("")}</div>`;
        if (d.choix === "amende" && typeof i.amende === "object")
          ctrl += `<label class="range-in">Montant retenu (${nf(i.amende.min)} – ${nf(i.amende.max)})
            <input type="number" min="${i.amende.min}" max="${i.amende.max}" step="50" value="${d.amende}" data-amende="${k}"> septims</label>`;
        if (d.choix !== "amende" && typeof i.heures === "object")
          ctrl += `<label class="range-in">Durée retenue (${i.heures.min} – ${i.heures.max} h)
            <input type="number" min="${i.heures.min}" max="${i.heures.max}" step="1" value="${d.heures}" data-heures="${k}"> h</label>`;
      } else ctrl = `<p class="d-deferre">Pas de sanction directe : placement en rétention conservatoire et présentation au magistrat.</p>`;
      return `<li class="d-item">
        <div class="d-top">
          <span class="pill pill-${i.cat}">${catLabel(i.cat)}</span>
          <span class="d-name">${esc(i.nom)}</span>
          <button type="button" class="icon-btn sm" data-remove="${d.id}" aria-label="Retirer">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
        <p class="d-sanction">${sanctionHTML(i)}</p>
        <div class="d-ctrl">${ctrl}</div>
      </li>`;
    }).join("");
    renderTotal();
  }
  function renderTotal() {
    let amende = 0, corvee = 0, prison = 0, deferres = 0; const mesures = [], lines = [];
    dossier.forEach(d => {
      const v = lineValues(d);
      amende += v.amende; corvee += v.corvee; prison += v.prison; if (v.deferre) deferres++;
      (v.i.mesures || []).forEach(m => { if (!mesures.includes(m)) mesures.push(m); });
      lines.push(v);
    });
    const n = c => dossier.filter(d => INF.find(x => x.id === d.id).cat === c).length;
    const nc = n("contravention"), nd = n("delit"), ncr = n("crime");
    $("#total-lines").innerHTML = !dossier.length ? `<p class="muted">Ajoutez des infractions pour calculer la sanction.</p>` : `
      ${deferres ? `<div class="tl tl-alert"><span>Procédure</span><strong>Rétention 24 h + déféré au magistrat</strong></div>` : ""}
      <div class="tl"><span>Amende totale</span><strong>${amende ? nf(amende) + " septims" : "—"}</strong></div>
      <div class="tl"><span>Corvée</span><strong>${corvee ? nf(corvee) + " h" : "—"}</strong></div>
      <div class="tl"><span>Emprisonnement</span><strong>${prison ? nf(prison) + " h" : "—"}</strong></div>
      <div class="tl"><span>Qualification</span><strong>${[nc && `${nc} ${plural(nc, "contravention", "contraventions")}`, nd && `${nd} ${plural(nd, "délit", "délits")}`, ncr && `${ncr} ${plural(ncr, "crime", "crimes")}`].filter(Boolean).join(" · ")}</strong></div>
      ${mesures.length ? `<div class="tl tl-col"><span>Mesures</span><ul>${mesures.map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}
      <p class="tl-hint">En cas de refus d'exécution, de contestation ou de rébellion : rétention conservatoire 24 h max.</p>`;

    const nom = $("#d-nom").value.trim(), lieu = $("#d-lieu").value.trim();
    const out = [];
    if (nom) out.push(`Contrevenant : ${nom}`);
    if (lieu) out.push(`Lieu : ${lieu}`);
    const infLines = lines.map(v => `- [${catLabel(v.i.cat)}] ${v.i.nom} — ${retenuText(v)} (${v.i.base})`);
    const sanc = [];
    if (amende) sanc.push(`amende de ${nf(amende)} septims`);
    if (corvee) sanc.push(`${nf(corvee)} h de corvée`);
    if (prison) sanc.push(`${nf(prison)} h d'emprisonnement`);
    if (deferres) sanc.push("rétention conservatoire (24 h max) et déféré au magistrat");
    if (dossier.length) {
      if (out.length) out.push("");
      out.push("## Infractions relevées", ...infLines, "", "## Sanction");
      if (amende) out.push(`Amende totale : ${nf(amende)} septims`);
      if (corvee) out.push(`Corvée : ${nf(corvee)} h`);
      if (prison) out.push(`Emprisonnement : ${nf(prison)} h`);
      if (deferres) out.push("Procédure : rétention conservatoire (24 h max) et déféré au magistrat");
      if (mesures.length) out.push(`Mesures : ${mesures.join(" ; ")}`);
    }
    $("#recap").textContent = out.join("\n") || "Le récapitulatif apparaîtra ici.";
    const m = [];
    if (dossier.length) {
      m.push("Infractions relevées :", ...infLines);
      m.push(`Sanction appliquée : ${sanc.join(" + ") || "à fixer"}`);
      if (mesures.length) m.push(`Mesures complémentaires : ${mesures.join(" ; ")}`);
    }
    dossierSummary = { mesures: m.join("\n"), nom, lieu };
  }
  $("#dossier-list").addEventListener("click", e => {
    const r = e.target.closest("[data-remove]"); if (r) { toggleDossier(r.dataset.remove); return; }
    const c = e.target.closest("[data-choix]");
    if (c) { dossier[+c.dataset.k].choix = c.dataset.choix; renderDossier(); }
  });
  $("#dossier-list").addEventListener("input", e => {
    const t = e.target;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, isNaN(v) ? lo : v));
    if (t.dataset.amende != null) dossier[+t.dataset.amende].amende = clamp(parseFloat(t.value), +t.min, +t.max);
    if (t.dataset.heures != null) dossier[+t.dataset.heures].heures = clamp(parseFloat(t.value), +t.min, +t.max);
    renderTotal();
  });
  ["#d-nom", "#d-lieu"].forEach(s => $(s).addEventListener("input", renderTotal));
  $("#clear-dossier").addEventListener("click", () => { dossier = []; renderDossier(); toast("Dossier vidé"); });
  $("#copy-recap").addEventListener("click", async () => {
    const txt = $("#recap").textContent;
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (_) {
      const ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
      ta.remove();
    }
    $("#copy-msg").textContent = ok ? "Copié. Collez-le dans la rubrique « Mesures prises » de votre rapport." : "Copie impossible : sélectionnez le texte manuellement.";
  });

  /* ---------- Recueil ---------- */
  function renderToc() {
    const group = doc => LAWS.filter(l => l.doc === doc).map(l => {
      const subs = l.sections.map((s, k) => s.titre && l.doc === "codex" ? `<li><a class="toc-sub" href="#/recueil/${l.id}-s${k}" data-law="${l.id}">${esc(s.titre.replace(/^Titre ([IVX]+) — /, "$1. "))}</a></li>` : "").join("");
      return `<li><a href="#/recueil/${l.id}" data-law="${l.id}">${esc(l.titre)}</a>${subs ? `<ol class="toc-subs">${subs}</ol>` : ""}</li>`;
    }).join("");
    $("#toc").innerHTML = `<p class="toc-label">Grand Codex d'Estemarche</p><ol>${group("codex")}</ol>
      <p class="toc-label">Fiche de poche du garde</p><ol>${group("fiche")}</ol>`;
  }
  function hl(text, tokens) {
    let h = esc(text);
    if (!tokens.length) return h;
    // highlight on accent-insensitive match by building regex from normalized positions
    const n = norm(text);
    const marks = [];
    tokens.forEach(t => { let p = 0; while ((p = n.indexOf(t, p)) >= 0) { marks.push([p, p + t.length]); p += t.length; } });
    if (!marks.length) return h;
    marks.sort((a, b) => a[0] - b[0]);
    let out = "", last = 0;
    marks.forEach(([s, e]) => { if (s < last) return; out += esc(text.slice(last, s)) + "<mark>" + esc(text.slice(s, e)) + "</mark>"; last = e; });
    return out + esc(text.slice(last));
  }
  function renderLois() {
    const q = $("#q-lois").value;
    const tokens = norm(q).split(/\s+/).filter(t => t.length > 1);
    let count = 0;
    let lastDoc = null;
    const html = LAWS.map(law => {
      const secs = law.sections.map((sec, k) => {
        const arts = sec.articles.filter(a => {
          if (!tokens.length) return true;
          const hay = norm(law.titre + " " + (sec.titre || "") + " " + a.titre + " " + artText(a));
          return tokens.every(t => hay.includes(t));
        });
        count += arts.length;
        if (!arts.length) return "";
        let chap = null;
        return `${sec.titre ? `<h3 class="sec-title" id="sec-${law.id}-s${k}">${esc(sec.titre)}</h3>` : ""}` + arts.map(a => {
          const chapHTML = a.chap && a.chap !== chap ? `<h4 class="chap-title">${esc(a.chap)}</h4>` : "";
          chap = a.chap || chap;
          const linked = INF_BY_ART[a.id] || [];
          let body = "", inList = false;
          a.paras.forEach(p => {
            if (typeof p === "string") { if (inList) { body += "</ul>"; inList = false; } body += `<p>${hl(p, tokens)}</p>`; }
            else { if (!inList) { body += /^\d+\.\s/.test(p.li) ? `<ul class="numbered">` : "<ul>"; inList = true; } body += `<li>${hl(p.li, tokens)}</li>`; }
          });
          if (inList) body += "</ul>";
          return chapHTML + `<article class="art" id="art-${a.id}">
            <header><span class="art-num">${esc(a.num)}</span><h4>${hl(a.titre, tokens)}</h4></header>
            ${body}
            ${linked.length ? `<div class="linked"><span>Infractions liées</span>${linked.map(i =>
              `<a class="lk lk-${i.cat}" href="#/bareme/${i.id}">${esc(i.nom)}</a>`).join("")}</div>` : ""}
          </article>`;
        }).join("");
      }).join("");
      if (!secs) return "";
      const docHead = law.doc !== lastDoc ? `<p class="doc-label">${law.doc === "fiche" ? "Fiche de poche du garde d'Estemarche" : "Grand Codex d'Estemarche"}</p>` : "";
      lastDoc = law.doc;
      return docHead + `<section class="law" id="law-${law.id}"><header class="law-head"><h2>${esc(law.titre)}</h2><p>${esc(law.resume)}</p></header>${secs}</section>`;
    }).join("");
    $("#lois").innerHTML = html || `<div class="empty"><p><strong>Aucun article ne contient ces termes.</strong></p><p>Vérifiez l'orthographe ou essayez un synonyme.</p></div>`;
    $("#lois-count").textContent = tokens.length ? `${count} ${plural(count, "article trouvé", "articles trouvés")}` : "";
  }
  $("#q-lois").addEventListener("input", renderLois);

  /* ---------- Rapport (modèle du générateur PowerShell) ---------- */
  const rForm = $("#rapport-form");
  const pad = n => String(n).padStart(2, "0");
  const nowStr = () => { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  $("#r-date").value = nowStr();
  const SECTIONS = [["resume", "Résumé"], ["personnes", "Personnes concernées"], ["faits", "Faits confirmés"], ["verifier", "Informations à vérifier"], ["mesures", "Mesures prises"], ["suite", "Suite recommandée"]];
  function buildReport() {
    const f = Object.fromEntries(new FormData(rForm));
    const t = k => (f[k] || "").trim();
    const multi = k => (f[k] || "").replace(/\s+$/, "").replace(/^\s*\n/, "");
    const L = ["# Rapport", ""];
    [["Auteur", "auteur"], ["Date", "date"], ["Lieu", "lieu"], ["Priorité", "priorite"], ["Statut", "statut"]]
      .forEach(([lab, k]) => { if (t(k)) L.push(`${lab} : ${t(k)}`); });
    SECTIONS.forEach(([k, lab]) => { const v = multi(k); if (v.trim()) { L.push("", `## ${lab}`, v); } });
    if (t("auteur")) L.push("", "---", "", "Pour la Garde de Vendeaume,", t("auteur"));
    return L.join("\n");
  }
  function renderReport() { $("#r-out").textContent = buildReport(); }
  rForm.addEventListener("input", renderReport);
  rForm.addEventListener("change", renderReport);
  $("#r-now").addEventListener("click", () => { $("#r-date").value = nowStr(); renderReport(); });
  function importDossier() {
    if (!dossier.length) { toast("Le dossier est vide"); return false; }
    const set = (name, val, append) => {
      const el = rForm.elements[name]; if (!val) return;
      if (append && el.value.trim() && !el.value.includes(val)) el.value = el.value.replace(/\s+$/, "") + "\n" + val;
      else if (!el.value.trim()) el.value = val;
    };
    const mes = rForm.elements.mesures;
    mes.value = mes.value.trim() && !mes.value.includes("Infractions relevées :") ? mes.value.replace(/\s+$/, "") + "\n" + dossierSummary.mesures : dossierSummary.mesures;
    set("personnes", dossierSummary.nom, true);
    set("lieu", dossierSummary.lieu, false);
    renderReport(); toast("Dossier importé dans le rapport"); return true;
  }
  $("#r-import").addEventListener("click", importDossier);
  $("#to-rapport").addEventListener("click", () => { if (importDossier()) location.hash = "#/rapport"; });
  $("#r-reset").addEventListener("click", () => {
    rForm.reset(); $("#r-date").value = nowStr(); $("#r-msg").textContent = ""; renderReport();
  });
  async function copyText(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (_) {
      const ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
      ta.remove(); return ok;
    }
  }
  $("#r-copy").addEventListener("click", async () => {
    const ok = await copyText(buildReport());
    $("#r-msg").textContent = ok ? "Rapport copié dans le presse-papiers. Collez-le avec Ctrl+V." : "Copie impossible : sélectionnez le texte de l'aperçu manuellement.";
  });
  renderReport();

  /* ---------- Mur des croquis (dossier « Mur des croquis » du site) ----------
     Hébergé sur GitHub Pages : le contenu du dossier est lu en direct via l'API publique GitHub,
     donc toute image envoyée dans le dépôt apparaît sans script ni index à maintenir.
     Ailleurs (serveur local) : lecture de la liste du dossier si le serveur l'expose. */
  const CQ_NAME = "Mur des croquis";
  const CQ_DIR = CQ_NAME + "/";
  const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
  const cqTitle = n => n.split("/").pop().replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const cqSort = (x, y) => x.group.localeCompare(y.group, "fr") || x.name.localeCompare(y.name, "fr", { numeric: true });
  let cqItems = [];
  let cqState = "loading"; // loading | ok | error
  let cqError = "";
  // Dépôt GitHub : réglage manuel possible (domaine personnalisé), sinon déduit de l'adresse xxx.github.io/depot/
  function cqRepo() {
    const cfg = window.CODEX_GITHUB || {};
    if (cfg.owner && cfg.repo) return cfg;
    const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!m) return null;
    const seg = location.pathname.split("/").filter(Boolean)[0];
    const repo = seg && !/\.html?$/i.test(seg) ? seg : `${m[1]}.github.io`;
    return { owner: m[1], repo, branch: cfg.branch };
  }
  async function cqFromGitHub(gh) {
    const api = `https://api.github.com/repos/${gh.owner}/${gh.repo}`;
    const get = async u => { const r = await fetch(u, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 403 ? "limite de consultation GitHub atteinte, réessayez dans quelques minutes" : `GitHub a répondu ${r.status}`);
      return r.json(); };
    const branch = gh.branch || (await get(api)).default_branch;
    const tree = await get(`${api}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const re = new RegExp(`(^|/)${CQ_NAME}/(.+)$`, "i");
    const hits = (tree.tree || []).filter(t => t.type === "blob" && IMG_RE.test(t.path) && re.test(t.path));
    // S'il existe plusieurs dossiers « Mur des croquis », on garde le moins profond (celui du site)
    const depth = t => t.path.toLowerCase().indexOf(CQ_NAME.toLowerCase() + "/");
    const best = Math.min(...hits.map(depth));
    return hits.filter(t => depth(t) === best).map(t => {
      const rel = t.path.match(re)[2], parts = rel.split("/"), name = parts.pop();
      return { name, group: parts.join(" / "),
        url: `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${encodeURIComponent(branch)}/${t.path.split("/").map(encodeURIComponent).join("/")}` };
    });
  }
  async function cqFromListing(path, group, depth) {
    if (depth > 3) return [];
    let html;
    try { const r = await fetch(encodeURI(CQ_DIR + path), { cache: "no-store" }); if (!r.ok) return []; html = await r.text(); }
    catch (err) { return []; }
    const doc = new DOMParser().parseFromString(html, "text/html"), out = [];
    for (const a of doc.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (!href || /^(\.\.|\/|\?|#|[a-z]+:)/i.test(href)) continue;
      const nm = decodeURIComponent(href);
      if (nm.endsWith("/")) out.push(...await cqFromListing(path + nm, (group ? group + " / " : "") + nm.slice(0, -1), depth + 1));
      else if (IMG_RE.test(nm)) out.push({ name: nm, group, url: encodeURI(CQ_DIR + path + nm) });
    }
    return out;
  }
  async function cqLoad() {
    cqState = "loading"; renderCroquis();
    try {
      const gh = cqRepo();
      cqItems = (gh ? await cqFromGitHub(gh) : await cqFromListing("", "", 0)).sort(cqSort);
      cqState = "ok";
    } catch (err) { cqItems = []; cqState = "error"; cqError = err.message || "lecture impossible"; }
    renderCroquis();
  }
  function renderCroquis() {
    const all = cqItems;
    $("#cq-help").hidden = all.length > 0 || cqState === "loading";
    $("#cq-toolbar").hidden = !all.length;
    const nG = new Set(all.map(c => c.group).filter(Boolean)).size;
    $("#cq-source-status").textContent = cqState === "loading" ? "Lecture du dossier…"
      : cqState === "error" ? `Dossier illisible : ${cqError}.`
      : all.length ? `${all.length} croquis${nG ? ` répartis en ${nG + (all.some(c => !c.group) ? 1 : 0)} rubriques` : ""}.`
      : "Aucune image dans le dossier pour l'instant.";
    $("#cq-refresh").disabled = cqState === "loading";
    const q = norm($("#cq-q").value || "");
    const shown = all.map((c, k) => ({ ...c, k })).filter(c => !q || norm(cqTitle(c.name) + " " + c.group).includes(q));
    $("#cq-count").textContent = `${shown.length} croquis affiché${shown.length > 1 ? "s" : ""}`;
    const groups = new Map();
    shown.forEach(c => { if (!groups.has(c.group)) groups.set(c.group, []); groups.get(c.group).push(c); });
    $("#cq-groups").innerHTML = [...groups].map(([g, list]) => `
      ${groups.size > 1 || g ? `<h2 class="cq-h2">${esc(g || "Divers")} <span class="g-sub">(${list.length})</span></h2>` : ""}
      <ul class="cq-grid">${list.map(c => `<li><button type="button" class="cq-card" data-cq="${c.k}">
        <img src="${c.url}" alt="${esc(cqTitle(c.name))}" loading="lazy"><span>${esc(cqTitle(c.name))}</span></button></li>`).join("")}</ul>`).join("")
      || (all.length ? `<p class="g-sub">Aucun croquis ne correspond au filtre.</p>` : "");
  }
  $("#cq-q").addEventListener("input", renderCroquis);
  $("#cq-refresh").addEventListener("click", cqLoad);
  cqLoad();
  const lb = $("#lightbox");
  let lbIdx = -1;
  const lbList = () => cqItems;
  function lbShow(k) {
    const list = lbList(); if (!list.length) return;
    lbIdx = (k + list.length) % list.length; const c = list[lbIdx];
    $("#lb-img").src = c.url; $("#lb-img").alt = cqTitle(c.name);
    $("#lb-cap").textContent = (c.group ? c.group + " — " : "") + cqTitle(c.name) + `  (${lbIdx + 1}/${list.length})`;
    lb.hidden = false;
  }
  $("#cq-groups").addEventListener("click", e => {
    const b = e.target.closest("[data-cq]"); if (!b) return;
    lbShow(+b.dataset.cq); $("#lb-close").focus();
  });
  const closeLb = () => { lb.hidden = true; };
  $("#lb-close").addEventListener("click", closeLb);
  $("#lb-prev").addEventListener("click", e => { e.stopPropagation(); lbShow(lbIdx - 1); });
  $("#lb-next").addEventListener("click", e => { e.stopPropagation(); lbShow(lbIdx + 1); });
  lb.addEventListener("click", e => { if (e.target === lb) closeLb(); });
  document.addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLb();
    else if (e.key === "ArrowLeft") lbShow(lbIdx - 1);
    else if (e.key === "ArrowRight") lbShow(lbIdx + 1);
  });

  /* ---------- Routing ---------- */
  function route() {
    const [, view = "bareme", target] = (location.hash || "#/bareme").split("/");
    const v = ["bareme", "rapport", "dossier", "recueil", "croquis"].includes(view) ? view : "bareme";
    $$(".view").forEach(el => el.hidden = el.id !== "view-" + v);
    $$(".tabs a").forEach(a => a.classList.toggle("is-on", a.dataset.tab === v));
    if (v === "bareme") {
      if (target && INF.some(i => i.id === target)) {
        state.q = ""; $("#q").value = ""; state.cat = "all"; state.dom = "all"; domSel.value = "all";
        $$("#cat-chips .chip").forEach(c => c.classList.toggle("is-on", c.dataset.cat === "all"));
        state.open = target; renderBareme();
        setTimeout(() => { const el = $("#inf-" + target); el && el.scrollIntoView({ block: "start" }); }, 80);
      } else renderBareme();
    }
    if (v === "dossier") renderDossier();
    if (v === "croquis") renderCroquis();
    if (v === "recueil") {
      if (target && $("#q-lois").value) { $("#q-lois").value = ""; renderLois(); }
      const el = target && ($("#art-" + target) || $("#sec-" + target) || $("#law-" + target));
      $$("#toc a").forEach(a => a.classList.toggle("is-on", !!target && !a.classList.contains("toc-sub") && (target.startsWith(a.dataset.law) || (ART[target] && ART[target].law.id === a.dataset.law))));
      if (el) {
        setTimeout(() => { el.scrollIntoView({ block: "start" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }, 80);
      } else window.scrollTo(0, 0);
    } else if (!target) window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  renderToc(); renderLois(); renderDossier(); route();
})();
