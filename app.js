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

  // Article index
  const ART = {};
  LAWS.forEach(law => law.sections.forEach(sec => sec.articles.forEach(a => {
    ART[a.id] = { ...a, law, sec };
  })));
  const artText = a => a.paras.map(p => typeof p === "string" ? p : "• " + p.li).join(" ");
  const refLabel = id => { const a = ART[id]; if (!a) return id; return `${a.law.titre}, ${a.num.replace("Art. ", "art. ")}`; };

  // Infractions linked to an article
  const INF_BY_ART = {};
  INF.forEach(i => i.refs.forEach(r => (INF_BY_ART[r] = INF_BY_ART[r] || []).push(i)));

  // Search haystack for infractions
  INF.forEach(i => {
    i._hay = norm([i.nom, i.keys, i.qualif, (i.notes || []).join(" "), (i.mesures || []).join(" "), DOM[i.dom],
      i.cat === "crime" ? "crime" : "delit", i.refs.map(r => ART[r] ? ART[r].titre + " " + ART[r].law.titre : "").join(" ")].join(" "));
    i._name = norm(i.nom + " " + i.keys);
  });

  const fmtAmende = a => {
    if (a == null) return null;
    if (typeof a === "number") return `${nf(a)} septims`;
    if (!a.min) return `jusqu'à ${nf(a.max)} septims`;
    return `${nf(a.min)} à ${nf(a.max)} septims`;
  };
  const fmtPrison = p => {
    if (p == null) return null;
    if (typeof p === "number") return `${p} h d'emprisonnement`;
    return `jusqu'à ${p.max} h d'emprisonnement`;
  };
  function sanctionHTML(i) {
    if (i.peineSpeciale) return `<span class="s-special">${esc(i.peineSpeciale)}</span>`;
    const parts = [];
    const a = fmtAmende(i.amende), p = fmtPrison(i.prison);
    if (a) parts.push(`<span class="s-amende">${i.amendeLabel ? esc(i.amendeLabel) + " " : ""}${a}</span>`);
    if (p) parts.push(`<span class="s-prison">${p}</span>`);
    let html = parts.join(i.lien === "ou" ? ` <em class="s-op">ou</em> ` : ` <em class="s-op">+</em> `);
    (i.mesures || []).forEach(m => { html += ` <em class="s-op">+</em> <span class="s-mesure">${esc(m)}</span>`; });
    return html;
  }
  function sanctionText(i) {
    if (i.peineSpeciale) return i.peineSpeciale;
    const parts = [fmtAmende(i.amende), fmtPrison(i.prison)].filter(Boolean);
    let t = parts.join(i.lien === "ou" ? " ou " : " + ");
    if (i.amendeLabel && i.amende) t = i.amendeLabel + " " + t;
    (i.mesures || []).forEach(m => t += " + " + m.charAt(0).toLowerCase() + m.slice(1));
    return t;
  }
  const catLabel = c => c === "crime" ? "Crime" : "Délit";

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
    else list.sort((a, b) => (a.i.cat === b.i.cat ? 0 : a.i.cat === "delit" ? -1 : 1));

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
        ${i.qualif ? `<div><dt>Qualification</dt><dd>${esc(i.qualif)}</dd></div>` : ""}
        <div><dt>Origine</dt><dd>${i.source === "bareme" ? "Barème officiel" : "Déduit des articles du décret"}</dd></div>
      </dl>
      ${i.notes && i.notes.length ? `<ul class="notes">${i.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      ${refs.length ? `<div class="refs"><h4>Textes applicables</h4>${refs.map(a => `
        <blockquote class="ref">
          <a class="ref-title" href="#/recueil/${a.id}">${esc(a.law.titre)} — ${esc(a.num)} · ${esc(a.titre)}</a>
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
  function toggleDossier(id) {
    const idx = dossier.findIndex(d => d.id === id);
    const i = INF.find(x => x.id === id);
    if (idx >= 0) { dossier.splice(idx, 1); toast("Retiré du dossier"); }
    else {
      const d = { id, choix: i.lien === "ou" ? "amende" : "both" };
      if (i.amende && typeof i.amende === "object") d.amende = i.amende.min || 0;
      if (i.prison && typeof i.prison === "object") d.prison = i.prison.max;
      dossier.push(d); toast("Ajouté au dossier");
    }
    renderDossier();
  }
  function lineValues(d) {
    const i = INF.find(x => x.id === d.id);
    let amende = 0, prison = 0;
    const a = typeof i.amende === "number" ? i.amende : (i.amende ? d.amende : 0);
    const p = typeof i.prison === "number" ? i.prison : (i.prison ? d.prison : 0);
    if (i.lien === "ou") { if (d.choix === "amende") amende = a; else prison = p; }
    else { amende = a || 0; prison = p || 0; }
    return { i, amende: amende || 0, prison: prison || 0 };
  }
  function renderDossier() {
    const cnt = $("#dossier-count");
    cnt.hidden = !dossier.length; cnt.textContent = dossier.length;
    $("#dossier-empty").hidden = !!dossier.length;
    $("#total-card").classList.toggle("is-empty", !dossier.length);
    const ul = $("#dossier-list");
    ul.innerHTML = dossier.map((d, k) => {
      const i = INF.find(x => x.id === d.id);
      let ctrl = "";
      if (i.lien === "ou") {
        ctrl += `<div class="seg" role="radiogroup" aria-label="Peine retenue">
          <button type="button" class="${d.choix === "amende" ? "is-on" : ""}" data-choix="amende" data-k="${k}">${fmtAmende(i.amende)}</button>
          <button type="button" class="${d.choix === "prison" ? "is-on" : ""}" data-choix="prison" data-k="${k}">${fmtPrison(i.prison)}</button>
        </div>`;
      }
      if (i.amende && typeof i.amende === "object") {
        ctrl += `<label class="range-in">${i.amendeLabel || "Amende"} retenue (${i.amende.min ? nf(i.amende.min) + " – " : "0 – "}${nf(i.amende.max)})
          <input type="number" min="${i.amende.min || 0}" max="${i.amende.max}" step="50" value="${d.amende}" data-amende="${k}"> septims</label>`;
      }
      if (i.prison && typeof i.prison === "object") {
        ctrl += `<label class="range-in">Emprisonnement retenu (max ${i.prison.max} h)
          <input type="number" min="0" max="${i.prison.max}" step="0.5" value="${d.prison}" data-prison="${k}"> h</label>`;
      }
      return `<li class="d-item">
        <div class="d-top">
          <span class="pill pill-${i.cat}">${catLabel(i.cat)}</span>
          <span class="d-name">${esc(i.nom)}</span>
          <button type="button" class="icon-btn sm" data-remove="${d.id}" aria-label="Retirer">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
        <p class="d-sanction">${sanctionHTML(i)}</p>
        ${ctrl ? `<div class="d-ctrl">${ctrl}</div>` : ""}
      </li>`;
    }).join("");
    renderTotal();
  }
  function renderTotal() {
    let amende = 0, prison = 0; const mesures = [], lines = [];
    let execution = false;
    dossier.forEach(d => {
      const v = lineValues(d);
      if (v.i.peineSpeciale) execution = true;
      amende += v.amende; prison += v.prison;
      (v.i.mesures || []).forEach(m => mesures.push(m));
      lines.push(v);
    });
    const delits = dossier.filter(d => INF.find(x => x.id === d.id).cat === "delit").length;
    const crimes = dossier.length - delits;
    $("#total-lines").innerHTML = !dossier.length ? `<p class="muted">Ajoutez des infractions pour calculer la sanction.</p>` : `
      ${execution ? `<div class="tl tl-alert"><span>Peine</span><strong>Exécution immédiate</strong></div>` : ""}
      <div class="tl"><span>Amende totale</span><strong>${nf(amende)} septims</strong></div>
      <div class="tl"><span>Emprisonnement</span><strong>${prison ? nf(prison) + " h" : "—"}</strong></div>
      <div class="tl"><span>Qualification</span><strong>${delits} ${plural(delits, "délit", "délits")} · ${crimes} ${plural(crimes, "crime", "crimes")}</strong></div>
      ${mesures.length ? `<div class="tl tl-col"><span>Mesures</span><ul>${mesures.map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}`;

    const nom = $("#d-nom").value.trim(), lieu = $("#d-lieu").value.trim();
    const out = [];
    if (nom) out.push(`Contrevenant : ${nom}`);
    if (lieu) out.push(`Lieu : ${lieu}`);
    if (dossier.length) {
      if (out.length) out.push("");
      out.push("## Infractions relevées");
      lines.forEach(({ i, amende: a, prison: p }) => {
        const refs = i.refs.filter(r => ART[r]).slice(0, 1).map(refLabel).join("");
        let retenu = i.peineSpeciale ? i.peineSpeciale : [a ? `${nf(a)} septims` : "", p ? `${nf(p)} h d'emprisonnement` : ""].filter(Boolean).join(" + ");
        out.push(`- [${catLabel(i.cat)}] ${i.nom} — ${retenu || "sanction à fixer"}${refs ? ` (${refs})` : ""}`);
      });
      out.push("");
      out.push("## Sanction");
      if (execution) out.push("Peine : exécution immédiate");
      out.push(`Amende totale : ${nf(amende)} septims`);
      if (prison) out.push(`Emprisonnement : ${nf(prison)} h`);
      if (mesures.length) out.push(`Mesures : ${mesures.join(" ; ")}`);
    }
    $("#recap").textContent = out.join("\n") || "Le récapitulatif apparaîtra ici.";
    const m = [];
    if (dossier.length) {
      m.push("Infractions relevées :");
      out.slice(out.indexOf("## Infractions relevées") + 1, out.indexOf("## Sanction") - 1).forEach(l => m.push(l));
      const sanc = [];
      if (execution) sanc.push("exécution immédiate");
      if (amende) sanc.push(`amende de ${nf(amende)} septims`);
      if (prison) sanc.push(`${nf(prison)} h d'emprisonnement`);
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
    if (t.dataset.prison != null) dossier[+t.dataset.prison].prison = clamp(parseFloat(t.value), +t.min, +t.max);
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
    $("#toc").innerHTML = `<p class="toc-label">Sommaire</p><ol>` + LAWS.map(l =>
      `<li><a href="#/recueil/${l.id}" data-law="${l.id}">${esc(l.titre)}</a></li>`).join("") + `</ol>`;
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
    const html = LAWS.map(law => {
      const secs = law.sections.map(sec => {
        const arts = sec.articles.filter(a => {
          if (!tokens.length) return true;
          const hay = norm(law.titre + " " + (sec.titre || "") + " " + a.titre + " " + artText(a));
          return tokens.every(t => hay.includes(t));
        });
        count += arts.length;
        if (!arts.length) return "";
        return `${sec.titre ? `<h3 class="sec-title">${esc(sec.titre)}</h3>` : ""}` + arts.map(a => {
          const linked = INF_BY_ART[a.id] || [];
          let body = "", inList = false;
          a.paras.forEach(p => {
            if (typeof p === "string") { if (inList) { body += "</ul>"; inList = false; } body += `<p>${hl(p, tokens)}</p>`; }
            else { if (!inList) { body += "<ul>"; inList = true; } body += `<li>${hl(p.li, tokens)}</li>`; }
          });
          if (inList) body += "</ul>";
          return `<article class="art" id="art-${a.id}">
            <header><span class="art-num">${esc(a.num)}</span><h4>${hl(a.titre, tokens)}</h4></header>
            ${body}
            ${linked.length ? `<div class="linked"><span>Infractions liées</span>${linked.map(i =>
              `<a class="lk lk-${i.cat}" href="#/bareme/${i.id}">${esc(i.nom)}</a>`).join("")}</div>` : ""}
          </article>`;
        }).join("");
      }).join("");
      if (!secs) return "";
      return `<section class="law" id="law-${law.id}"><header class="law-head"><h2>${esc(law.titre)}</h2><p>${esc(law.resume)}</p></header>${secs}</section>`;
    }).join("");
    $("#lois").innerHTML = html || `<div class="empty"><p><strong>Aucun article ne contient ces termes.</strong></p><p>Vérifiez l'orthographe ou essayez un synonyme.</p></div>`;
    $("#lois-count").textContent = tokens.length ? `${count} ${plural(count, "article trouvé", "articles trouvés")}` : "";
  }
  $("#q-lois").addEventListener("input", renderLois);

  /* ---------- Casque ---------- */
  const casqueForm = $("#casque-form");
  function renderCasque() {
    const f = Object.fromEntries(new FormData(casqueForm));
    const { lieu, piece, qui, fois, refus, urgence } = f;
    $("#fs-urgence").hidden = lieu !== "hors";
    $("#fs-fois").hidden = lieu !== "ville";
    const sensible = ["thalmor", "legion", "garde-ext"].includes(qui);
    let tone = "ok", titre = "", texte = "", sanction = "", add = null, refs = [];

    if (lieu === "hors") {
      refs = ["casque-estemarche"];
      if (refus === "oui") {
        if (sensible) { tone = "warn"; titre = "Ne rien tenter"; texte = "Refus d'une personne du Thalmor, de la Légion impériale ou d'une autre châtellerie : n'intervenez pas et rédigez un rapport."; }
        else { tone = "bad"; titre = "Refus d'obtempérer"; texte = "Refuser d'enlever son masque lors d'un contrôle est un refus d'obtempérer."; sanction = "500 septims ou 2 h d'emprisonnement"; add = "obtemperer"; }
      } else if (urgence === "oui") {
        tone = "warn"; titre = "Autorisation restreinte possible"; texte = "Hors des murs, le port est normalement autorisé, mais cette autorisation peut être restreinte en cas d'état d'urgence. Appliquez les consignes en vigueur.";
      } else { titre = "Autorisé"; texte = "Le port du casque et du masque est autorisé hors des murs de Vendeaume. Le port peut néanmoins être exigé retiré lors d'un contrôle."; }
    }
    else if (lieu === "palais") {
      refs = ["casque-palais", "palais-iii", "palais-vi"];
      if (qui === "jarl" || qui === "cour") { titre = "Autorisé (exception)"; texte = "Au Palais, seules les exceptions accordées par le Jarl ou sa Cour sont valables. Vérifiez que l'exception a bien été attribuée."; }
      else if (refus === "oui") {
        if (sensible) { tone = "warn"; titre = "Ne rien tenter"; texte = "Personne du Thalmor, de la Légion ou d'une autre châtellerie : n'intervenez pas et rédigez un rapport."; }
        else { tone = "bad"; titre = "Refus d'obtempérer"; texte = "Les injonctions de la Garde du Palais doivent être immédiatement exécutées (Code du Palais, art. VI)."; sanction = "500 septims ou 2 h d'emprisonnement"; add = "obtemperer"; }
      } else { tone = "warn"; titre = "Interdit — faire retirer"; texte = "Application stricte du Code du Palais : tout casque, heaume, capuchon ou masque empêchant l'identification est interdit. Aucune des exceptions de la ville ne s'applique au Palais."; }
    }
    else { // ville
      refs = ["casque-vendeaume"];
      const exempt = ["cour", "pretre", "mage", "hullen", "penitus", "jarl", "legion"].includes(qui) ||
        (["thalmor", "garde-ext"].includes(qui) && piece === "casque");
      if (exempt) {
        titre = "Autorisé (exception)";
        const why = { cour: "Membre de la Cour de Vendeaume", pretre: "Prêtre", mage: "Mage", hullen: "Hullen Tong / Compagnie Orientale", penitus: "Penitus Oculatus", jarl: "Personne autorisée par le Jarl", legion: "Légion impériale en tenue", thalmor: "Thalmor — casque uniquement", "garde-ext": "Garde d'une autre châtellerie — casque uniquement" }[qui];
        texte = `Exception prévue : ${why}.`;
      } else if (sensible && (refus === "oui" || fois !== "1")) {
        tone = "warn"; titre = "Ne rien tenter"; texte = qui === "thalmor" || qui === "garde-ext"
          ? "Le casque est toléré mais pas la capuche ni le masque. En cas de refus, n'intervenez pas et rédigez un rapport."
          : "En cas de refus, n'intervenez pas et rédigez un rapport.";
      } else if (refus === "oui" || fois === "3") {
        tone = "bad"; titre = "Refus d'obtempérer"; texte = fois === "3" ? "Troisième interpellation de la même personne pour le port du casque ou du masque." : "Refus de retirer sa pièce lors d'un contrôle.";
        sanction = "500 septims ou 2 h d'emprisonnement"; add = "obtemperer";
      } else if (fois === "2") {
        tone = "bad"; titre = "Amende"; texte = "La personne a déjà reçu un avertissement : appliquez l'amende."; sanction = "30 septims"; add = "capuche";
      } else {
        tone = "warn"; titre = "Avertissement"; texte = "Première interpellation : donnez un avertissement et demandez de retirer la pièce. Aucune amende à ce stade.";
        if (qui === "thalmor" || qui === "garde-ext") texte = "Le casque est toléré, mais pas la capuche ni le masque. " + texte;
        if (qui === "legion-civil") texte = "L'exception de la Légion ne vaut qu'en tenue de légion. " + texte;
      }
    }
    $("#verdict").className = `verdict v-${tone}`;
    $("#verdict").innerHTML = `
      <p class="v-label">Conduite à tenir</p>
      <h2>${esc(titre)}</h2>
      <p>${esc(texte)}</p>
      ${sanction ? `<div class="v-sanction"><span>Sanction</span><strong>${esc(sanction)}</strong></div>` : ""}
      ${add ? `<button type="button" class="btn btn-primary" data-add-casque="${add}">${dossier.some(d => d.id === add) ? "Déjà dans le dossier" : "Ajouter au dossier"}</button>` : ""}
      <div class="v-refs">${refs.map(r => `<a href="#/recueil/${r}">${esc(refLabel(r))}</a>`).join("")}</div>`;
  }
  casqueForm.addEventListener("change", renderCasque);
  $("#verdict").addEventListener("click", e => {
    const b = e.target.closest("[data-add-casque]");
    if (b && !dossier.some(d => d.id === b.dataset.addCasque)) { toggleDossier(b.dataset.addCasque); renderCasque(); }
  });

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

  /* ---------- Routing ---------- */
  function route() {
    const [, view = "bareme", target] = (location.hash || "#/bareme").split("/");
    const v = ["bareme", "rapport", "dossier", "recueil", "casque"].includes(view) ? view : "bareme";
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
    if (v === "casque") renderCasque();
    if (v === "recueil") {
      if (target && $("#q-lois").value) { $("#q-lois").value = ""; renderLois(); }
      const el = target && ($("#art-" + target) || $("#law-" + target));
      $$("#toc a").forEach(a => a.classList.toggle("is-on", !!target && (a.dataset.law === target || (ART[target] && ART[target].law.id === a.dataset.law))));
      if (el) {
        setTimeout(() => { el.scrollIntoView({ block: "start" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }, 80);
      } else window.scrollTo(0, 0);
    } else if (!target) window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  renderToc(); renderLois(); renderDossier(); route();
})();
