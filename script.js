// script.js
// JavaScript para controlar navegação, exibição de fichas, finais e a Detetive IA.
// Compatível com o index.html fornecido — não altera HTML nem CSS.
// Copie e cole este arquivo como "script.js".

/*
  Funcionalidades implementadas:
  - Controle de navegação entre seções (links internos '#...').
  - Apenas uma seção exibida por vez (inclui fichas de personagens).
  - Exibição/ocultação das telas: introdução, investigação, finais.
  - Permite escolha de suspeitos a partir da seção "escolha".
     * Bruno -> Final Bom
     * Qualquer outro acusado -> Final Ruim
     * "Esperar antes de decidir" -> Final Secreto
  - Pequenas animações de transição (fade + translate).
  - Mensagens da Detetive IA exibidas dinamicamente durante a investigação.
  - Tratamento do hash inicial da URL (se houver).
  - Código modular, comentado e pronto para uso.
*/

(function () {
  'use strict';

  // Configurações de animação
  const ANIM_DURATION = 320; // ms
  const IA_MESSAGE_INTERVAL = 1200; // ms entre mensagens exibidas
  const IA_MESSAGE_FADE = 350; // ms duração do fade das mensagens

  // Captura todas as seções dentro do main
  const sectionsNodeList = document.querySelectorAll('main section');
  const sections = Array.from(sectionsNodeList).reduce((acc, section) => {
    acc[section.id] = section;
    return acc;
  }, {});

  // Seção atualmente visível
  let currentSectionId = null;

  // Contêiner da fila de mensagens da IA (criado quando necessário)
  let iaMessagesContainer = null;
  let iaSequenceTimer = null;

  // Mensagens que a Detetive IA mostrará durante a investigação
  const IA_MESSAGES = [
    'Processando informações...',
    'Comparando depoimentos...',
    'Analisando comportamentos suspeitos...',
    'A maioria dos suspeitos possui explicações plausíveis...',
    'Identificando combinação de evidências...',
    'Continue investigando antes de tomar uma decisão.'
  ];

  // Inicia a inicialização quando DOM estiver pronto
  document.addEventListener('DOMContentLoaded', init);

  // Inicializa: esconde seções e mostra a seção inicial/por hash; liga manipuladores
  function init() {
    // Prepare estilos inline básicos para cada seção para controle via JS
    Object.values(sections).forEach((sec) => {
      // Assegura que temos controle de opacidade/transform/transition
      sec.style.transition = `opacity ${ANIM_DURATION}ms ease, transform ${ANIM_DURATION}ms ease`;
      sec.style.willChange = 'opacity, transform';
      // Não confiar no display anterior: escondemos tudo aqui; exibiremos a inicial logo em seguida
      sec.style.opacity = '0';
      sec.style.transform = 'translateY(8px)';
      sec.style.display = 'none';
    });

    // Intercepta clicks em links internos (hashes) para controlar navegação SPA-like
    document.addEventListener('click', handleDocumentClick, { passive: false });

    // Se houver um hash na URL ao carregar, mostramos essa seção
    const initialHash = location.hash && location.hash.trim();
    if (initialHash && initialHash.length > 1 && sections[initialHash.substring(1)]) {
      // Mostrar a seção correspondente ao hash (sem usar o salto padrão)
      showSection(initialHash.substring(1), { replaceHash: true, instant: true });
    } else {
      // Senão, mostramos a introdução por padrão
      showSection('introducao', { replaceHash: true, instant: true });
    }

    // Prepara container das mensagens da IA (será inserido em investigacao quando necessário)
    createIaContainer();
  }

  // Cria o contêiner de mensagens da Detetive IA (apenas uma vez)
  function createIaContainer() {
    const investigacao = sections['investigacao'];
    if (!investigacao) return;

    iaMessagesContainer = document.createElement('div');
    iaMessagesContainer.id = 'ia-messages';
    // Estilo inline mínimo para que as mensagens fiquem legíveis mesmo sem CSS adicional
    iaMessagesContainer.style.marginTop = '12px';
    iaMessagesContainer.style.display = 'flex';
    iaMessagesContainer.style.flexDirection = 'column';
    iaMessagesContainer.style.gap = '8px';
    investigacao.appendChild(iaMessagesContainer);
  }

  // Manipula clicks no documento para interceptar âncoras internas
  function handleDocumentClick(ev) {
    // Procuramos o elemento <a> mais próximo do alvo do clique
    const anchor = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('#')) return;

    // Prevemos o comportamento padrão (evita jump de página)
    ev.preventDefault();

    const targetHash = href.slice(1); // remove '#'
    if (!targetHash) {
      // caso href="#" apenas ignore
      return;
    }

    // Quando o clique vier da seção de escolhas (escolha), aplicamos a lógica do jogo
    if (isInsideSection(anchor, 'escolha')) {
      handleEscolhaClick(targetHash);
      return;
    }

    // Caso normal: mostrar a seção referenciada pelo hash (se existir)
    if (sections[targetHash]) {
      showSection(targetHash, { pushHash: true });
      return;
    }

    // Se a seção não existir (por segurança), não fazemos nada
  }

  // Verifica se um elemento está dentro de uma seção com o id fornecido
  function isInsideSection(element, sectionId) {
    const section = sections[sectionId];
    if (!section) return false;
    return section.contains(element);
  }

  // Lida com os cliques na tela de escolha (decisão do jogador)
  function handleEscolhaClick(targetHash) {
    // Regras pedidas:
    // - Bruno -> Final Bom
    // - Qualquer outro -> Final Ruim
    // - Esperar -> Final Secreto
    // Observação: no HTML original, os links já apontam para finalbom / finalruim / finalsecreto,
    // mas tratamos explicitamente para garantir o comportamento exigido.

    const desiredId = (() => {
      // Se o link já aponta para finalsecreto, respeitamos
      if (targetHash === 'finalsecreto') return 'finalsecreto';
      // Se for explicitamente finalbom (Bruno), mostrarmos finalbom
      if (targetHash === 'finalbom') return 'finalbom';
      // Para qualquer outro, mostramos finalruim
      return 'finalruim';
    })();

    showSection(desiredId, { pushHash: true });
  }

  // Mostra uma seção por id com animação. Opções:
  // - replaceHash: true -> replace URL hash sem criar novo histórico
  // - pushHash: true -> atualiza location.hash (cria histórico)
  // - instant: true -> sem animação (usado no carregamento inicial)
  async function showSection(id, options = {}) {
    if (!sections[id]) return;
    const opts = Object.assign({ replaceHash: false, pushHash: false, instant: false }, options);

    // Se já estamos naquela seção, nada a fazer (mas reiniciamos IA se for investigacao)
    if (currentSectionId === id) {
      if (id === 'investigacao') {
        startIaSequence();
      }
      return;
    }

    const newSection = sections[id];
    const oldSection = currentSectionId ? sections[currentSectionId] : null;

    // Cancelar sequência da IA se estivermos saindo da investigacao
    if (currentSectionId === 'investigacao' && id !== 'investigacao') {
      stopIaSequence();
    }

    // Animação de saída da seção atual
    if (oldSection) {
      if (opts.instant) {
        oldSection.style.display = 'none';
        oldSection.style.opacity = '0';
        oldSection.style.transform = 'translateY(8px)';
      } else {
        // fade out + translate
        oldSection.style.opacity = '0';
        oldSection.style.transform = 'translateY(8px)';
        // Após transição concluída, escondemos ela
        // Usamos setTimeout porque transitionend pode disparar múltiplas vezes (para ambos os properties)
        await wait(ANIM_DURATION + 20);
        oldSection.style.display = 'none';
      }
    }

    // Antes de mostrar a nova seção, garantimos que apenas uma ficha de personagem apareça:
    // Se a nova seção for uma ficha de personagem (joao, pai, mae, pedro, lucas, diego, rafael, bruno),
    // escondemos todas as outras fichas (já feito pelo comportamento geral de exibir apenas uma seção).
    // Simplesmente exibimos a nova seção:
    newSection.style.display = ''; // deixa o valor padrão (normalmente block)
    // Prepare para animar entrada
    if (opts.instant) {
      newSection.style.opacity = '1';
      newSection.style.transform = 'none';
    } else {
      newSection.style.opacity = '0';
      newSection.style.transform = 'translateY(-8px)';
      // forçar reflow para garantir que a transição ocorra
      // eslint-disable-next-line no-unused-expressions
      newSection.offsetWidth;
      // anima para visível
      newSection.style.opacity = '1';
      newSection.style.transform = 'none';
    }

    currentSectionId = id;

    // Atualiza o hash da URL sem provocar jump inesperado:
    if (opts.replaceHash) {
      history.replaceState(null, '', `#${id}`);
    } else if (opts.pushHash) {
      // pushState mantém comportamento de histórico, mas sem "jump" (já que não navegamos para âncora)
      history.pushState(null, '', `#${id}`);
    } else {
      // Não alterar o hash se não solicitado.
    }

    // Se a nova seção for investigacao, inicia a sequência de mensagens da IA
    if (id === 'investigacao') {
      startIaSequence();
    }

    // Se a nova seção for uma final (finalbom/finalruim/finalsecreto),
    // podemos, opcionalmente, mostrar uma micro-animação do "resultado" criando um pequeno delay.
    if (id === 'finalbom' || id === 'finalruim' || id === 'finalsecreto') {
      // simples destaque: flash de opacidade rápida (não muito intrusiva)
      highlightFinal(newSection);
    }
  }

  // Pequeno destaque para finais: uma "pulso" suave
  function highlightFinal(section) {
    // adiciona um pulso leve aplicando scale via transform e voltando
    section.style.transition = `transform ${ANIM_DURATION}ms ease, opacity ${ANIM_DURATION}ms ease`;
    section.style.transform = 'scale(1.01)';
    setTimeout(() => {
      section.style.transform = 'none';
    }, ANIM_DURATION + 5);
  }

  // Exibe a sequência de mensagens da Detetive IA dentro de investigacao
  function startIaSequence() {
    if (!iaMessagesContainer) createIaContainer();
    if (!iaMessagesContainer) return;

    // Limpa mensagens antigas
    iaMessagesContainer.innerHTML = '';

    // Protege contra múltiplas execuções simultâneas
    stopIaSequence();

    let index = 0;

    // Função que exibe uma mensagem com fade-in, mantém e fade-out
    function showNext() {
      if (index >= IA_MESSAGES.length) {
        // Ao final da lista, mantemos a última mensagem por mais um tempo e paramos.
        return;
      }

      const msgText = IA_MESSAGES[index];
      index += 1;

      const bubble = document.createElement('div');
      bubble.className = 'ia-message';
      bubble.textContent = `Detetive IA: ${msgText}`;

      // Estilo inline para garantir animação mesmo sem regras CSS externas
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateY(6px)';
      bubble.style.transition = `opacity ${IA_MESSAGE_FADE}ms ease, transform ${IA_MESSAGE_FADE}ms ease`;
      bubble.style.background = 'rgba(240,240,245,0.95)';
      bubble.style.padding = '8px 10px';
      bubble.style.borderRadius = '8px';
      bubble.style.maxWidth = 'min(720px, 92%)';
      bubble.style.fontStyle = 'italic';
      bubble.style.boxShadow = '0 6px 18px rgba(0,0,0,0.06)';
      bubble.style.color = '#111';
      bubble.style.alignSelf = 'flex-start';

      iaMessagesContainer.appendChild(bubble);

      // Forçar reflow antes de animar para garantir que transition aconteça
      // eslint-disable-next-line no-unused-expressions
      bubble.offsetWidth;
      // Fade in
      bubble.style.opacity = '1';
      bubble.style.transform = 'none';

      // Depois de IA_MESSAGE_INTERVAL - pequena pausa - mantemos a mensagem
      iaSequenceTimer = setTimeout(() => {
        // segue para a próxima
        showNext();
      }, IA_MESSAGE_INTERVAL);
    }

    // Inicia a sequência
    showNext();
  }

  // Para a sequência de mensagens da IA (se estiver rodando)
  function stopIaSequence() {
    if (iaSequenceTimer) {
      clearTimeout(iaSequenceTimer);
      iaSequenceTimer = null;
    }
    if (iaMessagesContainer) {
      iaMessagesContainer.innerHTML = '';
    }
  }

  // Utilitário: espera ms milissegundos
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Trata mudanças de hash por navegação do histórico (back/forward)
  window.addEventListener('popstate', () => {
    const hash = location.hash && location.hash.substring(1);
    if (hash && sections[hash]) {
      showSection(hash, { instant: false });
    }
  });

  // Expor algumas funções para depuração no console (opcional)
  window.__jogo = {
    showSection,
    sections,
    startIaSequence,
    stopIaSequence
  };
})();
