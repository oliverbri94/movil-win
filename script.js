// --- DEBUG: Script.js Iniciado ---
console.log("DEBUG: script.js está comenzando a cargarse...");

// --- Configuración ---
let PARTICIPATION_GOAL = 500; // Valor por defecto, se actualizará dinámicamente

// --- Variables Globales y Elementos DOM ---
const botonGirar = document.getElementById('botonGirar');
const resultadoDiv = document.getElementById('resultadoGanador');
const listaGanadoresDiv = document.getElementById('listaGanadoresAnteriores');
const loaderGanadores = document.getElementById('loaderGanadores');

// Navbar y FAQ
const mobileMenuButton = document.getElementById('mobileMenuButton');
const fullScreenMenu = document.getElementById('fullScreenMenu');
const closeMenuButton = document.getElementById('closeMenuButton');
const faqItems = document.querySelectorAll('.faq-question');

// === ELEMENTOS DEL NUEVO VISOR DE PREMIOS ===
const prizeCarouselContainer = document.getElementById('prizeCarouselContainer');
const prizeCarouselTrack = document.getElementById('prizeCarouselTrack');
const prevPrizeBtn = document.getElementById('prevPrizeBtn');
const nextPrizeBtn = document.getElementById('nextPrizeBtn');
const nextPrizePreview = document.getElementById('nextPrizePreview');
const nextPrizeImage = document.getElementById('nextPrizeImage');
// === ELEMENTOS PARA CUENTA REGRESIVA EN INDEX.HTML ===
const countdownDisplayContainer = document.getElementById('countdownDisplayContainer');
const countdownTimerDiv = document.getElementById('countdownTimer');
let mainPageCountdownInterval = null;
// ===========================================

// --- Variables de Estado del Visor ---
let sorteosDisponibles = [];
let premioActualIndex = 0;
let estaCambiandoPremio = false;

// Datos y estado del sorteo (ahora relativos al premio visible)
let participantes = [];
let estaGirando = false;
let indiceGanadorActual = -1;

// === CANVAS 2D RUEDA "PRICE IS RIGHT" FRONT VIEW ===
const wheelCanvas = document.getElementById('priceWheelCanvas');
const wheelCtx = wheelCanvas ? wheelCanvas.getContext('2d') : null;
const clackerElement = document.getElementById('clacker');
let wheelWidth, wheelHeight;
const SEGMENT_HEIGHT_FRONT = 60;
const VISIBLE_SEGMENTS_COUNT = 7;
let totalContentHeight;
let currentYOffset = 0;

// --- Variables para la Nueva Animación ---
let spinAnimationId_Front = null;
let winnerParticipantIndex_Front = -1;
let animationStartTime;
let animationDuration;
let startYOffset;
let targetYOffset_FinalResting;
let totalDistanceToTravel;
let spinPhase = 'stopped'; // Fases: 'stopped', 'accelerating', 'coasting', 'homing'
// --- Fin Variables de Animación ---


// --- Colores y Fuentes para la Rueda ---
const SEGMENT_COLORS_FRONT = ['#008037', '#F9C80E', '#D92E3A', '#2E5C98', '#7F5AF0', '#006A4E', '#FF8906'];
const BORDER_COLOR_GOLD_FRONT = "#DAA520";
const BORDER_COLOR_GOLD_DARK_FRONT = "#A88000";
const TEXT_COLOR_LIGHT_FRONT = "#FFFFFF";
const TEXT_COLOR_DARK_FRONT = "#1A1C1E";
const FONT_NAME_FRONT = "Poppins, 'Arial Black', sans-serif";

let lastClackerSegmentPassTime = 0;
const CLACKER_SOUND_INTERVAL = 60;
let lastClackerVisualSegmentIndex = -1;
// --- FIN CANVAS 2D RUEDA VARIABLES ---


// --- Sonidos ---
let winSound, tickSound;
let winSoundLoaded = false, tickSoundLoaded = false;
function setupAudio(src, isLoop = false) {
    const audio = new Audio(src);
    audio.loop = isLoop;
    audio.addEventListener('canplaythrough', () => {
        console.log(`Audio ${src} cargado y listo para reproducir.`);
        if (src.includes('win')) winSoundLoaded = true;
        if (src.includes('tick')) tickSoundLoaded = true;
    });
    audio.addEventListener('error', (e) => {
        console.error(`Error al cargar el audio ${src}:`, e);
        if (src.includes('win')) winSound = { play: () => {}, pause: () => {} };
        if (src.includes('tick')) tickSound = { play: () => {}, pause: () => {} };
    });
    return audio;
}
winSound = setupAudio('sounds/win.mp3');
tickSound = setupAudio('sounds/tick.mp3');
if (tickSound) tickSound.volume = 1;
// -----------


// --- Funciones ---

function formatConfidentialId(id_documento) {
    if (typeof id_documento === 'string' && id_documento.length === 10) {
        return `${id_documento.substring(0, 3)}****${id_documento.substring(id_documento.length - 3)}`;
    }
    return id_documento ? String(id_documento) : 'N/A';
}

// === LÓGICA DEL NUEVO VISOR DE PREMIOS ===

async function cargarSorteosVisibles() {
    console.log("Cargando sorteos visibles...");
    try {
        const response = await fetch('/api/sorteos-visibles');
        if (!response.ok) throw new Error('No se pudo obtener la lista de sorteos.');
        const data = await response.json();
        if (data.success && data.sorteos) {
            sorteosDisponibles = data.sorteos;
            if (sorteosDisponibles.length === 1) {
                sorteosDisponibles.push({
                    id_sorteo: null,
                    nombre_premio_display: "Próximo Gran Premio",
                    descripcion_premio: "¡Estamos preparando algo increíble para ti! Mantente atento a nuestras redes sociales.",
                    imagen_url: 'images/proximo_sorteo.png',
                    meta_participaciones: 300,
                    participantes_actuales: 0,
                    esProximo: true
                });
            }
            premioActualIndex = sorteosDisponibles.findIndex(s => s.status_sorteo === 'activo');
            if (premioActualIndex === -1) premioActualIndex = 0;
            await generarSlidesDelCarrusel();
            moveToSlide(premioActualIndex, true);
        } else {
            throw new Error(data.error || "El backend no devolvió una lista de sorteos válida.");
        }
    } catch (error) {
        console.error("Error fatal al cargar sorteos visibles:", error);
        if (prizeCarouselTrack) prizeCarouselTrack.innerHTML = `<div class="prize-carousel-slide"><p class="text-center w-full text-red-500">${error.message}</p></div>`;
    }
}
function getMotivationalMessage(percentage) {
    if (percentage >= 100) return "¡Meta alcanzada! El sorteo será pronto.";
    if (percentage >= 95) return "¡Estamos a un paso! Tu oportunidad es AHORA.";
    if (percentage >= 75) return "¡Casi llegamos! Muy pocos boletos digitales para la meta.";
    if (percentage >= 50) return "¡Impresionante! Ya superamos la mitad del camino.";
    if (percentage >= 25) return "¡Excelente progreso! Sigamos así.";
    return "¡El sorteo ha comenzado! Sé de los primeros en participar.";
}


// Nueva función para decidir si renderizar <img> o <video>
function renderMedia(sorteo) {
    const url = sorteo.imagen_url || 'images/proximo_sorteo.png';
    const esProximo = !sorteo.id_sorteo || sorteo.esProximo;
    
    if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
        return `<video src="${url}" class="${esProximo ? 'grayscale' : ''}" autoplay loop muted playsinline></video>`;
    }
    
    return `<img src="${url}" alt="${sorteo.nombre_premio_display}" class="${esProximo ? 'grayscale' : ''}">`;
}

async function generarSlidesDelCarrusel() {
    if (!prizeCarouselTrack) return;
    prizeCarouselTrack.innerHTML = '';
    const topPromises = sorteosDisponibles.map(sorteo => sorteo.id_sorteo ? fetch(`/api/top-participantes?sorteoId=${sorteo.id_sorteo}`).then(res => res.json()) : Promise.resolve([]));
    const todosLosTops = await Promise.all(topPromises);

    sorteosDisponibles.forEach((sorteo, index) => {
        const slide = document.createElement('div');
        slide.className = 'prize-carousel-slide';
        
        const esProximo = !sorteo.id_sorteo || sorteo.esProximo;
        const currentCount = sorteo.participantes_actuales || 0;
        const goal = sorteo.meta_participaciones || 200;
        const percentage = goal > 0 ? Math.min((currentCount / goal) * 100, 100) : 0;
        const top = todosLosTops[index] || [];
        const motivationalMessage = getMotivationalMessage(percentage);

        let topParticipantsHTML = '';
        if (top.length > 0) {
            top.forEach((p, i) => {
                topParticipantsHTML += `<li class="rank-${i+1}"><span class="top-posicion"><i class="fas fa-medal"></i></span><div class="top-info"><span class="top-nombre">${p.name || 'N/A'}</span><span class="top-ci">CI: ${formatConfidentialId(p.id)}</span></div><span class="top-cantidad">(${p.total_participaciones} ${p.total_participaciones === 1 ? 'boleto' : 'boletos'})</span></li>`;
            });
        } else {
            topParticipantsHTML = '<li style="justify-content:center;">Aún no hay top.</li>';
        }
        slide.innerHTML = `
            <div class="prize-image-container">
                ${renderMedia(sorteo)} <!-- <<<--- LLAMADA A LA NUEVA FUNCIÓN -->
            </div>
            <div class="prize-info-container">
                <h2 class="prize-title">${sorteo.nombre_premio_display}</h2>
                <a href="https://wa.me/593963135510?text=Hola%2C%20quiero%20comprar%20una%20participaci%C3%B3n%20individual%20para%20el%20sorteo%20del%20${encodeURIComponent(sorteo.nombre_premio_display)}%21" target="_blank" class="boton-cta boton-individual-visor" style="${esProximo ? 'display: none;' : ''}">
                    <i class="fab fa-whatsapp"></i> Comprar Individual ($2)
                </a>
                <div class="progress-info-wrapper" style="${esProximo ? 'display: none;' : ''}">
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar-fill" style="width: ${percentage}%;">${percentage.toFixed(2)}%</div>
                    </div>
                    <p class="motivational-text-integrated">${motivationalMessage}</p>
                </div>
                <div class="top-participants-wrapper" style="${esProximo ? 'display: none;' : ''}">
                    <button class="toggle-top-btn active">
                        <i class="fas fa-crown"></i>
                        <span>Top Participantes</span>
                        <i class="fas fa-chevron-down chevron"></i>
                    </button>
                    <ol class="top-participants-list active">${topParticipantsHTML}</ol>
                </div>
            </div>
        `;
        prizeCarouselTrack.appendChild(slide);
    });

    document.querySelectorAll('.toggle-top-btn').forEach(button => {
        button.addEventListener('click', () => {
            button.classList.toggle('active');
            const list = button.nextElementSibling;
            if (list) list.classList.toggle('active');
        });
    });
}

function moveToSlide(index, esCargaInicial = false) {
    if (!prizeCarouselTrack || estaCambiandoPremio || index < 0 || index >= sorteosDisponibles.length) return;
    premioActualIndex = index;
    const offset = -index * 100;
    prizeCarouselTrack.style.transition = esCargaInicial ? 'none' : 'transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)';
    prizeCarouselTrack.style.transform = `translateX(${offset}%)`;
    const sorteoActual = sorteosDisponibles[premioActualIndex];
    if (sorteoActual && sorteoActual.id_sorteo) {
        PARTICIPATION_GOAL = sorteoActual.meta_participaciones;
        fetch(`/api/participantes?sorteoId=${sorteoActual.id_sorteo}`).then(res => res.json()).then(data => {
            participantes = data || [];
            drawFrontWheel();
            if (document.querySelector('.contenedor-sorteo')) {
                document.querySelector('.contenedor-sorteo').style.display = 'block';
            }
        }).catch(err => {
            console.error("Error cargando participantes para la rueda:", err);
            participantes = [];
            drawFrontWheel();
        });
    } else {
        participantes = [];
        drawFrontWheel();
        if (document.querySelector('.contenedor-sorteo')) {
            document.querySelector('.contenedor-sorteo').style.display = 'none';
        }
    }
    actualizarBotonesNav();
    actualizarPreviewSiguiente();
}

function actualizarBotonesNav() {
    if (!prevPrizeBtn || !nextPrizeBtn) return;
    prevPrizeBtn.disabled = premioActualIndex === 0;
    nextPrizeBtn.disabled = premioActualIndex >= sorteosDisponibles.length - 1;
}
function actualizarPreviewSiguiente() {
    if (!nextPrizeImage || !nextPrizePreview) return;
    const proximoIndex = premioActualIndex + 1;
    const proximoSorteo = sorteosDisponibles[proximoIndex];

    if (proximoSorteo) {
        nextPrizeImage.style.display = 'block';
        nextPrizePreview.querySelector('span').style.display = 'none';
        nextPrizeImage.src = 'images/proximo_sorteo.png'; // Imagen predeterminada
    } else {
        nextPrizeImage.style.display = 'none';
        nextPrizePreview.querySelector('span').style.display = 'block';
    }
}
// === Lógica de la Rueda 2D (Completa) ===
function initPriceWheel() {
    if (!wheelCanvas || !wheelCtx) { return; }
    setupFrontWheelCanvas();
    window.addEventListener('resize', setupFrontWheelCanvas);
}

function setupFrontWheelCanvas() {
    if (!wheelCanvas) return;
    const container = document.getElementById('wheelCanvasContainer');
    if (container) {
        wheelWidth = container.clientWidth;
        wheelHeight = SEGMENT_HEIGHT_FRONT * VISIBLE_SEGMENTS_COUNT;
        wheelCanvas.width = wheelWidth;
        wheelCanvas.height = wheelHeight;
        drawFrontWheel();
    }
}
function getColorForParticipant(id_documento, index) {
    if (!id_documento) return SEGMENT_COLORS_FRONT[index % SEGMENT_COLORS_FRONT.length];
    let hash = 0;
    for (let i = 0; i < id_documento.length; i++) {
        const char = id_documento.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    const colorIndex = Math.abs(hash) % SEGMENT_COLORS_FRONT.length;
    return SEGMENT_COLORS_FRONT[colorIndex];
}
function drawFrontWheel() {
    if (!wheelCtx || !participantes) { return; }
    wheelCtx.clearRect(0, 0, wheelWidth, wheelHeight);
    wheelCtx.fillStyle = "#000000";
    wheelCtx.fillRect(0, 0, wheelWidth, wheelHeight);

    if (participantes.length === 0) {
        wheelCtx.fillStyle = "#555";
        wheelCtx.textAlign = "center";
        wheelCtx.textBaseline = "middle";
        wheelCtx.font = `bold ${Math.min(20, wheelWidth * 0.05)}px ${FONT_NAME_FRONT}`;
        wheelCtx.fillText("No hay participantes", wheelWidth / 2, wheelHeight / 2);
        return;
    }

    totalContentHeight = participantes.length * SEGMENT_HEIGHT_FRONT;
    currentYOffset = (currentYOffset % totalContentHeight + totalContentHeight) % totalContentHeight;
    const startIndex = Math.floor(currentYOffset / SEGMENT_HEIGHT_FRONT);
    const yPixelOffset = -(currentYOffset % SEGMENT_HEIGHT_FRONT);
    let baseFontSize = Math.max(11, Math.min(16, SEGMENT_HEIGHT_FRONT * 0.25));
    if (participantes.length > 150) baseFontSize = Math.max(9, SEGMENT_HEIGHT_FRONT * 0.22);

    for (let i = 0; i < VISIBLE_SEGMENTS_COUNT + 2; i++) {
        const participantIndex = (startIndex + i) % participantes.length;
        const p = participantes[participantIndex];
        if (!p) continue;

        const segmentYOnCanvas = yPixelOffset + i * SEGMENT_HEIGHT_FRONT;
        let scale = 1, opacity = 1;
        const distFromCenterOfViewport = Math.abs(segmentYOnCanvas + SEGMENT_HEIGHT_FRONT / 2 - wheelHeight / 2);
        const perspectiveFactor = distFromCenterOfViewport / (wheelHeight * 0.6);
        if (participantes.length > VISIBLE_SEGMENTS_COUNT) {
            scale = 1 - (perspectiveFactor * 0.15);
            opacity = Math.max(0.3, 1 - (perspectiveFactor * 0.6));
        }
        const actualSegmentHeight = SEGMENT_HEIGHT_FRONT * scale;
        const actualFontSize = baseFontSize * scale;
        const yPosCenteredOnCanvas = segmentYOnCanvas + (SEGMENT_HEIGHT_FRONT - actualSegmentHeight) / 2;

        if (yPosCenteredOnCanvas + actualSegmentHeight < -SEGMENT_HEIGHT_FRONT || yPosCenteredOnCanvas > wheelHeight + SEGMENT_HEIGHT_FRONT) continue;

        wheelCtx.globalAlpha = opacity;
        wheelCtx.fillStyle = getColorForParticipant(p.id, participantIndex);
        wheelCtx.fillRect(0, yPosCenteredOnCanvas, wheelWidth, actualSegmentHeight);
        
        const mainBorderWidth = Math.max(2, 4 * scale);
        wheelCtx.strokeStyle = BORDER_COLOR_GOLD_FRONT;
        wheelCtx.lineWidth = mainBorderWidth;
        wheelCtx.strokeRect(mainBorderWidth / 2, yPosCenteredOnCanvas + mainBorderWidth / 2, wheelWidth - mainBorderWidth, actualSegmentHeight - mainBorderWidth);

        const shadowBorderWidth = Math.max(1, mainBorderWidth * 0.4);
        wheelCtx.lineWidth = shadowBorderWidth;
        wheelCtx.strokeStyle = BORDER_COLOR_GOLD_DARK_FRONT;
        wheelCtx.beginPath();
        wheelCtx.moveTo(mainBorderWidth, yPosCenteredOnCanvas + actualSegmentHeight - mainBorderWidth - shadowBorderWidth / 2);
        wheelCtx.lineTo(wheelWidth - mainBorderWidth, yPosCenteredOnCanvas + actualSegmentHeight - mainBorderWidth - shadowBorderWidth / 2);
        wheelCtx.stroke();
        wheelCtx.beginPath();
        wheelCtx.moveTo(wheelWidth - mainBorderWidth - shadowBorderWidth / 2, yPosCenteredOnCanvas + mainBorderWidth);
        wheelCtx.lineTo(wheelWidth - mainBorderWidth - shadowBorderWidth / 2, yPosCenteredOnCanvas + actualSegmentHeight - mainBorderWidth);
        wheelCtx.stroke();

        const currentSegmentColor = wheelCtx.fillStyle;
        const isLightBg = currentSegmentColor === '#F9C80E' || currentSegmentColor === '#FFC107';
        wheelCtx.fillStyle = isLightBg ? TEXT_COLOR_DARK_FRONT : TEXT_COLOR_LIGHT_FRONT;
        wheelCtx.textAlign = "center";
        wheelCtx.textBaseline = "middle";
        wheelCtx.font = `700 ${actualFontSize}px ${FONT_NAME_FRONT}`;
        let nombreParaMostrar = p.name || "S/N";
        const maxTextWidth = wheelWidth * 0.80 * scale;
        if(wheelCtx.measureText(nombreParaMostrar).width > maxTextWidth) {
            while(wheelCtx.measureText(nombreParaMostrar + "...").width > maxTextWidth && nombreParaMostrar.length > 4){
                nombreParaMostrar = nombreParaMostrar.slice(0, -1);
            }
            nombreParaMostrar += "...";
        }
        wheelCtx.fillText(nombreParaMostrar, wheelWidth / 2, yPosCenteredOnCanvas + actualSegmentHeight * 0.38, maxTextWidth);
        wheelCtx.font = `500 ${actualFontSize * 0.65}px ${FONT_NAME_FRONT}`;
        wheelCtx.fillText(`CI: ${formatConfidentialId(p.id)}`, wheelWidth / 2, yPosCenteredOnCanvas + actualSegmentHeight * 0.72, maxTextWidth);
        wheelCtx.globalAlpha = 1;
    }
}

// Easing para aceleración inicial y desaceleración final
function easeInQuad(x) {
    return x * x;
}
function easeInOutCustom(x) {
    if (x < 0.4) {
        // Primer 25% del tiempo: aceleración
        return 0.5 * easeInQuad(x / 0.4);
    } else {
        // Último 75%: desaceleración
        return 0.5 + 0.5 * easeOutQuint((x - 0.4) / 0.6);
    }
}
function easeOutQuint(x) {
    return 1 - Math.pow(1 - x, 5);
}

function animateSpinFrontView() {
    if (spinPhase === 'stopped') {
        cancelAnimationFrame(spinAnimationId_Front);
        return;
    }
    
    spinAnimationId_Front = requestAnimationFrame(animateSpinFrontView);
    
    const now = Date.now();
    const elapsedTime = now - animationStartTime;
    let progress = Math.min(elapsedTime / animationDuration, 1);

    const easedProgress = easeInOutCustom(progress);
    currentYOffset = startYOffset + totalDistanceToTravel * easedProgress;
    
    drawFrontWheel();

    if (progress >= 1) {
        spinPhase = 'stopped';
        finalizarGiroFrontView(participantes[winnerParticipantIndex_Front]);
    }
    
    const pointerCenterY = wheelHeight / 2;
    const centerSegmentVirtualIndex = Math.floor(((currentYOffset + pointerCenterY + totalContentHeight) % totalContentHeight) / SEGMENT_HEIGHT_FRONT);
    if (centerSegmentVirtualIndex !== lastClackerVisualSegmentIndex) {
        if (tickSound && tickSoundLoaded && (Date.now() - lastClackerSegmentPassTime > CLACKER_SOUND_INTERVAL)) {
            tickSound.currentTime = 0;
            tickSound.play().catch(e => console.warn("Error clacker:", e));
            lastClackerSegmentPassTime = Date.now();
        }
        lastClackerVisualSegmentIndex = centerSegmentVirtualIndex;
    }
}

async function girarRuedaFrontView(isAutomatic = false) {
    if (!participantes || participantes.length === 0) { showStatusMessage("No hay boletos digitales.", true); return; }
    if (estaGirando) return;

    if (!isAutomatic) {
        const adminPassword = prompt("Contraseña de admin para realizar el sorteo:");
        if (adminPassword === null) return;
        if (!adminPassword) { showStatusMessage("Se requiere contraseña para girar manualmente.", true); return; }
    }

    estaGirando = true; winnerParticipantIndex_Front = -1;
    if (botonGirar) botonGirar.disabled = true;
    if (resultadoDiv) { resultadoDiv.classList.remove('activo'); resultadoDiv.innerHTML = '<p>Buscando al ganador...</p>'; }
    if (winSound) { winSound.pause(); winSound.currentTime = 0; }
    if (clackerElement) clackerElement.classList.remove('clacker-settle-animation');

    try {
        const adminPasswordForBackend = isAutomatic ? "AUTO_COUNTDOWN_TRIGGER" : prompt("Confirmar contraseña de admin para backend:");
        if (!adminPasswordForBackend && !isAutomatic) {
             showStatusMessage("Se requiere contraseña para backend.", true);
             estaGirando = false; if(botonGirar) botonGirar.disabled = false;
             return;
        }

        const sorteoActual = sorteosDisponibles[premioActualIndex];
        const response = await fetch('/api/realizar-sorteo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: adminPasswordForBackend, premio_actual: sorteoActual.nombre_premio_display || "Premio Actual" }) });
        const resultadoSorteo = await response.json();
        if (!response.ok) { throw new Error(resultadoSorteo.error || `Error ${response.status}`); }
        if (!resultadoSorteo.success || !resultadoSorteo.ganador) { throw new Error("Respuesta inválida."); }

        const ganadorDelBackend = resultadoSorteo.ganador;
        winnerParticipantIndex_Front = participantes.findIndex(p => p.orden_id === ganadorDelBackend.orden_id);
        if (winnerParticipantIndex_Front === -1) { throw new Error("Ganador no sincronizado."); }
        
        const pointerCenterY = wheelHeight / 2;
        targetYOffset_FinalResting = (winnerParticipantIndex_Front * SEGMENT_HEIGHT_FRONT) + (SEGMENT_HEIGHT_FRONT / 2) - pointerCenterY;
        
        const vueltasCompletas = 6 + Math.floor(Math.random() * 3); // Entre 6 y 8 vueltas completas
        const distanciaDeVueltas = vueltasCompletas * totalContentHeight;
        
        // Asegurarse que la rueda siempre gire hacia adelante
        let distanciaHastaGanador = (targetYOffset_FinalResting - (currentYOffset % totalContentHeight) + totalContentHeight) % totalContentHeight;
        totalDistanceToTravel = distanciaDeVueltas + distanciaHastaGanador;
        
        animationStartTime = Date.now();
        animationDuration = 40000 + Math.random() * 3000; // 12 a 15 segundos
        startYOffset = currentYOffset;
        
        if (resultadoDiv) { resultadoDiv.innerHTML = '<p>¡Girando la rueda!</p>'; }
        if (spinAnimationId_Front) cancelAnimationFrame(spinAnimationId_Front);
        
        spinPhase = 'running'; // Una sola fase de animación controlada por easing
        animateSpinFrontView();

    } catch (error) {
        console.error("Error al realizar sorteo:", error);
        showStatusMessage(`${error.message}`, true);
        spinPhase = 'stopped';
        estaGirando = false;
        if (botonGirar) botonGirar.disabled = false;
    }
}
function finalizarGiroFrontView(ganador) {
    estaGirando = false;
    const sorteoActual = sorteosDisponibles[premioActualIndex];
    console.log(`Función finalizarGiroFrontView llamada para: ${ganador.name}`);
    
    // El div de resultado de abajo ahora solo sirve para errores durante el giro
    if (resultadoDiv) {
        resultadoDiv.innerHTML = '';
        resultadoDiv.classList.remove('activo');
    }
    
    // El banner de cuenta regresiva ahora muestra al ganador
    if (countdownDisplayContainer) {
        countdownDisplayContainer.classList.remove('oculto');
        countdownDisplayContainer.style.backgroundColor = 'var(--clr-green)';
        countdownDisplayContainer.innerHTML = `
            <h3 style="color: var(--clr-white); font-size: 1.2em; margin-bottom: 5px; font-weight: 500;">¡TENEMOS UN GANADOR!</h3>
            <p style="color: var(--clr-white); font-size: 1.6em; font-weight: 700;">${ganador.name}</p>
            <p style="color: rgba(255,255,255,0.8); font-size: 1em;">(CI: ${formatConfidentialId(ganador.id)})</p>
            <p style="color: rgba(255,255,255,0.9); font-size: 1.1em; margin-top: 5px;">Se ha ganado un ${sorteoActual.nombre_premio_display}</p>
        `;
    }

    if (winSound && winSoundLoaded) { winSound.play().catch(e => console.error("Error audio victoria:", e)); }
    lanzarConfeti();
    if (botonGirar) botonGirar.disabled = false;
    mostrarGanadoresAnteriores();
}


// === FUNCIÓN DE CONFETI MEJORADA ===
function lanzarConfeti() {
    if (typeof confetti !== 'function') { 
        console.warn("'confetti' no está cargado."); 
        return;
    }
    console.log("Lanzando confeti mejorado!");
    const duration = 8 * 1000;
    const animationEnd = Date.now() + duration;
    const colors = ['#ff8906', '#7f5af0', '#2cb67d', '#ffffff', '#ffd700'];

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 80,
            origin: { x: 0 },
            colors: colors
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 80,
            origin: { x: 1 },
            colors: colors
        });

        if (Date.now() < animationEnd) {
            requestAnimationFrame(frame);
        }
    }());
    
    // Explosión central
    setTimeout(() => {
        confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            shapes: ['star'],
            colors: colors
        });
    }, 250);
}
function showStatusMessage(message, isError = false, element = resultadoDiv) {
    if (!element) return;
    const esExito = message.toLowerCase().includes('felicidades') || message.toLowerCase().includes('¡listo!');
    element.classList.toggle('activo', isError || esExito);
    if (esExito && !isError && message.toLowerCase().includes('felicidades')) {
        const nombreMatch = message.match(/Felicidades, (.*?)\!/);
        const ciMatch = message.match(/\(CI: ([\w*-]+)\)/);
        if (nombreMatch && nombreMatch[1] && ciMatch && ciMatch[1]) {
            element.innerHTML = `<p class="nombre-ganador">¡Felicidades, ${nombreMatch[1]}!</p><p class="id-ganador">CI: ${ciMatch[1]}</p>`;
        } else {
             element.innerHTML = `<p style="color: ${isError ? 'var(--clr-red)' : (esExito ? 'var(--clr-green)' : 'var(--clr-dark-text-alt)')};">${message}</p>`;
        }
    } else {
        element.innerHTML = `<p style="color: ${isError ? 'var(--clr-red)' : 'var(--clr-dark-text-alt)'};">${message}</p>`;
    }
}
function toggleFullScreenMenu() {
    if (fullScreenMenu) {
        const isVisible = fullScreenMenu.classList.contains('menu-visible');
        if (isVisible) {
            fullScreenMenu.classList.remove('menu-visible');
            setTimeout(() => { fullScreenMenu.classList.add('hidden'); }, 300);
        } else {
            fullScreenMenu.classList.remove('hidden');
            void fullScreenMenu.offsetWidth;
            fullScreenMenu.classList.add('menu-visible');
        }
    }
}
function toggleFaqAnswer(event) {
    const questionButton = event.currentTarget;
    const answerDiv = questionButton.nextElementSibling;
    questionButton.classList.toggle('active');
    if (answerDiv.classList.contains('active')) {
        answerDiv.classList.remove('active');
        answerDiv.style.maxHeight = null;
    } else {
        answerDiv.classList.add('active');
        answerDiv.style.maxHeight = answerDiv.scrollHeight + "px";
    }
}
async function mostrarGanadoresAnteriores() {
    if (!listaGanadoresDiv || !loaderGanadores) return;
    loaderGanadores.classList.remove('oculto');
    listaGanadoresDiv.innerHTML = '';
    try {
        const response = await fetch('/api/ultimos-ganadores');
        if (!response.ok) { throw new Error('Error del servidor'); }
        const ultimosGanadores = await response.json();
        if (ultimosGanadores.length === 0) {
            listaGanadoresDiv.innerHTML = '<p style="text-align: center; color: var(--clr-dark-text-alt);">Aún no hay ganadores recientes.</p>';
        } else {
            ultimosGanadores.forEach(ganador => {
                const card = document.createElement('div');
                card.classList.add('ganador-card');
                card.innerHTML = `
                    <img src="${ganador.imagenUrl || 'images/placeholder-ganador.png'}" alt="Foto de ${ganador.nombre}" class="ganador-foto" onerror="this.onerror=null; this.src='images/placeholder-ganador.png';">
                    <div class="ganador-info">
                        <h3 class="ganador-nombre">${ganador.nombre}</h3>
                        <p class="ganador-ubicacion"><i class="fas fa-map-marker-alt"></i> ${ganador.ciudad || 'N/A'}</p>
                        ${ganador.premio ? `<p class="ganador-premio">Premio: ${ganador.premio}</p>` : ''}
                        ${ganador.fecha ? `<p class="ganador-fecha">Fecha: ${ganador.fecha}</p>` : ''}
                    </div>
                `;
                listaGanadoresDiv.appendChild(card);
            });
        }
    } catch (error) {
        console.error("Error cargando últimos ganadores:", error);
        listaGanadoresDiv.innerHTML = `<p style="text-align: center; color: var(--clr-red);">Error al cargar ganadores.</p>`;
    } finally {
        loaderGanadores.classList.add('oculto');
    }
}

// === FUNCIONES PARA CUENTA REGRESIVA EN INDEX.HTML ===
function actualizarDisplayCountdownPrincipal(tiempoFinalizacion) {
    if (!countdownTimerDiv || !countdownDisplayContainer) return;
    const ahora = new Date().getTime();
    const restante = tiempoFinalizacion - ahora;

    if (restante < 0) {
        countdownDisplayContainer.innerHTML = '<h3 style="color: var(--clr-white); font-size: 1.8em; margin-bottom: 10px;">¡Realizando Sorteo...!</h3>';
        countdownDisplayContainer.style.backgroundColor = 'var(--clr-secondary)';
        clearInterval(mainPageCountdownInterval);
        localStorage.removeItem('sorteoTiempoFinalizacion');
        localStorage.removeItem('sorteoIniciado');
        localStorage.removeItem('sorteoIdParaGiro');
        console.log("Cuenta regresiva finalizada. Iniciando giro automático...");
        if (!estaGirando) {
            girarRuedaFrontView(true);
        }
        return;
    }

    const horas = Math.floor((restante % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((restante % (1000 * 60)) / 1000);

    countdownTimerDiv.textContent = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}

function checkMainPageCountdownStatus(isAdmin) {
    if (!countdownDisplayContainer || !countdownTimerDiv) return;

    const tiempoFinalizacionStorage = localStorage.getItem('sorteoTiempoFinalizacion');
    const sorteoIniciadoAdmin = localStorage.getItem('sorteoIniciado');
    const sorteoIdGuardado = localStorage.getItem('sorteoIdParaGiro');
    const sorteoActivoActual = sorteosDisponibles[premioActualIndex];

    if (sorteoIniciadoAdmin === 'true' && tiempoFinalizacionStorage && sorteoActivoActual && sorteoIdGuardado == sorteoActivoActual.id_sorteo) {
        const tiempoFinalizacion = parseInt(tiempoFinalizacionStorage);
        if (tiempoFinalizacion > new Date().getTime()) {
            countdownDisplayContainer.classList.remove('oculto');
            if (botonGirar && isAdmin) {
                botonGirar.style.display = 'none';
            }
            actualizarDisplayCountdownPrincipal(tiempoFinalizacion);
            if (mainPageCountdownInterval) clearInterval(mainPageCountdownInterval);
            mainPageCountdownInterval = setInterval(() => {
                actualizarDisplayCountdownPrincipal(tiempoFinalizacion);
            }, 1000);
        } else {
            actualizarDisplayCountdownPrincipal(tiempoFinalizacion);
        }
    } else {
        countdownDisplayContainer.classList.add('oculto');
        if (botonGirar && isAdmin) {
            botonGirar.style.display = 'block';
        }
    }
}
// ===============================================

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DEBUG: DOM Cargado. Iniciando aplicación del sorteo...");
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.has('admin');
    if(isAdmin) console.warn("MODO ADMIN ACTIVADO");

    // Lógica para el nuevo visor
    if(prizeCarouselContainer) {
        await cargarSorteosVisibles();
        if (prevPrizeBtn) prevPrizeBtn.addEventListener('click', () => moveToSlide(premioActualIndex - 1));
        if (nextPrizeBtn) nextPrizeBtn.addEventListener('click', () => moveToSlide(premioActualIndex + 1));
    }

    // Lógica que se mantiene
    initPriceWheel();
    mostrarGanadoresAnteriores();
    
    if (botonGirar) {
        botonGirar.addEventListener('click', () => girarRuedaFrontView(false));
    } else {
        console.error("Error Crítico: Botón #botonGirar no encontrado.");
    }

    checkMainPageCountdownStatus(isAdmin);

    if (mobileMenuButton) { mobileMenuButton.addEventListener('click', toggleFullScreenMenu); }
    if (closeMenuButton) { closeMenuButton.addEventListener('click', toggleFullScreenMenu); }
    faqItems.forEach(item => { item.addEventListener('click', toggleFaqAnswer); });

    if (fullScreenMenu) {
        const menuLinks = fullScreenMenu.querySelectorAll('ul a');
        menuLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (link.getAttribute('href').startsWith('#') && fullScreenMenu.classList.contains('menu-visible')) {
                    toggleFullScreenMenu();
                }
            });
        });
    }
});