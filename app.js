import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.44.0/+esm';
import { v4 as uuidv4 } from 'https://cdn.jsdelivr.net/npm/uuid@latest/+esm';

console.log('app.js démarré');
const supabase = createClient(
  'https://auiimdeorutwndunxrcr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aWltZGVvcnV0d25kdW54cmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDI4MjgsImV4cCI6MjA1NzgxODgyOH0.A2VfxrLNjDQMTi5mMCdp-ppf-quDsM4OW-pL5p2QbQM'
);

let allSubjects = [];

async function loadSubjects() {
  console.log('Chargement des sujets...');
  const { data, error } = await supabase
    .from('subjects')
    .select('*, categories(name)')
    .order('date', { ascending: false });
  if (error) {
    console.error('Erreur chargement sujets :', error);
    return;
  }
  console.log('Sujets chargés :', data);
  allSubjects = data;

  const trending = data.filter(s => (s.replyCount > 2) && !s.isPrivate);
  document.getElementById('trending').innerHTML = trending.map(s => `
    <div class="bg-white p-4 rounded shadow min-w-[250px]">
      <h3 class="font-semibold">${s.titre} <span class="text-sm text-gray-500">(${s.categories.name})</span></h3>
      <p class="text-sm text-gray-600">${s.message.substring(0, 50)}...</p>
      <a href="discussion.html?id=${s.id}" class="text-blue-500 hover:underline">Voir</a>
    </div>
  `).join('');

  const categories = [...new Set(data.filter(s => !s.isPrivate).map(s => s.categories.name))];
  document.getElementById('categories').innerHTML = `<button class="bg-gray-200 p-2 rounded hover:bg-gray-300" onclick="filterByCategory('all')">Toutes</button>` + 
    categories.map(cat => `<button class="bg-gray-200 p-2 rounded hover:bg-gray-300" onclick="filterByCategory('${cat}')">${cat}</button>`).join('');

  renderForums(data.filter(s => !s.isPrivate));
}

function renderForums(subjects) {
  console.log('Rendu des forums :', subjects);
  document.getElementById('forums').innerHTML = subjects.map(s => `
    <div class="bg-white p-4 rounded shadow hover:shadow-lg transition-shadow">
      <h3 class="font-semibold">${s.titre} <span class="text-sm text-gray-500">(${s.categories.name})</span></h3>
      <p class="text-sm text-gray-600">${s.message.substring(0, 100)}...</p>
      ${s.fileUrl ? `<a href="${s.fileUrl}" target="_blank" class="text-blue-500 underline">Fichier</a>` : ''}
      <p class="text-sm text-gray-500">Par ${s.pseudo} - ${new Date(s.date).toLocaleString('fr-FR')}</p>
      <p class="text-sm text-gray-500">Réponses : ${s.replyCount || 0} | Participants : ${s.participantCount || 0}</p>
      <div class="flex space-x-2 mt-2">
        <a href="discussion.html?id=${s.id}" class="text-blue-500 hover:underline">Discuter</a>
        <button class="text-primary-500 hover:text-primary-700 transition share-btn" data-id="${s.id}">
          <i data-feather="share-2" class="h-5 w-5"></i> Partager
        </button>
        <button class="text-primary-500 hover:text-primary-700 transition copy-btn" data-id="${s.id}">
          <i data-feather="copy" class="h-5 w-5"></i> Copier lien
        </button>
      </div>
    </div>
  `).join('');
  feather.replace();
}

window.filterByCategory = (category) => {
  console.log('Filtrage par catégorie :', category);
  if (category === 'all') renderForums(allSubjects.filter(s => !s.isPrivate));
  else renderForums(allSubjects.filter(s => s.categories.name === category && !s.isPrivate));
};

//fonction pour charger les catégories officielles au démarrage
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_official', true)
    .order('name');
  if (error) {
    console.error('Erreur chargement catégories :', error);
    return;
  }
  const categorySelect = document.getElementById('category');
  categorySelect.innerHTML = '<option value="" disabled selected>Choisir une catégorie</option>' +
    data.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('') +
    '<option value="other">Autre</option>';
}


const createBtn = document.getElementById('createForumBtn');
const createPopup = document.getElementById('createForumPopup');
const createForm = document.getElementById('createForm');
const pseudoInput = document.getElementById('pseudo');
const privateCheckbox = document.getElementById('isPrivate');
const passwordInput = document.getElementById('password');
const cancelBtn = document.getElementById('cancelForumBtn');
let userPseudo = localStorage.getItem('forumPseudo') || '';

if (userPseudo) pseudoInput.value = userPseudo;

createBtn.addEventListener('click', () => {
  console.log('Bouton de création cliqué');
  createPopup.classList.remove('hidden');
});

cancelBtn.addEventListener('click', () => {
  console.log('Annulation du popup');
  createPopup.classList.add('hidden');
  createForm.reset();
});

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('Formulaire de création soumis');
  const categoryId = document.getElementById('category').value;
  const customCategory = document.getElementById('customCategory').value.trim().toLowerCase();
  const pseudo = pseudoInput.value.trim() || 'Anonyme';
  if (pseudo !== 'Anonyme') localStorage.setItem('forumPseudo', pseudo);

  const isPrivate = privateCheckbox.checked;
  const password = passwordInput.value.trim();
  const titre = createForm.titre.value.trim();

  if (isPrivate && !password) {
    alert('Un mot de passe est requis pour un forum privé.');
    return;
  }

  // Vérifier l’unicité du titre
  const { data: existingSubject } = await supabase
    .from('subjects')
    .select('id')
    .eq('titre', titre)
    .single();
  if (existingSubject) {
    alert('Ce titre existe déjà. Veuillez choisir un titre unique.');
    return;
  }

  const subjectId = uuidv4();
  const subject = {
    id: subjectId,
    titre,
    message: createForm.message.value.trim(),
    pseudo,
    date: Date.now(),
    replyCount: 0,
    participantcount: 0,
    isPrivate,
    password: isPrivate ? password : null,
  };

  // Gestion de la catégorie
  if (categoryId === 'other') {
    if (!customCategory) {
      alert('Veuillez proposer une catégorie.');
      return;
    }
    const { data: diversCat } = await supabase
      .from('categories')
      .select('id')
      .eq('name', 'Divers')
      .single();
    subject.category_id = diversCat.id;
    subject.suggested_category = customCategory;

    const { data: existingSuggestion } = await supabase
      .from('category_suggestions')
      .select('*')
      .eq('name', customCategory)
      .single();

    if (existingSuggestion) {
      await supabase
        .from('category_suggestions')
        .update({ proposal_count: existingSuggestion.proposal_count + 1 })
        .eq('id', existingSuggestion.id);
    } else {
      await supabase
        .from('category_suggestions')
        .insert({ name: customCategory, proposed_by: pseudo });
    }
    await validateSuggestions();
  } else {
    subject.category_id = categoryId;
  }

  if (!subject.titre || !subject.message) {
    alert('Tous les champs (Titre, Message) sont obligatoires.');
    return;
  }

  const { data: subjectData, error: subjectError } = await supabase.from('subjects').insert(subject).select();
  if (subjectError) {
    console.error('Erreur insertion sujet :', subjectError);
    alert('Erreur création forum : ' + subjectError.message);
    return;
  }

  const initialReply = {
    id: uuidv4(),
    subjectid: subjectId,
    pseudo,
    texte: createForm.message.value.trim(),
    date: Date.now(),
    replyingTo: null
  };
  const { error: replyError } = await supabase.from('replies').insert(initialReply);
  if (replyError) {
    console.error('Erreur insertion réponse :', replyError);
    alert('Erreur message initial : ' + replyError.message);
    return;
  }

  createPopup.classList.add('hidden');
  createForm.reset();
  pseudoInput.value = pseudo;
  alert('Forum créé avec succès !');
  loadSubjects();
});

// Fonction de validation automatique
async function validateSuggestions() {
  const THRESHOLD = 5; // Seuil pour qu'une suggestion devienne officielle
  const { data: suggestions } = await supabase
    .from('category_suggestions')
    .select('*')
    .gte('proposal_count', THRESHOLD);

  for (const suggestion of suggestions) {
    // Vérifier si la catégorie existe déjà
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('name', suggestion.name)
      .single();

    let categoryId;
    if (!existingCategory) {
      const { data: newCategory } = await supabase
        .from('categories')
        .insert({ name: suggestion.name })
        .select()
        .single();
      categoryId = newCategory.id;
    } else {
      categoryId = existingCategory.id;
    }

    // Mettre à jour les sujets avec cette suggestion
    await supabase
      .from('subjects')
      .update({ category_id: categoryId, suggested_category: null })
      .eq('suggested_category', suggestion.name);

    // Supprimer la suggestion validée
    await supabase
      .from('category_suggestions')
      .delete()
      .eq('id', suggestion.id);
  }
  console.log('Suggestion envoyée ! Elle sera validée après 5 propositions.');
  loadCategories(); // Rafraîchir le menu déroulant
}

// Recherche en temps réel
document.getElementById('searchForum').addEventListener('input', (e) => {
  document.getElementById('clearSearch').classList.toggle('hidden', !e.target.value);
  const searchValue = e.target.value.trim().toLowerCase();
  const privateOnly = document.getElementById('privateOnly').checked;
  const resultsDiv = document.getElementById('searchResults');

  if (!searchValue) {
    resultsDiv.classList.add('hidden');
    resultsDiv.classList.remove('scale-y-100', 'opacity-100');
    resultsDiv.classList.add('scale-y-95', 'opacity-0');
    return;
  }

  const matchingForums = allSubjects.filter(s => 
    (privateOnly ? s.isPrivate : true) && (
      s.titre.toLowerCase().includes(searchValue) ||
      s.message.toLowerCase().includes(searchValue) ||
      s.categories.name.toLowerCase().includes(searchValue)
    )
  ).sort((a, b) => {
    // Tri par pertinence : titre > message > catégorie
    const aTitleMatch = a.titre.toLowerCase().includes(searchValue);
    const bTitleMatch = b.titre.toLowerCase().includes(searchValue);
    if (aTitleMatch && !bTitleMatch) return -1;
    if (!aTitleMatch && bTitleMatch) return 1;
    return b.date - a.date; // Sinon, plus récent en premier
  });

  if (matchingForums.length === 0) {
    resultsDiv.innerHTML = '<p class="text-gray-600 text-sm">Aucun forum trouvé.</p>';
  } else {
    resultsDiv.innerHTML = `
      <h3 class="font-semibold mb-2 text-sm sm:text-base">Résultats (${matchingForums.length}) :</h3>
      <ul class="space-y-2">
        ${matchingForums.slice(0, 10).map(f => `
          <li class="border-b border-gray-100 pb-2">
            <a href="discussion.html?id=${f.id}" class="text-blue-500 hover:underline flex items-center">
              ${f.titre}
              ${f.isPrivate ? '<i data-feather="lock" class="ml-2 h-4 w-4 text-gray-500"></i>' : ''}
            </a>
            <p class="text-sm text-gray-600">${f.categories.name}</p>
            <p class="text-xs text-gray-500">Par ${f.pseudo} - ${new Date(f.date).toLocaleDateString('fr-FR')}</p>
          </li>
        `).join('')}
        ${matchingForums.length > 10 ? '<p class="text-sm text-gray-500 mt-2">+ ' + (matchingForums.length - 10) + ' autres résultats...</p>' : ''}
      </ul>
    `;
  }
  resultsDiv.classList.remove('hidden', 'scale-y-95', 'opacity-0');
  resultsDiv.classList.add('scale-y-100', 'opacity-100');
  feather.replace(); // Rafraîchir les icônes Feather
});

document.getElementById('clearSearch').addEventListener('click', () => {
  document.getElementById('searchForum').value = '';
  document.getElementById('searchResults').classList.add('hidden');
});

// Bouton de recherche (optionnel, car temps réel)
document.getElementById('searchForumBtn').addEventListener('click', () => {
  const searchInput = document.getElementById('searchForum');
  searchInput.dispatchEvent(new Event('input')); // Simule une saisie pour déclencher la recherche
});

//écouteur pour afficher/masquer le champ personnalisé
document.getElementById('category').addEventListener('change', (e) => {
  const customWrapper = document.getElementById('customCategoryWrapper');
  customWrapper.classList.toggle('hidden', e.target.value !== 'other');
  if (e.target.value !== 'other') document.getElementById('customCategory').value = '';
});

// Gestion des boutons de partage et copie
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('share-btn')) {
    const forumId = e.target.getAttribute('data-id');
    const shareUrl = `${window.location.origin}/discussion.html?id=${forumId}`;
    if (navigator.share) {
      navigator.share({
        title: 'Partage de forum Parole d\'Ivoire',
        url: shareUrl
      }).then(() => console.log('Partagé avec succès'))
        .catch(err => console.error('Erreur de partage :', err));
    } else {
      alert('Partage non pris en charge. Copiez le lien manuellement : ' + shareUrl);
    }
  } else if (e.target.classList.contains('copy-btn')) {
    const forumId = e.target.getAttribute('data-id');
    const copyUrl = `${window.location.origin}/discussion.html?id=${forumId}`;
    navigator.clipboard.writeText(copyUrl).then(() => {
      alert('Lien copié dans le presse-papiers !');
      console.log('Lien copié :', copyUrl);
    }).catch(err => {
      alert('Erreur lors de la copie du lien.');
      console.log('Erreur copie :', err);
    });
  }
});




// Appeler au démarrage
loadSubjects();
loadCategories();