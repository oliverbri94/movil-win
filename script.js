// =================================================================================
// ARCHIVO JAVASCRIPT CONSOLIDADO PARA MOVIL WIN
// Contiene:
// 1. Lógica del Menú de Navegación (Funciona en todas las páginas).
// 2. Lógica del Carrusel, Rueda y Sorteos (Funciona solo en index.html).
// =================================================================================

// --- Evento principal que se ejecuta cuando el contenido HTML de la página ha cargado ---
document.addEventListener('DOMContentLoaded', () => {

// --- PEGA ESTO DENTRO DE document.addEventListener('DOMContentLoaded', ...) ---

const topCountdownBanner = document.getElementById('topCountdownBanner');

if (topCountdownBanner) {
    window.addEventListener('scroll', () => {
        // Si el scroll vertical es mayor a 50px, añade la clase.
        // Si es menor, la quita.
        if (window.scrollY > 50) {
            topCountdownBanner.classList.add('is-scrolled');
        } else {
            topCountdownBanner.classList.remove('is-scrolled');
        }
    });
}
    // --- SECCIÓN 1: LÓGICA DEL MENÚ DE NAVEGACIÓN (GLOBAL) ---
    // Este código se ejecuta en todas las páginas para hacer funcionar el menú.
    try {
        const mobileMenuButton = document.getElementById('mobileMenuButton');
        const fullScreenMenu = document.getElementById('fullScreenMenu');
        const closeMenuButton = document.getElementById('closeMenuButton');

        function toggleFullScreenMenu() {
            // La solución más simple y robusta:
            // Usamos la clase 'hidden' de Tailwind para mostrar u ocultar el menú.
            if (fullScreenMenu) {
                fullScreenMenu.classList.toggle('hidden');
            }
        }

        if (mobileMenuButton && fullScreenMenu && closeMenuButton) {
            mobileMenuButton.addEventListener('click', toggleFullScreenMenu);
            closeMenuButton.addEventListener('click', toggleFullScreenMenu);
        }
    } catch (error) {
        console.error("Error al inicializar el menú de navegación:", error);
    }

    // --- SECCIÓN 2: LÓGICA DE LA PÁGINA PRINCIPAL (INDEX.HTML) ---
    // Verificamos si estamos en la página principal buscando un elemento clave.
    const prizeCarouselContainer = document.getElementById('prizeCarouselContainer');
    if (prizeCarouselContainer) {
        try {
            initializeRafflePage();
        } catch (error) {
            console.error("Error al inicializar la página del sorteo:", error);
        }
    }
});



// --- Función de Inicialización para la Página del Sorteo ---
// Todo el código original de script.js ahora vive dentro de esta función o es llamado por ella.
// --- AÑADE ESTAS DOS FUNCIONES AL PRINCIPIO DE SCRIPT.JS ---

/**
 * Genera las iniciales a partir de un nombre completo.
 * Ejemplo: "Juan Pérez" -> "JP", "Ana" -> "A"
 * @param {string} name El nombre del participante.
 * @returns {string} Las iniciales.
 */
function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length > 1) {
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    } else if (words[0]) {
        return words[0][0].toUpperCase();
    }
    return '?';
}

/**
 * Convierte una cadena de texto en un color HSL único y consistente.
 * Esto asegura que cada participante siempre tenga el mismo color de avatar.
 * @param {string} str La cadena a convertir (nombre o cédula).
 * @returns {string} Un color en formato HSL (ej: 'hsl(120, 70%, 80%)').
 */
function stringToHslColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    // Usamos saturación y luminosidad fijas para una paleta de colores pastel agradable
    return `hsl(${h}, 60%, 75%)`;
}
function initializeRafflePage() {
    // 1. ESTADO Y VARIABLES COMPARTIDAS DEL SORTEO
    // Declaramos aquí arriba todas las variables que se usan en diferentes funciones.
    const clackSound = new Audio('sounds/tick.mp3');
    const winnerSound = new Audio('sounds/win.mp3');
    let sorteosDisponibles = [];
    let premioActualIndex = 0;
    let participantes = [];
    let estaGirando = false;
    let sorteoFinalizado = false; 
    let lastSegmentIndex = -1; 
    let finalWinnerInfo = null;
    let wheelCanvas = null;
    let wheelCtx = null;
    let wheelWidth, wheelHeight;
    let isDragging = false;
    let startY_Drag = 0;
    let startYOffset_Drag = 0;
    let touchStartX = 0;
    
    // 2. ELEMENTOS DEL DOM
    const resultadoDiv = document.getElementById('resultadoGanador');
    const listaGanadoresDiv = document.getElementById('listaGanadoresAnteriores');
    const loaderGanadores = document.getElementById('loaderGanadores');
    const prizeCarouselTrack = document.getElementById('prizeCarouselTrack');
    const countdownDisplayContainer = document.getElementById('countdownDisplayContainer');
    const countdownTimerDiv = document.getElementById('countdownTimer');
    const SEGMENT_HEIGHT_FRONT = 60; // Constantes también pueden ir aquí
    const VISIBLE_SEGMENTS_COUNT = 7;
    let currentYOffset = 0;
    
    // 3. CONFIGURACIÓN INICIAL
    clackSound.volume = 0.5;
    winnerSound.volume = 0.7;

    // --- Funciones de Ayuda (Helpers) ---

    function formatConfidentialId(id_documento) {
        if (typeof id_documento === 'string' && id_documento.length === 10) {
            return `${id_documento.substring(0, 2)}*****${id_documento.substring(id_documento.length - 2)}`;
        }
        return id_documento ? String(id_documento) : 'N/A';
    }

    function renderMedia(sorteo) {
        const url = sorteo.imagen_url || 'images/proximo_sorteo.png';
        const esProximo = !sorteo.id_sorteo || sorteo.esProximo;
        const classes = esProximo ? 'grayscale' : '';
        if (url.endsWith('.mp4') || url.endsWith('.webm')) {
            return `<video src="${url}" class="${classes}" autoplay loop muted playsinline></video>`;
        }
        return `<img src="${url}" alt="${sorteo.nombre_premio_display}" class="${classes}">`;
    }

    function getMotivationalMessage(percentage) {
        if (percentage >= 100) return "¡Meta alcanzada! El sorteo será pronto.";
        if (percentage >= 95) return "¡Estamos a un paso! Tu oportunidad es AHORA.";
        if (percentage >= 75) return "¡Casi llegamos! Muy pocos boletos para la meta.";
        if (percentage >= 50) return "¡Impresionante! Superamos la mitad del camino.";
        if (percentage >= 25) return "¡Excelente progreso! Sigamos así.";
        return "¡El sorteo ha comenzado! Sé de los primeros.";
    }

    function getColorForId(id) {
        if (!id || typeof id !== 'string') return '#4a4a4a';
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            const char = id.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 55%)`;
    }

    // --- Funciones de la Rueda y Canvas ---

    function drawScrollbar() {
        if (estaGirando) return; // <-- AÑADE ESTA LÍNEA. Si la rueda está girando, no hagas nada más.
        if (!wheelCtx || !participantes) return;
        const totalContentHeight = participantes.length * SEGMENT_HEIGHT_FRONT;
        if (totalContentHeight <= wheelHeight) return;

        const scrollbarWidth = 10;
        const scrollbarX = wheelWidth - scrollbarWidth - 5;
        wheelCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        wheelCtx.fillRect(scrollbarX, 0, scrollbarWidth, wheelHeight);

        const thumbHeight = (wheelHeight / totalContentHeight) * wheelHeight;
        const maxOffset = totalContentHeight - wheelHeight;
        const thumbY = (currentYOffset / maxOffset) * (wheelHeight - thumbHeight);
        
        wheelCtx.fillStyle = '#DAA520';
        wheelCtx.strokeStyle = 'rgba(0,0,0,0.5)';
        wheelCtx.lineWidth = 1;
        wheelCtx.fillRect(scrollbarX, thumbY, scrollbarWidth, thumbHeight);
        wheelCtx.strokeRect(scrollbarX, thumbY, scrollbarWidth, thumbHeight);
    }

    function drawFrontWheel(participantesDelSorteo, yOffsetAnim = null) {
        if (!wheelCtx) return;

        const yOffsetToDraw = yOffsetAnim !== null ? yOffsetAnim : currentYOffset;

        if (!participantesDelSorteo || participantesDelSorteo.length === 0) {
            wheelCtx.clearRect(0, 0, wheelWidth, wheelHeight);
            wheelCtx.fillStyle = "#555";
            wheelCtx.textAlign = "center";
            wheelCtx.font = "bold 20px Poppins, sans-serif";
            wheelCtx.fillText("No hay participantes", wheelWidth / 2, wheelHeight / 2);
            return;
        }
        
        wheelCtx.clearRect(0, 0, wheelWidth, wheelHeight);
        
        const startIndex = Math.floor(yOffsetToDraw / SEGMENT_HEIGHT_FRONT);
        const yPixelOffset = -(yOffsetToDraw % SEGMENT_HEIGHT_FRONT);
        
        for (let i = 0; i < VISIBLE_SEGMENTS_COUNT + 2; i++) {
            const pIndex = (startIndex + i) % participantesDelSorteo.length;
            const p = participantesDelSorteo[pIndex];
            if (!p) continue;

            const isWinner = finalWinnerInfo && p.orden_id === finalWinnerInfo.orden_id;
            const segY = yPixelOffset + i * SEGMENT_HEIGHT_FRONT;

            if (isWinner) {
                const goldGradient = wheelCtx.createLinearGradient(0, segY, wheelWidth, segY);
                goldGradient.addColorStop(0, '#B8860B');
                goldGradient.addColorStop(0.5, '#FFD700');
                goldGradient.addColorStop(1, '#B8860B');
                wheelCtx.fillStyle = goldGradient;
                wheelCtx.shadowColor = 'yellow';
                wheelCtx.shadowBlur = 25;
            } else {
                wheelCtx.fillStyle = getColorForId(p.id);
                wheelCtx.shadowBlur = 0;
            }

            wheelCtx.fillRect(0, segY, wheelWidth, SEGMENT_HEIGHT_FRONT);
            wheelCtx.shadowBlur = 0;

            wheelCtx.strokeStyle = '#16161a';
            wheelCtx.lineWidth = isWinner ? 6 : 4;
            wheelCtx.strokeRect(0, segY, wheelWidth, SEGMENT_HEIGHT_FRONT);
            
            if (isWinner) {
                wheelCtx.fillStyle = '#000';
                wheelCtx.font = "800 18px Poppins, sans-serif";
            } else {
                wheelCtx.fillStyle = '#fff';
                wheelCtx.font = "600 16px Poppins, sans-serif";
            }
            
            wheelCtx.textAlign = "center";
            wheelCtx.fillText(p.name, wheelWidth / 2, segY + SEGMENT_HEIGHT_FRONT / 2 - 10);
            wheelCtx.font = "400 12px Poppins, sans-serif";
            wheelCtx.fillText(`CI: ${formatConfidentialId(p.id)}`, wheelWidth / 2, segY + SEGMENT_HEIGHT_FRONT / 2 + 10);
        }

        drawScrollbar();
    }


    // --- Lógica Principal del Sorteo ---

    async function girarRuedaFrontView(isAutomatic = false) {
        if (estaGirando || sorteoFinalizado || !participantes || participantes.length === 0) {
            console.log("Giro prevenido. Razón:", {estaGirando, sorteoFinalizado});
            return;
        }
        removeWheelEventListeners(wheelCanvas);
        estaGirando = true;

        try {
            const sorteoActual = sorteosDisponibles[premioActualIndex];
            const response = await fetch('${API_BASE_URL}/api/admin/realizar-sorteo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sorteo_id: sorteoActual.id_sorteo, premio_actual: sorteoActual.nombre_premio_display })
            });

            const resultadoSorteo = await response.json();
            if (!response.ok) throw new Error(resultadoSorteo.error || `Error ${response.status}`);
            
            const ganadorDelBackend = resultadoSorteo.ganador;
            const winnerParticipantIndex = participantes.findIndex(p => p.orden_id === ganadorDelBackend.orden_id);
            if (winnerParticipantIndex === -1) throw new Error("Ganador no sincronizado con la lista local.");

            const totalContentHeight = participantes.length * SEGMENT_HEIGHT_FRONT;
            const pointerCenterY = wheelHeight / 2;
            const targetYOffsetFinal = (winnerParticipantIndex * SEGMENT_HEIGHT_FRONT) + (SEGMENT_HEIGHT_FRONT / 2) - pointerCenterY;
            
            const vueltasCompletas = 10 + Math.floor(Math.random() * 4);
            const distanciaDeVueltas = vueltasCompletas * totalContentHeight;
            const distanciaHastaGanador = (targetYOffsetFinal - (currentYOffset % totalContentHeight) + totalContentHeight) % totalContentHeight;
            
            const totalDistanceToTravel = distanciaDeVueltas + distanciaHastaGanador;
            const animationStartTime = Date.now();
            const animationDuration = 20000 + Math.random() * 5000;
            const startYOffsetAnim = currentYOffset;

            const animateSpin = () => {
                const now = Date.now();
                const elapsedTime = now - animationStartTime;
                let progress = Math.min(elapsedTime / animationDuration, 1);
                const easedProgress = 1 - Math.pow(1 - progress, 4);

                const animatedYOffset = startYOffsetAnim + totalDistanceToTravel * easedProgress;

                // --- LÓGICA DEL MOTION BLUR ---
                // Mientras la animación no haya llegado al 75%, aplicamos el desenfoque.
                if (progress < 0.75) {
                    wheelCanvas.classList.add('is-spinning-fast');
                } else {
                    wheelCanvas.classList.remove('is-spinning-fast');
                }
                // --- FIN DE LA LÓGICA ---
                // --- LÓGICA DE ANIMACIÓN DE LA CLAVIJA ---
                const currentSegmentIndex = Math.floor(animatedYOffset / SEGMENT_HEIGHT_FRONT);
                if (currentSegmentIndex !== lastSegmentIndex) {
                    const clacker = wheelCanvas.closest('.sorteo-frame').querySelector('.clacker-container');
                    if(clacker) {
                        clacker.classList.remove('hit'); // Quita la clase para poder re-aplicarla
                        void clacker.offsetWidth; // Truco para forzar al navegador a "refrescar" la animación
                        clacker.classList.add('hit'); // Vuelve a aplicar la clase para la animación
                    }
                    lastSegmentIndex = currentSegmentIndex;
                }
                // --- FIN DE LA LÓGICA ---

                drawFrontWheel(participantes, animatedYOffset);

                if (progress < 1) {
                    requestAnimationFrame(animateSpin);
                } else {
                    finalizarGiroFrontView(participantes[winnerParticipantIndex]);
                }
            };
            animateSpin();

        } catch (error) {
            console.error("Error al realizar sorteo:", error);
            estaGirando = false;
        }
    }

    function finalizarGiroFrontView(ganador) {
        sorteoFinalizado = true; // <<<--- AÑADE ESTA LÍNEA AQUÍ ARRIBA
        console.log("-> Giro finalizado. Ganador:", ganador);
        estaGirando = false;
        drawFrontWheel(participantes); // Vuelve a dibujar la rueda sin blur y con la barra de scroll
        
        const sorteoDelGanador = sorteosDisponibles[premioActualIndex];
        finalWinnerInfo = { ...ganador, sorteo_id: sorteoDelGanador.id_sorteo };

        const winnerIndex = participantes.findIndex(p => p.orden_id === ganador.orden_id);
        if (winnerIndex !== -1) {
            const centerOfView = wheelHeight / 2;
            const centerOfWinnerSegment = (winnerIndex * SEGMENT_HEIGHT_FRONT) + (SEGMENT_HEIGHT_FRONT / 2);
            currentYOffset = centerOfWinnerSegment - centerOfView;
            drawFrontWheel(participantes);
        }

        const activeSlide = prizeCarouselTrack.children[premioActualIndex];
        if (!activeSlide) {
            console.error("No se pudo encontrar el slide activo para mostrar el ganador.");
            return;
        }
        const winnerCardContainer = activeSlide.querySelector('.winner-card-container');
        
        if (winnerCardContainer) {
            console.log("✅ Contenedor del ganador encontrado. Mostrando panel...");
            // Llenamos la tarjeta con los datos del ganador
            winnerCardContainer.querySelector('.winner-prize').textContent = `Se ha ganado un ${sorteoDelGanador.nombre_premio_display}`;
            winnerCardContainer.querySelector('.winner-name').textContent = ganador.name;
            winnerCardContainer.querySelector('.winner-id').textContent = `CI: ${formatConfidentialId(ganador.id)}`;

            setTimeout(() => {
                winnerCardContainer.classList.remove('oculto');
            }, 500);


            setTimeout(() => {
                if (typeof confetti !== 'function') return; // Si la librería no cargó, no hacemos nada

                console.log("🎉 Lanzando celebración de confeti...");

                const duration = 5 * 1000; // 5 segundos de duración
                const animationEnd = Date.now() + duration;
                
                // --- Cañonazos iniciales desde los lados ---
                confetti({ particleCount: 80, spread: 60, origin: { x: 0 } });
                confetti({ particleCount: 80, spread: 60, origin: { x: 1 } });

                // --- Lluvia de confeti continua ---
                const interval = setInterval(function() {
                    const timeLeft = animationEnd - Date.now();

                    // Si se acaba el tiempo, detenemos el intervalo
                    if (timeLeft <= 0) {
                        return clearInterval(interval);
                    }

                    const particleCount = 50 * (timeLeft / duration);
                    
                    // Lanzamos dos chorros desde posiciones aleatorias en la parte superior
                    confetti({ particleCount, startVelocity: 30, spread: 360, origin: { x: Math.random(), y: Math.random() - 0.2 } });
                    confetti({ particleCount, startVelocity: 30, spread: 360, origin: { x: Math.random(), y: Math.random() - 0.2 } });

                }, 250); // Cada 250ms lanzamos más confeti

            }, 1000); // La celebración comienza 1 segundo después de que la rueda se detiene);

            setTimeout(() => {
                // Silenciamos el sonido para evitar el error NotAllowedError
                // winnerSound.play();
                console.log("Sonido de victoria omitido para mantener giro automático.");
            }, 1200);
        } else {
            console.error("❌ No se encontró el .winner-card-container dentro del slide activo.");
        }

        mostrarGanadoresAnteriores();
    }

    // --- Funciones de Carga de Datos y Construcción de UI ---
    
    async function generarSlidesDelCarrusel() {
        if (!prizeCarouselTrack) return;
        prizeCarouselTrack.innerHTML = '';

        for (const sorteo of sorteosDisponibles) {
            const slideWrapper = document.createElement('div');
            slideWrapper.className = 'slide-wrapper';
            slideWrapper.style.cssText = 'width: 100%; flex-shrink: 0;';
            
            const esProximo = !sorteo.id_sorteo || sorteo.esProximo;
            let percentage = 0;
            let motivationalMessage = "¡El sorteo ha comenzado!";
            
            if (!esProximo) {
                const currentCount = sorteo.participantes_actuales || 0;
                const goal = sorteo.meta_participaciones || 200;
                percentage = goal > 0 ? Math.min((currentCount / goal) * 100, 100) : 0;
                motivationalMessage = getMotivationalMessage(percentage);
            }

            slideWrapper.innerHTML = `
                <div class="prize-carousel-slide" data-sorteo-id="${sorteo.id_sorteo || 'proximo'}">
                    <div class="prize-image-container">
                        ${renderMedia(sorteo)}
                    </div>
                    <div class="prize-info-container">

                        <h2 class="prize-title">${sorteo.nombre_premio_display}</h2>

                        <div class="mini-package-selector" style="${esProximo ? 'display: none;' : ''}">
                            <a href="https://wa.me/593963135510?text=Hola%2C%20quiero%20comprar%201%20boleto%20individual%20por%20%242." target="_blank" class="mini-package-btn">
                                <strong>1 Boleto</strong>
                                <span>por $2</span>
                            </a>
                            <a href="https://wa.me/593963135510?text=Hola%2C%20estoy%20interesado%20en%20el%20Pack%20Ahorro%20de%2015%20boletos%20por%20%2428." target="_blank" class="mini-package-btn popular">
                                <strong>30 Boletos</strong>
                                <span>por $55</span>
                                <span class="popular-tag">¡Popular!</span>
                            </a>
                            <a href="#paquetes-section" class="mini-package-btn all-packages">
                                <strong>Ver Todos</strong>
                                <span><i class="fas fa-arrow-down"></i></span>
                            </a>
                        </div>

                        <div class="progress-info-wrapper" style="${esProximo ? 'display: none;' : ''}">
                            <div class="progress-bar-wrapper">
                                <div class="progress-bar-fill" style="width: ${percentage.toFixed(2)}%;"></div>
                                <span class="progress-bar-text">${percentage.toFixed(0)}%</span>
                            </div>
                            <p class="motivational-text-integrated">${motivationalMessage}</p>
                        </div>

                        <div class="top-participants-wrapper" style="${esProximo ? 'display: none;' : ''}">
                            <div class="top-list-header">
                                <i class="fas fa-crown"></i>
                                <span>Top 5 Participantes</span>
                            </div>
                            <div class="loader-container oculto"></div>
                            <ol class="top-participants-list"></ol>
                        </div>
                    </div>
                </div>

                ${!esProximo ? `
                <div class="contenedor-sorteo content-section">
                    </div>` : ''}
            `;
            
            prizeCarouselTrack.appendChild(slideWrapper);
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('admin')) {
            document.querySelectorAll('.contenedor-sorteo').forEach(cont => {
                if (cont.querySelector('.boton-girar')) return;
                const btn = document.createElement('button');
                btn.className = 'boton-cta boton-girar';
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Girar Rueda (Admin)';
                btn.addEventListener('click', () => girarRuedaFrontView(true));
                cont.appendChild(btn);
            });
        }
    }

// --- REEMPLAZA TU FUNCIÓN ACTUALIZARTOPPARTICIPANTES CON ESTA ---

    async function actualizarTopParticipantes(sorteoId, slideElement) {
        const listElement = slideElement.querySelector('.top-participants-list');
        const loader = slideElement.querySelector('.top-participants-wrapper .loader-container');
        const wrapper = slideElement.querySelector('.top-participants-wrapper');

        if (!listElement || !loader || !wrapper) return;

        const sorteoSeleccionado = sorteosDisponibles.find(s => s.id_sorteo == sorteoId);
        if (!sorteoId || !sorteoSeleccionado || sorteoSeleccionado.esProximo) {
            wrapper.style.display = 'none';
            return;
        }

        wrapper.style.display = 'block';
        loader.classList.remove('oculto');
        listElement.innerHTML = '';

        try {
            const response = await fetch(`/api/top-participantes?sorteoId=${sorteoId}`);
            if (!response.ok) throw new Error('No se pudo cargar la lista.');

            const top = await response.json();

            if (top.length === 0) {
                listElement.innerHTML = '<li class="top-list-item-empty">Aún no hay participantes destacados.</li>';
            } else {
                // Obtenemos la cantidad de boletos del primer puesto para la barra de progreso
                const maxTickets = top[0].total_participaciones;

                top.forEach((p, i) => {
                    const li = document.createElement('li');
                    li.className = `top-list-item rank-${i + 1}`;

                    // --- NUEVA LÓGICA ---
                    const rank = i + 1;
                    let rankIcon = `<span class="rank-number">${rank}</span>`;
                    if (rank === 1) rankIcon = '🥇';
                    if (rank === 2) rankIcon = '🥈';
                    if (rank === 3) rankIcon = '🥉';

                    const initials = getInitials(p.name);
                    const avatarColor = stringToHslColor(p.id);
                    const barPercentage = maxTickets > 0 ? (p.total_participaciones / maxTickets) * 100 : 0;
                    // --- FIN NUEVA LÓGICA ---

                    // --- NUEVA PLANTILLA HTML ---
                    li.innerHTML = `
                        <div class="rank-icon">${rankIcon}</div>
                        <div class="participant-avatar" style="background-color: ${avatarColor};">
                            ${initials}
                        </div>
                        <div class="participant-details">
                            <span class="participant-name">${p.name || 'N/A'}</span>
                            <div class="micro-progress-bar-container">
                                <div class="micro-progress-bar-fill" style="width: ${barPercentage}%;"></div>
                            </div>
                        </div>
                        <div class="ticket-count">${p.total_participaciones}</div>
                    `;
                    listElement.appendChild(li);
                });
            }
        } catch (error) {
            console.error("Error al actualizar top participantes:", error);
            listElement.innerHTML = '<li class="top-list-item-empty">No se pudo cargar la lista.</li>';
        } finally {
            loader.classList.add('oculto');
        }
    }
    function generarPanelesDeNavegacion() {
        const navContainer = document.getElementById('prizeNavContainer');
        if (!navContainer) return;
        navContainer.innerHTML = '';
        sorteosDisponibles.forEach((sorteo, index) => {
            const panel = document.createElement('div');
            panel.className = 'prize-nav-panel';
            panel.textContent = sorteo.nombre_premio_display;
            panel.dataset.slideTo = index;
            navContainer.appendChild(panel);
        });
    }

// --- REEMPLAZA TU FUNCIÓN moveToSlide CON ESTA ---

    async function moveToSlide(index) {
        sorteoFinalizado = false; 
        if (!prizeCarouselTrack || index < 0 || index >= sorteosDisponibles.length) return;
        
        premioActualIndex = index;
        prizeCarouselTrack.style.transform = `translateX(${-index * 100}%)`;

        const sorteoActual = sorteosDisponibles[premioActualIndex];
        const activeSlide = prizeCarouselTrack.children[index];
        if (!activeSlide) return;
        
        document.querySelectorAll('.prize-nav-panel').forEach((p, i) => p.classList.toggle('active', i === index));

        // --- LÍNEA CLAVE AÑADIDA ---
        // Llama a la función para actualizar la lista de Top Participantes del slide actual.
        actualizarTopParticipantes(sorteoActual.id_sorteo, activeSlide);
        // ----------------------------

        const currentWheelCanvas = activeSlide.querySelector('.price-wheel-canvas');
        if (sorteoActual && sorteoActual.id_sorteo && currentWheelCanvas) {
            wheelCanvas = currentWheelCanvas;
            wheelCtx = wheelCanvas.getContext('2d');
            const container = activeSlide.querySelector('.wheel-price-is-right-container');
            if (container) {
                wheelWidth = container.clientWidth;
                wheelHeight = SEGMENT_HEIGHT_FRONT * VISIBLE_SEGMENTS_COUNT;
                wheelCanvas.width = wheelWidth;
                wheelCanvas.height = wheelHeight;
            }
            try {
                const response = await fetch(`/api/participantes?sorteoId=${sorteoActual.id_sorteo}`);
                participantes = await response.json() || [];
                currentYOffset = 0;
                addWheelEventListeners(wheelCanvas);
                drawFrontWheel(participantes);
            } catch (err) {
                participantes = [];
                drawFrontWheel(participantes);
            }
        } else {
            participantes = [];
            wheelCanvas = null;
        }

        checkMainPageCountdownStatus();
    }
        
    async function cargarSorteosVisibles() {
        try {
            const response = await fetch('${API_BASE_URL}/api/sorteos-visibles');
            if (!response.ok) throw new Error('No se pudo obtener la lista de sorteos.');
            const data = await response.json();
            
            if (data.success && data.sorteos && data.sorteos.length > 0) {
                sorteosDisponibles = data.sorteos;
                if (sorteosDisponibles.length === 1) {
                    sorteosDisponibles.push({
                        id_sorteo: null,
                        nombre_premio_display: "Próximo Gran Premio",
                        imagen_url: 'images/proximo_sorteo.png',
                        esProximo: true
                    });
                }
                await generarSlidesDelCarrusel();
                generarPanelesDeNavegacion();
                
                const initialIndex = sorteosDisponibles.findIndex(s => s.status_sorteo === 'activo');
                moveToSlide(initialIndex !== -1 ? initialIndex : 0);
            } else {
                throw new Error("No hay sorteos disponibles. ¡Vuelve pronto!");
            }
        } catch (error) {
            if (prizeCarouselTrack) prizeCarouselTrack.innerHTML = `<div style="text-align:center; padding: 50px 20px;"><h2 class="prize-title">${error.message}</h2></div>`;
        }
    }
    
    async function mostrarGanadoresAnteriores() {
        if (!listaGanadoresDiv) return;
        loaderGanadores.classList.remove('oculto');
        try {
            const response = await fetch('${API_BASE_URL}/api/ultimos-ganadores');
            const ganadores = await response.json();
            listaGanadoresDiv.innerHTML = '';
            if (ganadores.length === 0) {
                listaGanadoresDiv.innerHTML = '<p>Aún no hay ganadores recientes.</p>';
            } else {
                ganadores.forEach(g => {
                    const card = document.createElement('div');
                    card.className = 'ganador-card';
                    let mediaHTML = g.imagenUrl ? `<img src="${g.imagenUrl}" alt="Foto de ${g.nombre}" class="ganador-foto">` : `<div class="placeholder-pending"><i class="fas fa-shipping-fast"></i><span>Entrega de premio en proceso</span></div>`;
                    card.innerHTML = `${mediaHTML}<div class="ganador-info"><h3 class="ganador-nombre">${g.nombre}</h3><p class="ganador-premio">Premio: ${g.premio}</p></div>`;
                    listaGanadoresDiv.appendChild(card);
                });
            }
        } catch (e) {
            listaGanadoresDiv.innerHTML = '<p>Error al cargar ganadores.</p>';
        } finally {
            loaderGanadores.classList.add('oculto');
        }
    }


    // --- Funciones de Cuenta Regresiva ---
// REEMPLAZA ESTA FUNCIÓN COMPLETA
// --- REEMPLAZA AMBAS FUNCIONES EN SCRIPT.JS CON ESTE BLOQUE COMPLETO ---

// Primero, declaramos la variable del intervalo fuera de las funciones, 
// para que ambas puedan "verla" y controlarla.
let countdownInterval = null;

function checkMainPageCountdownStatus() {
    console.log("▶️ Verificando estado del contador al cargar la página...");
    const tEndStorage = localStorage.getItem('sorteoTiempoFinalizacion');
    const countdownContainer = document.getElementById('topCountdownBanner');
    if (!countdownContainer) return;

    if (tEndStorage) {
        const tEnd = parseInt(tEndStorage);
        // Solo si el tiempo es válido y en el futuro, iniciamos el proceso.
        if (tEnd > new Date().getTime()) {
            console.log("   ✅ Tiempo válido encontrado. Iniciando cuenta regresiva.");
            countdownContainer.classList.remove('oculto');
            
            // Limpiamos cualquier intervalo anterior por seguridad
            if (window.countdownInterval) clearInterval(window.countdownInterval);
            
            // Hacemos una llamada inicial para que el contador no espere 1s
            actualizarDisplayCountdownPrincipal(tEnd);
            
            // Iniciamos el intervalo que actualizará el contador cada segundo
            window.countdownInterval = setInterval(() => {
                actualizarDisplayCountdownPrincipal(tEnd);
            }, 1000);
        }
    } else {
        // Si no hay nada en localStorage, nos aseguramos que el banner esté oculto.
        countdownContainer.classList.add('oculto');
    }
}
// --- REEMPLAZA TU FUNCIÓN ACTUAL CON ESTA VERSIÓN MEJORADA ---

// --- REEMPLAZA TU FUNCIÓN CON ESTA VERSIÓN FINAL ---

// --- REEMPLAZA TU FUNCIÓN CON ESTA VERSIÓN AUTOMÁTICA ---

function actualizarDisplayCountdownPrincipal(tiempoFinalizacion) {
    const timerDiv = document.getElementById('countdownTimer');
    const countdownContainer = document.getElementById('topCountdownBanner');
    if (!timerDiv || !countdownContainer) return;

    const restante = tiempoFinalizacion - new Date().getTime();

    // --- LÓGICA CORREGIDA PARA EL GIRO AUTOMÁTICO ---
    if (restante < 0) {
        console.log("   🔴 ¡Tiempo terminado! Realizando acciones finales...");
        
        // 1. Detenemos el "motor" del contador.
        if (window.countdownInterval) clearInterval(window.countdownInterval);
        
        // 2. Ocultamos el banner.
        countdownContainer.classList.add('oculto');
        
        // 3. Limpiamos todos los datos del localStorage.
        localStorage.removeItem('sorteoTiempoFinalizacion');
        localStorage.removeItem('sorteoIniciado');
        localStorage.removeItem('sorteoIdParaGiro');
        
        // 4. LLAMAMOS DIRECTAMENTE AL GIRO DE LA RUEDA (¡YA NO MOSTRAMOS EL BOTÓN!).
        if (!estaGirando) {
            console.log("   🚀 ¡Iniciando el giro de la rueda automáticamente!");
            girarRuedaFrontView(true);
        }
        
        return; // Terminamos la ejecución de esta función aquí.
    }
    // --- FIN DE LA LÓGICA CORREGIDA ---


    // El resto de la función (actualizar números y colores) se mantiene igual.
    const horas = Math.floor(restante / (1000 * 60 * 60));
    const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((restante % (1000 * 60)) / 1000);
    timerDiv.textContent = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

    const segundosTotales = restante / 1000;
    if (segundosTotales <= 10) {
        countdownContainer.classList.add('is-critical');
        countdownContainer.classList.remove('is-urgent');
    } else if (segundosTotales <= 30) {
        countdownContainer.classList.add('is-urgent');
        countdownContainer.classList.remove('is-critical');
    } else {
        countdownContainer.classList.remove('is-urgent');
        countdownContainer.classList.remove('is-critical');
    }
}
    // --- Event Listeners ---
    function handleMouseDown(e) { if (!estaGirando) { isDragging = true; startY_Drag = e.clientY; startYOffset_Drag = currentYOffset; if(wheelCanvas) wheelCanvas.style.cursor = 'grabbing'; }}
    function handleMouseUpOrLeave() { isDragging = false; if(wheelCanvas) wheelCanvas.style.cursor = 'grab'; }
    function handleMouseMove(e) { if (!isDragging || estaGirando) return; e.preventDefault(); const deltaY = e.clientY - startY_Drag; currentYOffset = startYOffset_Drag + deltaY; const maxOffset = Math.max(0, (participantes.length * SEGMENT_HEIGHT_FRONT) - wheelHeight); currentYOffset = Math.max(0, Math.min(currentYOffset, maxOffset)); drawFrontWheel(participantes); }
    function handleWheelScroll(e) { if (estaGirando) return; e.preventDefault(); currentYOffset += e.deltaY * 0.5; const maxOffset = Math.max(0, (participantes.length * SEGMENT_HEIGHT_FRONT) - wheelHeight); currentYOffset = Math.max(0, Math.min(currentYOffset, maxOffset)); drawFrontWheel(participantes); }
    function addWheelEventListeners(canvas) { if (!canvas) return; canvas.style.cursor = 'grab'; canvas.addEventListener('mousedown', handleMouseDown); canvas.addEventListener('mouseup', handleMouseUpOrLeave); canvas.addEventListener('mouseleave', handleMouseUpOrLeave); canvas.addEventListener('mousemove', handleMouseMove); canvas.addEventListener('wheel', handleWheelScroll); }
    function removeWheelEventListeners(canvas) { if (!canvas) return; canvas.style.cursor = 'default'; canvas.removeEventListener('mousedown', handleMouseDown); canvas.removeEventListener('mouseup', handleMouseUpOrLeave); canvas.removeEventListener('mouseleave', handleMouseUpOrLeave); canvas.removeEventListener('mousemove', handleMouseMove); canvas.removeEventListener('wheel', handleWheelScroll); }
    const navContainer = document.getElementById('prizeNavContainer');
    if (navContainer) { navContainer.addEventListener('click', (e) => { if (e.target && e.target.classList.contains('prize-nav-panel')) { const slideIndex = parseInt(e.target.dataset.slideTo, 10); if (!isNaN(slideIndex)) moveToSlide(slideIndex); } }); }
    if (prizeCarouselTrack) { prizeCarouselTrack.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }); prizeCarouselTrack.addEventListener('touchend', (e) => { const deltaX = e.changedTouches[0].clientX - touchStartX; if (deltaX < -50) moveToSlide(premioActualIndex + 1); else if (deltaX > 50) moveToSlide(premioActualIndex - 1); }); }
    window.addEventListener('storage', (e) => { if (e.key === 'sorteoIniciado') { checkMainPageCountdownStatus(); } });

    // Animación de aparición al hacer scroll
    try {
        const revealElements = document.querySelectorAll('.reveal-on-scroll');

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        revealElements.forEach(element => {
            revealObserver.observe(element);
        });
    } catch (error) {
        console.error("Error inicializando animaciones de scroll:", error);
    }
    // --- Llamadas de Arranque ---
    cargarSorteosVisibles();
    mostrarGanadoresAnteriores();
    checkMainPageCountdownStatus();
}
