/*
  Barème des infractions — Garde de Vendeaume
  amende : nombre ou {min, max} en septims (null si aucune)
  prison : nombre d'heures, ou {max} pour « jusqu'à »
  lien   : "ou" (au choix), "et" (cumulatif), null (une seule peine)
  source : "bareme" = figure au barème officiel ; "texte" = déduit des articles de loi
*/
window.DOMAINES = {
  palais:    "Palais des Rois",
  magie:     "Magie",
  commerce:  "Commerce & marché",
  ordre:     "Ordre public",
  ressources:"Chasse, minage & récolte",
  militaire: "Forces armées",
  patrimoine:"Patrimoine",
  armes:     "Équipements réglementés",
  tenue:     "Tenue & identification"
};

window.INFRACTIONS = [
  /* ---------- DÉLITS (barème) ---------- */
  {
    id: "gemme", cat: "delit", dom: "magie", source: "bareme",
    nom: "Vente d'une gemme spirituelle remplie au-dessus de 50 septims",
    amende: 500, prison: null, lien: null,
    mesures: ["Confiscation possible des gemmes (selon les autorités)"],
    refs: ["magie-iii"],
    notes: ["Prix réglementé : 50 septims l'unité sur tout le territoire.", "Cette infraction figure à la fois dans le barème des délits et dans celui des crimes : classement à clarifier auprès de la Cour."],
    keys: "gemme ame soul gem prix speculation marchand enchantement"
  },
  {
    id: "cor", cat: "delit", dom: "militaire", source: "bareme",
    nom: "Usage non autorisé du Cor de guerre",
    amende: 200, prison: 1, lien: "ou",
    qualif: "Atteinte à la paix de la Châtellerie (art. 3 du Corpus Juriscivilis Imperialis)",
    refs: ["forces-ii"],
    notes: ["Réservé aux forces armées de la Châtellerie et aux personnes autorisées par la Cour."],
    keys: "cor corne trompe alerte alarme souffler"
  },
  {
    id: "etal", cat: "delit", dom: "commerce", source: "bareme",
    nom: "Occupation d'un étal sans citoyenneté ou sans autorisation",
    amende: 500, prison: null, lien: null,
    mesures: ["Retrait de l'étal"],
    refs: ["marches-i", "marches-ii", "marches-comp7"],
    notes: ["Les étals du marché de Vendeaume appartiennent à la Châtellerie et sont réservés aux citoyens.", "Location : 25 septims (citoyen non commerçant) / 20 septims (commerçant reconnu)."],
    keys: "etal etale stand marche location non citoyen"
  },
  {
    id: "commerce", cat: "delit", dom: "commerce", source: "bareme",
    nom: "Exercice d'une activité commerciale sans autorisation",
    amende: 500, prison: 2, lien: "ou",
    qualif: "Corpus Juriscivilis Imperialis",
    refs: ["marches-ii", "palais-iii"],
    notes: ["Toute activité commerciale sur le marché requiert l'autorisation de la Cour d'Estemarche.", "Au Palais : racolage et vente non autorisée par le Jarl ou sa Cour interdits."],
    keys: "vente commerce vendre racolage sollicitation colporteur sans licence"
  },
  {
    id: "illicite", cat: "delit", dom: "commerce", source: "bareme",
    nom: "Vente de marchandises illicites, volées ou prohibées",
    amende: 500, prison: 2, lien: "et",
    qualif: "Corpus Juriscivilis Imperialis",
    mesures: ["Saisie des marchandises et preuves (Loi des marchés, art. IV)"],
    refs: ["marches-iii", "marches-iv"],
    notes: ["S'applique aussi aux marchandises contrefaites ou obtenues par des moyens illicites."],
    keys: "recel vol vole contrefacon contrebande skooma drogue prohibe illegal"
  },
  {
    id: "exterieur", cat: "delit", dom: "commerce", source: "bareme",
    nom: "Commerce d'un marchand extérieur hors du Jour du Marché",
    amende: 300, prison: 1, lien: "et",
    refs: ["marches-v"],
    notes: ["Sauf autorisation exceptionnelle accordée par la Cour."],
    keys: "marchand etranger exterieur jour du marche caravane"
  },
  {
    id: "trouble", cat: "delit", dom: "ordre", source: "bareme",
    nom: "Trouble à l'ordre public (vol, intrusion)",
    amende: 300, prison: 2, lien: "ou",
    refs: ["marches-vi"],
    notes: ["Au marché, peut aussi entraîner la fermeture de l'étal et le retrait de l'autorisation de commerce."],
    keys: "vol voler intrusion effraction bagarre tapage trouble desordre"
  },
  {
    id: "respect-palais", cat: "delit", dom: "palais", source: "bareme",
    nom: "Manque de respect au Palais des Rois",
    amende: 500, prison: 2, lien: "ou",
    refs: ["palais-vii", "palais-iii"],
    notes: ["Si le comportement trouble l'ordre ou le fonctionnement des institutions, il peut être requalifié en atteinte à la paix de l'Empereur (Corpus Juriscivilis Imperialis).", "Couvre aussi : insultes, menaces, altercations, perturbation des audiences, course dans le Palais."],
    keys: "insulte irrespect outrage provocation menace altercation courir audience jarl cour"
  },
  {
    id: "arme-palais", cat: "delit", dom: "palais", source: "bareme",
    nom: "Port d'arme au Palais des Rois",
    amende: 500, prison: 2, lien: "ou",
    mesures: ["Confiscation des armes"],
    refs: ["palais-iii", "palais-vi"],
    notes: ["Vise le port ostentatoire d'armes dégainées."],
    keys: "arme degainee epee hache arc palais"
  },
  {
    id: "obtemperer", cat: "delit", dom: "ordre", source: "bareme",
    nom: "Refus d'obtempérer aux ordres",
    amende: 500, prison: 2, lien: "ou",
    qualif: "Corpus Juriscivilis Imperialis",
    refs: ["palais-vi", "casque-estemarche", "casque-vendeaume"],
    notes: ["Inclut le refus de retirer son masque lors d'un contrôle, et la 3ᵉ interpellation pour port du casque/masque en ville.", "Thalmor, Légion impériale ou gardes d'autres châtelleries : ne rien tenter, faire un rapport."],
    keys: "refus obeir ordre injonction controle fouille resistance fuite"
  },
  {
    id: "ressources", cat: "delit", dom: "ressources", source: "bareme",
    nom: "Chasse, minage ou récolte en Estemarche sans citoyenneté ou autorisation",
    amende: 400, prison: 1, lien: "ou",
    refs: ["code-civil-dc-ii", "code-civil-dc-iii", "code-civil-dc-v"],
    notes: ["Le sel ne peut être extrait qu'avec l'accord du propriétaire de la mine concernée."],
    keys: "chasse braconnage minage mine minerai sel recolte cueillette non citoyen"
  },
  {
    id: "capuche", cat: "delit", dom: "tenue", source: "bareme",
    nom: "Port de la capuche, du casque ou du masque en ville",
    amende: 30, prison: null, lien: null,
    refs: ["casque-vendeaume", "casque-palais", "palais-iii"],
    notes: ["Toujours donner un avertissement avant l'amende.", "3ᵉ interpellation de la même personne = refus d'obtempérer.", "Exceptions (barème) : mages, prêtres, Compagnie Orientale. Voir l'onglet Casque & masque pour la liste complète."],
    keys: "capuche capuchon casque heaume masque visage cagoule identification"
  },
  {
    id: "forge", cat: "delit", dom: "commerce", source: "bareme",
    nom: "Utilisation illégale d'une forge sauvage",
    amende: 500, prison: 2, lien: "ou",
    refs: ["marches-vii"],
    notes: ["Forges reconnues : forge du marché, forge proche du Quartier Gris, forge du Camp Impérial d'Estemarche.", "L'article de loi ne mentionne que l'amende de 500 septims ; le barème ajoute l'alternative de 2 heures."],
    keys: "forge enclume sauvage forgeron"
  },
  {
    id: "statues", cat: "delit", dom: "patrimoine", source: "bareme",
    nom: "Manque de respect des statues d'Ysgramor et nordiques",
    amende: 400, prison: 2, lien: "ou",
    refs: ["nordique-i", "nordique-iv"],
    keys: "statue ysgramor monument irrespect degradation"
  },
  {
    id: "travail", cat: "delit", dom: "commerce", source: "bareme",
    nom: "Travail d'un non-citoyen dans un commerce de Vendeaume",
    amende: 300, prison: 1, lien: "ou",
    refs: [],
    notes: ["Infraction prévue uniquement par le barème (pas d'article détaillé dans le recueil)."],
    keys: "travail emploi employe non citoyen boutique"
  },

  /* ---------- DÉLITS (déduits des décrets) ---------- */
  {
    id: "patrimoine", cat: "delit", dom: "patrimoine", source: "texte",
    nom: "Atteinte au patrimoine nordique (fouille non autorisée, pillage, dégradation, non-déclaration d'une découverte)",
    amende: { min: 500, max: 2500 }, prison: { max: 5 }, lien: "et",
    qualif: "Profanation (art. 10 du Corpus Juriscivilis Imperialis)",
    refs: ["nordique-ii", "nordique-iii", "nordique-iv", "nordique-xi", "nordique-xii"],
    notes: ["Montant et durée fixés par l'autorité judiciaire selon la gravité, les circonstances et les dommages.", "Sites protégés : Tertre d'Ygnol, Ansilvund, Tombeau d'Hillgrund, Sanctuaire du Primarbor, Crête de l'ossuaire, et toute la cité de Vendeaume."],
    keys: "fouille pillage tombe crypte ruine relique artefact profanation archeologie decouverte souterrain"
  },
  {
    id: "geant", cat: "delit", dom: "patrimoine", source: "texte",
    nom: "Chasse, capture ou mise à mort d'un géant",
    amende: { min: 500, max: 2500 }, prison: { max: 5 }, lien: "et",
    qualif: "Profanation (art. 10 du Corpus Juriscivilis Imperialis)",
    refs: ["nordique-viii", "nordique-ix", "nordique-x", "nordique-xii"],
    notes: ["Inclut le prélèvement de défenses, os ou peaux d'un géant abattu illégalement.", "Exception : menace avérée ou mission ordonnée, menée par la Garde, les forces reconnues ou un titulaire de licence de régulation."],
    keys: "geant mammouth chasse defense os peau"
  },
  {
    id: "cimeterre", cat: "delit", dom: "armes", source: "texte",
    nom: "Port, détention ou transport d'un cimeterre sans licence",
    amende: 400, prison: null, lien: null,
    mesures: ["Confiscation du cimeterre, remis ensuite à la Confrérie des Guerriers d'Alik'r"],
    refs: ["rougegarde-ii", "rougegarde-iii", "rougegarde-iv", "rougegarde-comp4"],
    notes: ["Licence personnelle et nominative, délivrée uniquement par la Confrérie des Guerriers d'Alik'r.", "Force uniquement en cas de nécessité."],
    keys: "cimeterre sabre lame courbe rougegarde alikr licence"
  },
  {
    id: "cimeterre-artisan", cat: "delit", dom: "armes", source: "texte",
    nom: "Fabrication, réparation ou vente d'un cimeterre sans mandat de la Confrérie",
    amende: 400, prison: null, lien: null,
    mesures: ["Confiscation des cimeterres ou pièces concernées"],
    refs: ["rougegarde-i", "rougegarde-iv"],
    keys: "forgeron artisan cimeterre vente fabrication rougegarde"
  },
  {
    id: "main-argent", cat: "delit", dom: "armes", source: "texte",
    nom: "Détention, commerce ou dissimulation d'équipement de la Main d'Argent",
    amende: { min: 500, max: 2000 }, prison: { max: 1 }, lien: "et",
    mesures: ["Saisie immédiate de l'équipement"],
    refs: ["main-argent-i", "main-argent-ii", "main-argent-iii", "main-argent-iv", "main-argent-v"],
    notes: ["Sans titre de propriété valide délivré ou reconnu par la Main d'Argent.", "Passé le délai de 5 jours après promulgation, la détention est présumée volontaire."],
    keys: "main d'argent silver hand armure arme poincon equipement"
  },
  {
    id: "brulevapeur", cat: "delit", dom: "ressources", source: "texte",
    nom: "Intrusion ou exploitation illégale de la mine de Brûlevapeur",
    amende: { min: 0, max: 2500 }, prison: null, lien: null, amendeLabel: "Dédommagement",
    qualif: "Infraction à l'art. IV du Corpus Juriscivilis Imperialis",
    refs: ["brulevapeur-i", "brulevapeur-ii", "brulevapeur-iii"],
    notes: ["Dédommagement jusqu'à 2 500 septims, et toute peine supérieure selon les ressources pillées.", "Soustraire, exploiter ou dégrader = circonstance aggravante.", "Catégorie (délit ou crime) non précisée par le décret."],
    keys: "mine brulevapeur longue-braise malachite intrusion pillage"
  },

  /* ---------- CRIMES ---------- */
  {
    id: "baton", cat: "crime", dom: "magie", source: "bareme",
    nom: "Port ou usage d'un bâton de magie sans diplôme de l'Académie de Fortdhiver",
    amende: 2000, prison: 2, lien: "ou",
    qualif: "Art. 11 du Corpus Juriscivilis Imperialis",
    mesures: ["Confiscation définitive du bâton"],
    refs: ["magie-i", "magie-ii"],
    keys: "baton magie staff mage diplome academie fortdhiver"
  },
  {
    id: "magie", cat: "crime", dom: "magie", source: "bareme",
    nom: "Utilisation de la magie non autorisée",
    amende: 1000, prison: 3, lien: "et",
    refs: [],
    notes: ["Infraction prévue uniquement par le barème (pas d'article détaillé dans le recueil)."],
    keys: "sort magie lancer sortilege destruction invocation"
  },
  {
    id: "enchanteur", cat: "crime", dom: "magie", source: "bareme",
    nom: "Exercice de l'activité d'enchanteur sans enregistrement auprès de la Cour",
    amende: 1000, prison: null, lien: null,
    refs: ["magie-iv"],
    keys: "enchanteur enchantement enregistrement"
  },
  {
    id: "armure", cat: "crime", dom: "militaire", source: "bareme",
    nom: "Port non autorisé de l'armure officielle (Sombrages / Stormcloak)",
    amende: 500, prison: 2, lien: "ou",
    qualif: "Usurpation de titre et d'autorité (art. 1 du Corpus Juriscivilis Imperialis)",
    mesures: ["Restitution immédiate de l'armure à la Châtellerie"],
    refs: ["forces-i"],
    keys: "armure sombrage stormcloak usurpation uniforme garde"
  },
  {
    id: "attentat", cat: "crime", dom: "palais", source: "bareme",
    nom: "Tentative d'attentat, complot, espionnage, vol au Palais ou usurpation du Trône",
    amende: null, prison: null, lien: null, peineSpeciale: "Exécution immédiate",
    qualif: "Crime contre la Châtellerie",
    refs: ["palais-iv", "palais-i"],
    notes: ["Inclut le fait de s'asseoir sur le Trône du Jarl ou d'en usurper les attributs."],
    keys: "attentat complot espion espionnage vol palais trone assassinat jarl execution"
  }
];
