import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.44.0/+esm';
import { v4 as uuidv4 } from 'https://cdn.jsdelivr.net/npm/uuid@latest/+esm';

console.log('discussion.js démarré');
const supabase = createClient(
  'https://auiimdeorutwndunxrcr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1aWltZGVvcnV0d25kdW54cmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIyNDI4MjgsImV4cCI6MjA1NzgxODgyOH0.A2VfxrLNjDQMTi5mMCdp-ppf-quDsM4OW-pL5p2QbQM'
);

// Définir forum et messages existants comme variables globales
let forum = null;
let existingMessages = []; // Pour éviter les doublons en temps réel

const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('id');
if (!subjectId) {
  console.error('Erreur : subjectId manquant dans l\'URL');
  document.getElementById('forumTitle').textContent = 'Erreur : ID de sujet manquant';
} else {
  const pseudoInput = document.getElementById('pseudo');
  const anonymousCheckbox = document.getElementById('anonymous');
  const messageForm = document.getElementById('messageForm');
  const cancelReplyBtn = document.getElementById('cancelReply');
  const replyingToIndicator = document.getElementById('replyingToIndicator');
  let userPseudo = localStorage.getItem('forumPseudo') || '';
  let replyingToId = null;
  let replyingToPseudo = null;

  if (!pseudoInput || !anonymousCheckbox || !messageForm) {
    console.error('Un ou plusieurs éléments du DOM manquent :', { pseudoInput, anonymousCheckbox, messageForm });
  } else {
    pseudoInput.value = userPseudo;
    pseudoInput.disabled = anonymousCheckbox.checked;

    anonymousCheckbox.addEventListener('change', () => {
      pseudoInput.disabled = anonymousCheckbox.checked;
      if (!anonymousCheckbox.checked) {
        pseudoInput.value = localStorage.getItem('forumPseudo') || '';
        pseudoInput.focus();
      } else {
        pseudoInput.value = '';
      }
    });

    document.getElementById('messages').addEventListener('click', (e) => {
      if (e.target.classList.contains('reply-button')) {
        const messageElement = e.target.closest('[data-message-id]');
        if (messageElement) {
          replyingToId = messageElement.getAttribute('data-message-id');
          replyingToPseudo = messageElement.querySelector('.message-author').textContent;
          replyingToIndicator.textContent = `Réponse à ${replyingToPseudo}`;
          replyingToIndicator.classList.remove('hidden');
          cancelReplyBtn.classList.remove('hidden');
          document.getElementById('message').focus();
          messageForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    cancelReplyBtn.addEventListener('click', () => {
      replyingToId = null;
      replyingToPseudo = null;
      replyingToIndicator.classList.add('hidden');
      cancelReplyBtn.classList.add('hidden');
    });

    async function loadForum() {
      console.log('Chargement du forum pour subjectId:', subjectId);
      const { data: subjects, error: subjectError } = await supabase
        .from('subjects')
        .select('*, categories(name)')
        .eq('id', subjectId);
      if (subjectError || !subjects.length) {
        console.error('Erreur ou forum introuvable :', subjectError);
        document.getElementById('forumTitle').textContent = 'Forum non trouvé';
        return;
      }
      forum = subjects[0];
      console.log('Forum chargé :', forum);
    
      if (!forum.isPrivate || (forum.isPrivate && localStorage.getItem(`forumPassword_${subjectId}`) === forum.password)) {
        const currentCount = forum.participantcount || 0;
        const { error: updateError } = await supabase
          .from('subjects')
          .update({ participantcount: currentCount + 1 })
          .eq('id', subjectId);
        if (updateError) console.error('Erreur mise à jour participantcount :', updateError);
      }

      if (forum.isPrivate) {
        const storedPassword = localStorage.getItem(`forumPassword_${subjectId}`);
        let password = storedPassword;
        if (!storedPassword) {
          password = prompt(`Ce forum est privé. Entrez le mot de passe pour ${forum.titre} :`);
          if (password !== forum.password) {
            alert('Mot de passe incorrect.');
            document.getElementById('forumTitle').textContent = 'Accès refusé';
            document.getElementById('messages').innerHTML = '';
            messageForm.style.display = 'none';
            return;
          }
          localStorage.setItem(`forumPassword_${subjectId}`, password);
        } else if (storedPassword !== forum.password) {
          alert('Mot de passe invalide ou modifié.');
          localStorage.removeItem(`forumPassword_${subjectId}`);
          return loadForum();
        }
      }

      document.getElementById('forumTitle').textContent = `${forum.titre} (${forum.categories.name})`;

      const { data: replies, error: repliesError } = await supabase
        .from('replies')
        .select('*')
        .eq('subjectid', subjectId)
        .order('date');
      if (repliesError) {
        console.error('Erreur chargement réponses :', repliesError);
      } else {
        console.log('Réponses chargées :', replies);
        existingMessages = replies || []; // Stocke les messages initiaux
        renderMessages(existingMessages);
      }
    }

    function renderMessages(messages) {
      const colors = ['bg-blue-100', 'bg-green-100', 'bg-yellow-100', 'bg-purple-100', 'bg-pink-100', 'bg-indigo-100'];
      const messagesDiv = document.getElementById('messages');
      if (!messagesDiv || !forum) {
        console.error('Élément messages ou forum non trouvé');
        return;
      }

      const replyMap = {};
      messages.forEach(msg => {
        if (msg.replyingTo) replyMap[msg.id] = msg.replyingTo;
      });

      messagesDiv.innerHTML = `
        <div class="p-4 bg-white rounded-lg shadow-sm mb-4">
          <h3 class="text-lg font-semibold">${forum.titre}</h3>
          <div class="flex gap-3 mt-1">
            <span class="inline-flex items-center text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
              ${forum.replyCount || 0}
            </span>
            <span class="inline-flex items-center text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M18 8a6 6 0 0 0-6-6H8a6 6 0 0 0 0 12h4"/><path d="M10 14h4a6 6 0 0 1 0 12h-4"/></svg>
              ${forum.category}
            </span>
            <span class="inline-flex items-center text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
              ${forum.participantcount || 0}
            </span>
          </div>
        </div>
        ${messages.map((msg, i) => {
          const colorIndex = Math.abs(hashString(msg.pseudo || 'Anonyme')) % colors.length;
          const color = colors[colorIndex];
          const isReply = msg.replyingTo !== null && msg.replyingTo !== undefined;
          let replyToPseudo = '';
          if (isReply) {
            const replyToMsg = messages.find(m => m.id === msg.replyingTo);
            replyToPseudo = replyToMsg ? replyToMsg.pseudo : 'Message supprimé';
          }
          const alignment = msg.pseudo === 'Anonyme' ? 'ml-auto' : 'mr-auto';
          return `
            <div class="message-bubble ${alignment} p-3 rounded-lg ${color} ${isReply ? 'border-l-4 border-primary-400' : ''}" data-message-id="${msg.id}">
              <p class="message-author font-semibold text-sm flex items-center">
                ${msg.pseudo === 'Anonyme' ?
                  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/><path d="M9.17 14.83a4 4 0 1 1 5.66-5.66"/></svg>` :
                  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>`
                }
                ${msg.pseudo}
              </p>
              ${isReply ? `<p class="text-xs text-gray-500 flex items-center mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                Réponse à ${replyToPseudo}
              </p>` : ''}
              <p class="text-sm mt-1 whitespace-pre-wrap">${msg.texte || 'Message vide'}</p>
              <div class="flex justify-between items-center mt-2">
                <p class="text-xs text-gray-500">${formatDate(msg.date)}</p>
                <button class="reply-button bg-primary-500 text-white px-2 py-1 rounded text-xs hover:bg-primary-600 transition shadow-sm flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                  Répondre
                </button>
              </div>
            </div>
          `;
        }).join('')}
      `;
      setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }, 100);
    }

    // Nouvelle fonction pour ajouter un message en temps réel
    function addMessage(newMessage) {
      if (!existingMessages.some(msg => msg.id === newMessage.id)) { // Évite les doublons
        existingMessages.push(newMessage);
        renderMessages(existingMessages); // Re-rendu avec le nouveau message
      }
    }

    function hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash = hash & hash;
      }
      return hash;
    }

    function formatDate(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      if (diffMins < 1) return 'À l\'instant';
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      if (diffDays < 7) return `Il y a ${diffDays}j`;
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    messageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Formulaire de réponse soumis pour subjectId:', subjectId);
      const form = e.target;
      const pseudo = anonymousCheckbox.checked ? 'Anonyme' : (pseudoInput.value.trim() || 'Anonyme');
      if (!anonymousCheckbox.checked && pseudo !== 'Anonyme') localStorage.setItem('forumPseudo', pseudo);

      const messageInput = form.querySelector('#message');
      if (!messageInput || !messageInput.value.trim()) {
        alert('Le message ne peut pas être vide.');
        console.error('Message vide ou champ manquant');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Envoi...';

      const reply = {
        id: uuidv4(),
        subjectid: subjectId,
        pseudo,
        texte: messageInput.value.trim(),
        date: Date.now(),
        fileUrl: null,
        replyingTo: replyingToId
      };
      console.log('Tentative d\'insertion :', reply);

      try {
        const { data, error: insertError } = await supabase.from('replies').insert(reply).select();
        if (insertError) {
          console.error('Erreur insertion réponse :', insertError);
          alert('Erreur lors de l\'envoi de la réponse. Détails : ' + insertError.message);
          return;
        }
        console.log('Réponse insérée avec succès :', data);

        const currentReplyCount = forum.replyCount || 0;
        const { error: updateError } = await supabase
          .from('subjects')
          .update({ replyCount: currentReplyCount + 1 })
          .eq('id', subjectId);
        if (updateError) {
          console.error('Erreur mise à jour replyCount :', updateError);
        }
        forum.replyCount = currentReplyCount + 1;

        replyingToId = null;
        replyingToPseudo = null;
        replyingToIndicator.classList.add('hidden');
        cancelReplyBtn.classList.add('hidden');
        form.reset();
        pseudoInput.value = pseudo === 'Anonyme' ? '' : pseudo;

        const successMessage = document.createElement('div');
        successMessage.textContent = 'Message envoyé !';
        successMessage.className = 'text-center py-2 text-green-600 bg-green-50 rounded-lg';
        form.appendChild(successMessage);
        setTimeout(() => {
          successMessage.remove();
        }, 3000);

        // Pas de loadForum ici, le temps réel s’en charge
      } catch (err) {
        console.error('Erreur inattendue:', err);
        alert('Une erreur est survenue. Veuillez réessayer.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Envoyer';
      }
    });

    // Configuration du temps réel
    function setupRealtime() {
      const channel = supabase.channel(`replies-channel-${subjectId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'replies',
            filter: `subjectid=eq.${subjectId}`,
          },
          (payload) => {
            console.log('Nouveau message en temps réel:', payload.new);
            addMessage(payload.new); // Ajoute le nouveau message
          }
        )
        .subscribe((status) => {
          console.log('Statut du channel:', status);
        });

      // Nettoyage à la fermeture
      window.addEventListener('beforeunload', () => {
        supabase.removeChannel(channel);
      });
    }

    // Démarrer le chargement initial et le temps réel
    loadForum().catch(err => console.error('Erreur lors du chargement initial :', err));
    setupRealtime(); // Remplace le polling
  }
}