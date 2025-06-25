console.log("VERSIÓN DEL SCRIPT: 24 DE JUNIO - ACTUALIZADA"); 

// =================================================================================
// ARCHIVO JAVASCRIPT CONSOLIDADO PARA MOVIL WIN
// Contiene:
// 1. Lógica del Menú de Navegación (Funciona en todas las páginas).
// 2. Lógica del Carrusel, Rueda y Sorteos (Funciona solo en index.html).
// =================================================================================

// =================================================================
// === ARCHIVO SCRIPT.JS COMPLETO Y REORGANIZADO (24 DE JUNIO) ===
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DEL MENÚ DE NAVEGACIÓN (GLOBAL) ---
    try {
        const mobileMenuButton = document.getElementById('mobileMenuButton');
        const fullScreenMenu = document.getElementById('fullScreenMenu');
        const closeMenuButton = document.getElementById('closeMenuButton');

        if (mobileMenuButton && fullScreenMenu && closeMenuButton) {
            const toggleFullScreenMenu = () => fullScreenMenu.classList.toggle('hidden');
            mobileMenuButton.addEventListener('click', toggleFullScreenMenu);
            closeMenuButton.addEventListener('click', toggleFullScreenMenu);
        }
    } catch (error) {
        console.error("Error al inicializar el menú de navegación:", error);
    }

    // --- LÓGICA DE LA PÁGINA PRINCIPAL (INDEX.HTML) ---
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


/**
 * Esta es la función principal que contiene toda la lógica para la página del sorteo.
 */
function initializeRafflePage() {

    // --- 1. VARIABLES Y ESTADO DE LA RULETA ---
    const clackSound = new Audio('sounds/tick.mp3');
    const winnerSound = new Audio('sounds/win.mp3');
    let sorteosDisponibles = [];
    let premioActualIndex = 0;
    let participantes = [];
    let estaGirando = false;
    let sorteoFinalizado = false;
    let finalWinnerInfo = null;
    let wheelCanvas = null;
    let wheelCtx = null;
    let wheelWidth, wheelHeight;
    let isDragging = false;
    let startY_Drag = 0;
    let startYOffset_Drag = 0;
    let touchStartX = 0;
    const SEGMENT_HEIGHT_FRONT = 60;
    const VISIBLE_SEGMENTS_COUNT = 7;
    let currentYOffset = 0;
    let lastSegmentIndex = -1;

    // Elementos del DOM
    const prizeCarouselTrack = document.getElementById('prizeCarouselTrack');
    const prizeNavContainer = document.getElementById('prizeNavContainer');
    const listaGanadoresDiv = document.getElementById('listaGanadoresAnteriores');
    const loaderGanadores = document.getElementById('loaderGanadores');

    // Configuración inicial
    clackSound.volume = 0.5;
    winnerSound.volume = 0.7;

    // --- 2. FUNCIONES DE AYUDA (Helpers) ---
    // Todas las funciones que ayudan a formatear datos, dibujar, etc.
// En script.js, añade esta nueva función de ayuda

    /**
     * Anonimiza un número de cédula, mostrando solo los primeros y últimos dos dígitos.
     * @param {string} id_documento - El número de cédula de 10 dígitos.
     * @returns {string} La cédula formateada (ej: "17...45").
     * 
     */
    function formatConfidentialId(id_documento) {
        if (typeof id_documento === 'string' && id_documento.length === 10) {
            return `CI: ${id_documento.substring(0, 2)}...${id_documento.substring(id_documento.length - 2)}`;
        }
        return id_documento || 'Cédula no disp.';
    }
    function formatNameForWheel(name) {
        if (!name) return 'Participante';
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0];
        if (nameParts.length > 1) {
            const lastNameInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
            return `${firstName} ${lastNameInitial}.`;
        }
        return firstName;
    }

    /**
     * Genera un índice numérico estable a partir de un string (como una cédula).
     * Se usará para asignar un color consistente de la paleta a cada participante.
     * @param {string} str - La cadena de texto a procesar.
     * @param {number} max - El número de colores disponibles en la paleta.
     * @returns {number} Un índice numérico entre 0 y max-1.
     */
    function getStableColorIndex(str, max) {
        if (!str) return 0;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Usamos Math.abs para asegurar que el resultado sea siempre positivo
        return Math.abs(hash % max);
    }

    function getAvatarInitials(name) {
        if (!name) return '??';
        const nameParts = name.trim().split(' ');
        if (nameParts.length > 1) {
            return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    function stringToHslColor(str) {
        if (!str) return 'hsl(200, 70%, 55%)';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        // Usamos alta saturación (70%) y una luminosidad media (55%) para colores vibrantes
        return `hsl(${h}, 70%, 55%)`;
    }

    function wrapText(context, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = context.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                context.fillText(line, x, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        context.fillText(line, x, y);
    }



    function iniciarContadorSincronizado(tiempoFinalizacion, sorteoIdDelContador) {
        const countdownContainer = document.getElementById('topCountdownBanner');
        const timerDiv = document.getElementById('countdownTimer');
        if (!countdownContainer || !timerDiv) return;

        countdownContainer.classList.remove('oculto');

        if (window.countdownInterval) clearInterval(window.countdownInterval);

        const actualizar = () => {
            const restante = tiempoFinalizacion - new Date().getTime();
            
            if (restante < 0) {
                clearInterval(window.countdownInterval);
                countdownContainer.classList.add('oculto');

                // --- INICIO DE LA LÓGICA PARA GIRAR LA RUEDA ---
                console.log(`¡Contador para sorteo ID ${sorteoIdDelContador} ha terminado!`);
                
                // Verificamos si el slide que se está mostrando es el del sorteo que acaba de terminar.
                const sorteoVisible = sorteosDisponibles[premioActualIndex];
                if (sorteoVisible && sorteoVisible.id_sorteo == sorteoIdDelContador) {
                    console.log("El slide correcto está visible. Iniciando giro automático...");
                    if (!estaGirando) { // Doble chequeo para evitar giros múltiples
                    girarRuedaFrontView(true);
                    }
                } else {
                    console.log("El slide del sorteo no está visible. Refrescando la página para sincronizar el estado.");
                    // Si el usuario está viendo otro slide, un refresco es la forma más segura de sincronizar todo.
                    location.reload();
                }
                // --- FIN DE LA LÓGICA ---
                return;
            }
            
            const horas = Math.floor(restante / (1000 * 60 * 60));
            const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((restante % (1000 * 60)) / 1000);
            
            timerDiv.textContent = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
        };
        
        actualizar();
        window.countdownInterval = setInterval(actualizar, 1000);
    }
            
    function getMotivationalMessage(percentage) {
        if (percentage >= 100) return "¡Meta alcanzada! El sorteo será pronto.";
        if (percentage >= 95) return "¡Estamos a un paso! Tu oportunidad es AHORA.";
        if (percentage >= 75) return "¡Casi llegamos! Muy pocos boletos para la meta.";
        if (percentage >= 50) return "¡Impresionante! Superamos la mitad del camino.";
        if (percentage >= 25) return "¡Excelente progreso! Sigamos así.";
        return "¡El sorteo ha comenzado! Sé de los primeros.";
    }

    function renderMedia(sorteo) {
        const url = sorteo.imagen_url || 'images/proximo_sorteo.png';
        const classes = sorteo.esProximo ? 'grayscale' : '';
        if (url.endsWith('.mp4') || url.endsWith('.webm')) {
            return `<video src="${url}" class="${classes}" autoplay loop muted playsinline></video>`;
        }
        return `<img src="${url}" alt="${sorteo.nombre_premio_display}" class="${classes}">`;
    }

    function renderizarPaquetesPublicos(paquetes, contenedor) {
        if (!contenedor) return;
        contenedor.innerHTML = '';
        if (!paquetes || paquetes.length === 0) {
            contenedor.innerHTML = '<p style="text-align:center; color: var(--clr-dark-text-alt);">No hay paquetes de boletos disponibles para este sorteo en este momento.</p>';
            return;
        }
        const paqueteIndividual = paquetes.find(p => p.boletos === 1);
        const precioIndividual = paqueteIndividual ? paqueteIndividual.precio : null;
        const paquetesMultiples = paquetes.filter(p => p.boletos > 1);
        const paquetePopular = paquetesMultiples.length > 0 ? paquetesMultiples.reduce((max, p) => (p.boletos > max.boletos ? p : max), paquetesMultiples[0]) : null;

        paquetes.forEach(paquete => {
            let valorRealHTML = '';
            let boletosGratisHTML = '';
            if (precioIndividual && paquete.boletos > 1) {
                const valorReal = precioIndividual * paquete.boletos;
                const ahorro = valorReal - paquete.precio;
                if (ahorro > 0) {
                    valorRealHTML = `<span class="precio-original-tachado">$${valorReal.toFixed(0)}</span>`;
                    const boletosGratis = Math.floor(ahorro / precioIndividual);
                    if (boletosGratis > 0) {
                        boletosGratisHTML = `<div class="etiqueta-ahorro">+${boletosGratis} Boleto(s) GRATIS</div>`;
                    }
                }
            }
            const esPopular = (paquete === paquetePopular);
            const mensajeWhatsApp = `Hola, quiero el paquete "${paquete.nombre}" de ${paquete.boletos} boletos por $${paquete.precio} para el sorteo MOVIL WIN!`;
            const paqueteHTML = `<div class="paquete-item ${esPopular ? 'popular' : ''}">${esPopular ? '<span class="etiqueta-popular">Más Popular</span>' : ''}<div class="paquete-icono"><i class="fas fa-rocket"></i></div><h4>${paquete.nombre}</h4><div class="paquete-precio">$${paquete.precio} ${valorRealHTML}</div><div class="paquete-cantidad">${paquete.boletos} Boleto(s) Digital(es)</div>${boletosGratisHTML}<p class="paquete-descripcion">Aumenta tus probabilidades de ganar con este increíble paquete.</p><a href="https://wa.me/593963135510?text=${encodeURIComponent(mensajeWhatsApp)}" target="_blank" class="boton-paquete">Elegir Paquete</a></div>`;
            contenedor.innerHTML += paqueteHTML;
        });
    }

    /**
     * Genera el código HTML para los 2-3 botones de paquetes destacados.
     * @param {Array<object>} paquetes - El array de paquetes de un sorteo.
     * @returns {string} El string de HTML con los botones de los paquetes.
     */
    function generarHTMLMiniPaquetes(paquetes) {
        if (!paquetes || paquetes.length === 0) {
            return ''; // Si no hay paquetes, no devuelve nada.
        }

        // Buscamos el paquete individual (el que tiene 1 boleto)
        const paqueteIndividual = paquetes.find(p => p.boletos === 1);

        // Buscamos el paquete de "mejor valor" (el que más boletos tiene)
        const paquetesMultiples = paquetes.filter(p => p.boletos > 1);
        const paqueteMejorValor = paquetesMultiples.length > 0
            ? paquetesMultiples.reduce((max, p) => (p.boletos > max.boletos ? p : max), paquetesMultiples[0])
            : null;

        let html = '';

        // Creamos el botón para el paquete individual, si existe
        if (paqueteIndividual) {
            const mensaje = `Hola, quiero el paquete "${paqueteIndividual.nombre}" de ${paqueteIndividual.boletos} boleto(s) por $${paqueteIndividual.precio} para el sorteo MOVIL WIN!`;
            html += `
                <a href="https://wa.me/593963135510?text=${encodeURIComponent(mensaje)}" target="_blank" class="mini-package-btn">
                    <strong>${paqueteIndividual.boletos} Boleto</strong>
                    <span>por $${paqueteIndividual.precio}</span>
                </a>
            `;
        }

        // Creamos el botón para el paquete de mejor valor, si existe
        if (paqueteMejorValor) {
            const mensaje = `Hola, quiero el paquete "${paqueteMejorValor.nombre}" de ${paqueteMejorValor.boletos} boletos por $${paqueteMejorValor.precio} para el sorteo MOVIL WIN!`;
            html += `
                <a href="https://wa.me/593963135510?text=${encodeURIComponent(mensaje)}" target="_blank" class="mini-package-btn popular">
                    <strong>${paqueteMejorValor.boletos} Boletos</strong>
                    <span>por $${paqueteMejorValor.precio}</span>
                    <span class="popular-tag">¡Recomendado!</span>
                </a>
            `;
        }

        // Siempre añadimos el botón "Ver Todos"
        html += `
            <a href="#paquetes-section" class="mini-package-btn all-packages">
                <strong>Ver Todos</strong>
                <span><i class="fas fa-arrow-down"></i></span>
            </a>
        `;

        return html;
    }
    // --- 3. FUNCIONES DE DIBUJO DE LA RULETA ---



    const RUEDA_COLORES = [
        '#EF4565', // Rojo/Rosa Vibrante
        '#7F5AF0', // Púrpura (de tu paleta)
        '#2CB67D', // Verde (de tu paleta)
        '#FF8906', // Naranja (de tu paleta)
        '#00A8E8', // Azul Brillante
        '#F9C80E'  // Amarillo/Dorado
    ];

// En script.js, reemplaza tu función drawSegment completa por esta:

    function drawSegment(index, y, participant) {
        if (!wheelCtx) return;

        const ribbonWidth = 60;
        const mainAreaWidth = wheelWidth - ribbonWidth;
        
        const colorIndex = getStableColorIndex(participant.id, RUEDA_COLORES.length);
        const segmentColor = RUEDA_COLORES[colorIndex];

        const formattedName = formatNameForWheel(participant.name);
        const confidentialId = formatConfidentialId(participant.id);
        const ticketId = participant.orden_id;

        // Dibuja el fondo del área principal
        wheelCtx.fillStyle = segmentColor;
        wheelCtx.fillRect(0, y, wheelWidth, SEGMENT_HEIGHT_FRONT);

        // Dibuja la franja lateral
        wheelCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        wheelCtx.fillRect(mainAreaWidth, y, ribbonWidth, SEGMENT_HEIGHT_FRONT);
        wheelCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        wheelCtx.fillRect(mainAreaWidth, y, 1, SEGMENT_HEIGHT_FRONT);

        // --- INICIO DE LA MODIFICACIÓN ---
        // 1. Dibuja un borde sutil para separar las casillas
        wheelCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)'; // Color del borde (negro semi-transparente)
        wheelCtx.lineWidth = 4; // Ancho del borde en píxeles
        wheelCtx.strokeRect(0, y, wheelWidth, SEGMENT_HEIGHT_FRONT);
        // --- FIN DE LA MODIFICACIÓN ---

        // Dibuja el texto centrado en el área principal
        const centerX = mainAreaWidth / 2;
        wheelCtx.textAlign = 'center';
        wheelCtx.textBaseline = "middle";
        wheelCtx.shadowColor = 'rgba(0,0,0,0.6)';
        wheelCtx.shadowBlur = 4;
        wheelCtx.shadowOffsetY = 2;
        wheelCtx.fillStyle = "#FFFFFF";
        wheelCtx.font = `bold 22px Poppins, sans-serif`;
        wheelCtx.fillText(formattedName, centerX, y + (SEGMENT_HEIGHT_FRONT / 2) - 8);
        wheelCtx.font = `500 13px Poppins, sans-serif`;
        wheelCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
        wheelCtx.fillText(confidentialId, centerX, y + (SEGMENT_HEIGHT_FRONT / 2) + 14);
        wheelCtx.shadowBlur = 0;
        wheelCtx.shadowOffsetY = 0;

        // Dibuja el número de boleto ROTADO en la franja
        wheelCtx.save();
        wheelCtx.translate(mainAreaWidth + ribbonWidth / 2, y + SEGMENT_HEIGHT_FRONT / 2);
        wheelCtx.rotate(Math.PI / 2);
        wheelCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
        wheelCtx.font = `bold 16px 'Lucida Console', Monaco, monospace`;
        wheelCtx.textAlign = "center";
        wheelCtx.fillText(`#${ticketId}`, 0, 0);
        wheelCtx.restore();
    }
    function drawScrollbar() {
        if (estaGirando || !wheelCtx || !participantes) return;
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
            const centerX = wheelWidth / 2;
            const centerY = wheelHeight / 2;
            const gradient = wheelCtx.createRadialGradient(centerX, centerY, 5, centerX, centerY, wheelWidth / 1.5);
            gradient.addColorStop(0, 'rgba(44, 182, 125, 0.1)');
            gradient.addColorStop(1, 'rgba(36, 38, 41, 0)');
            wheelCtx.fillStyle = gradient;
            wheelCtx.fillRect(0, 0, wheelWidth, wheelHeight);
            wheelCtx.font = "900 120px 'Font Awesome 6 Free'";
            wheelCtx.fillStyle = "rgba(255, 255, 255, 0.05)";
            wheelCtx.textAlign = "center";
            wheelCtx.textBaseline = "middle";
            wheelCtx.fillText('\uf3ff', centerX, centerY);
            const mainFontSize = Math.max(16, Math.min(22, wheelWidth / 15));
            const subFontSize = Math.max(12, Math.min(16, wheelWidth / 20));
            const lineHeight = mainFontSize * 1.2;
            wheelCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
            wheelCtx.font = `bold ${mainFontSize}px Poppins, sans-serif`;
            wheelCtx.shadowColor = 'black';
            wheelCtx.shadowBlur = 5;
            wrapText(wheelCtx, "¡TU NOMBRE PODRÍA ESTAR AQUÍ!", centerX, centerY + 80, wheelWidth * 0.9, lineHeight);
            wheelCtx.fillStyle = "var(--clr-primary)";
            wheelCtx.font = `500 ${subFontSize}px Poppins, sans-serif`;
            wheelCtx.shadowBlur = 0;
            wheelCtx.fillText("¡Compra tu boleto y sé el primero!", centerX, centerY + 120);
            wheelCtx.textBaseline = "alphabetic";
            return;
        }
        wheelCtx.clearRect(0, 0, wheelWidth, wheelHeight);
        const startIndex = Math.floor(yOffsetToDraw / SEGMENT_HEIGHT_FRONT);
        const endIndex = startIndex + VISIBLE_SEGMENTS_COUNT + 2;
        for (let i = startIndex; i < endIndex; i++) {
            const participantIndex = (i % participantesDelSorteo.length + participantesDelSorteo.length) % participantesDelSorteo.length;
            const participant = participantesDelSorteo[participantIndex];
            const segmentY = (i * SEGMENT_HEIGHT_FRONT) - yOffsetToDraw;
            if (!participant) continue;
            drawSegment(i, segmentY, participant);
        }
        drawScrollbar();
    }

    // --- 4. FUNCIONES PRINCIPALES Y DE LÓGICA ---

    async function moveToSlide(index) {
        sorteoFinalizado = false;
        if (!prizeCarouselTrack || index < 0 || index >= sorteosDisponibles.length) return;
        premioActualIndex = index;
        prizeCarouselTrack.style.transform = `translateX(${-index * 100}%)`;
        const sorteoActual = sorteosDisponibles[premioActualIndex];
        const activeSlide = prizeCarouselTrack.children[index];
        if (!activeSlide) return;
        document.querySelectorAll('.prize-nav-panel').forEach((p, i) => p.classList.toggle('active', i === index));
        actualizarTopParticipantes(sorteoActual.id_sorteo, activeSlide);
        const paqueteContainer = document.getElementById('paquetes-section');
        if (paqueteContainer) {
            if (sorteoActual.status_sorteo === 'programado') {
                paqueteContainer.innerHTML = '<p style="text-align:center; color: var(--clr-dark-text-alt);">Los paquetes de participación se anunciarán pronto. ¡Mantente atento!</p>';
            } else {
                renderizarPaquetesPublicos(sorteoActual.paquetes_json, paqueteContainer);
            }
        }
        const currentWheelCanvas = activeSlide.querySelector('.price-wheel-canvas');
        if (sorteoActual && sorteoActual.id_sorteo && currentWheelCanvas && sorteoActual.status_sorteo !== 'programado') {
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
                const response = await fetch(`${API_BASE_URL}/api/participantes?sorteoId=${sorteoActual.id_sorteo}`);
                if (!response.ok) { throw new Error(`El servidor respondió con un error ${response.status}`); }
                participantes = await response.json() || [];
                currentYOffset = 0;
                addWheelEventListeners(wheelCanvas);
                drawFrontWheel(participantes);
            } catch (err) {
                console.error("Error al cargar participantes para la rueda:", err);
                participantes = [];
                drawFrontWheel(participantes);
            }
        } else {
            participantes = [];
            wheelCanvas = null;
            wheelCtx = null;
            if(activeSlide.querySelector('.wheel-price-is-right-container')) {
                 drawFrontWheel([]); // Dibuja el estado vacío si el canvas existe pero el sorteo es programado
            }
        }
    }

    async function cargarSorteosVisibles() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/sorteos-visibles`);
            if (!response.ok) throw new Error('No se pudo obtener la lista de sorteos.');
            const data = await response.json();
            if (data.success && data.sorteos && data.sorteos.length > 0) {
                sorteosDisponibles = data.sorteos;
                await generarSlidesDelCarrusel();
                generarPanelesDeNavegacion();
                const initialIndex = sorteosDisponibles.findIndex(s => s.status_sorteo === 'activo');
                moveToSlide(initialIndex !== -1 ? initialIndex : 0);
            } else {
                if (prizeCarouselTrack) prizeCarouselTrack.innerHTML = `<div style="text-align:center; padding: 50px 20px;"><h2 class="prize-title">No hay sorteos disponibles en este momento. ¡Vuelve pronto!</h2></div>`;
            }
        } catch (error) {
            if (prizeCarouselTrack) prizeCarouselTrack.innerHTML = `<div style="text-align:center; padding: 50px 20px;"><h2 class="prize-title">${error.message}</h2></div>`;
        }
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
            const response = await fetch(`${API_BASE_URL}/api/admin/realizar-sorteo`, {
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
    

// En script.js, reemplaza tu función generarSlidesDelCarrusel completa por esta:

    async function generarSlidesDelCarrusel() {
        if (!prizeCarouselTrack) return;
        prizeCarouselTrack.innerHTML = '';

        for (const sorteo of sorteosDisponibles) {
            const slideWrapper = document.createElement('div');
            slideWrapper.className = 'slide-wrapper';
            slideWrapper.style.cssText = 'width: 100%; flex-shrink: 0;';
            
            const esProximo = sorteo.status_sorteo === 'programado';
            
            let tituloMostrado = sorteo.nombre_premio_display;
            let mediaParaRenderizar = sorteo;

            if (esProximo) {
                tituloMostrado = "Próximo Gran Premio";
                mediaParaRenderizar = {
                    imagen_url: 'images/proximo_sorteo.png',
                    nombre_premio_display: 'Próximo Sorteo',
                    esProximo: true
                };
            }
            
            let percentage = 0;
            let motivationalMessage = "¡El sorteo ha comenzado!";
            if (!esProximo) {
                const currentCount = sorteo.participantes_actuales || 0;
                const goal = sorteo.meta_participaciones || 200;
                percentage = goal > 0 ? Math.min((currentCount / goal) * 100, 100) : 0;
                motivationalMessage = getMotivationalMessage(percentage);
            }

            // --- INICIO DE LA MODIFICACIÓN ---
            // 1. Llamamos a nuestra nueva función para generar el HTML de los mini paquetes
            const miniPaquetesHTML = generarHTMLMiniPaquetes(sorteo.paquetes_json);
            // --- FIN DE LA MODIFICACIÓN ---

            slideWrapper.innerHTML = `
                <div class="prize-carousel-slide" data-sorteo-id="${sorteo.id_sorteo || 'proximo'}">
                    <div class="prize-image-container">
                        ${renderMedia(mediaParaRenderizar)}
                    </div>
                    <div class="prize-info-container">
                        <h2 class="prize-title">${tituloMostrado}</h2>
                        
                        <div class="mini-package-selector" style="${esProximo ? 'display: none;' : ''}">
                            ${miniPaquetesHTML}
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
                    <h2 class="titulo-dorado" data-text="GRAN RUEDA MOVIL WIN">GRAN RUEDA MOVIL WIN</h2>
                    <p class="rueda-subtitulo">¡Mucha Suerte a Todos los Participantes!</p>
                    <div class="price-is-right-wheel-frame">
                        <div class="wheel-price-is-right-container">
                            <canvas class="price-wheel-canvas"></canvas>
                        </div>
                        <div class="clacker-container">
                            <div class="clacker-border"></div>
                            <div class="clacker-top"></div>
                        </div>
                    </div>
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

    async function actualizarTopParticipantes(sorteoId, slideElement) {
        const listElement = slideElement.querySelector('.top-participants-list');
        const loader = slideElement.querySelector('.top-participants-wrapper .loader-container');
        const wrapper = slideElement.querySelector('.top-participants-wrapper');

        if (!listElement || !loader || !wrapper) return;

        const sorteoSeleccionado = sorteosDisponibles.find(s => s.id_sorteo == sorteoId);
        
        if (!sorteoId || !sorteoSeleccionado || sorteoSeleccionado.status_sorteo === 'programado') {
            wrapper.style.display = 'none';
            return;
        }

        wrapper.style.display = 'block';
        loader.classList.remove('oculto');
        listElement.innerHTML = '';

        try {
            const response = await fetch(`${API_BASE_URL}/api/top-participantes?sorteoId=${sorteoId}`);
            if (!response.ok) throw new Error('No se pudo cargar la lista.');
            
            const top = await response.json();

            if (top.length === 0) {
                listElement.innerHTML = '<li class="top-list-item-empty">Aún no hay participantes destacados.</li>';
            } else {
                top.forEach((p, i) => {
                    const li = document.createElement('li');
                    li.className = `top-list-item rank-${i + 1}`;
                    const rank = i + 1;
                    let rankIcon = `<span class="rank-number">${rank}</span>`;
                    if (rank === 1) rankIcon = '🥇';
                    if (rank === 2) rankIcon = '🥈';
                    if (rank === 3) rankIcon = '🥉';

                    const initials = getAvatarInitials(p.name);
                    const formattedName = formatNameForWheel(p.name);

                    // --- INICIO DE LA MODIFICACIÓN ---
                    // Se usa la misma lógica que la rueda para obtener un color consistente de la paleta
                    const colorIndex = getStableColorIndex(p.id, RUEDA_COLORES.length);
                    const avatarColor = RUEDA_COLORES[colorIndex];
                    // --- FIN DE LA MODIFICACIÓN ---
                    
                    // Se simplificó el HTML para que coincida con tu última captura de pantalla
                    li.innerHTML = `
                        <div class="rank-icon">${rankIcon}</div>
                        <div class="participant-avatar" style="background-color: ${avatarColor};">
                            ${initials}
                        </div>
                        <div class="participant-details">
                            <span class="participant-name">${formattedName}</span>
                        </div>
                        <div class="ticket-count">${p.total_participaciones} boletos</div>
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

    
    async function mostrarGanadoresAnteriores() {
        if (!listaGanadoresDiv) return;
        loaderGanadores.classList.remove('oculto');
        try {
            const response = await fetch(`${API_BASE_URL}/api/ultimos-ganadores`);
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

    async function chequearEstadoGlobal() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/countdown-status`);
            const data = await response.json();
            if (data.isActive) {
                // Ahora pasamos tanto la hora de finalización como el ID del sorteo
                iniciarContadorSincronizado(data.endTime, data.sorteoId);
            }
        } catch(error) {
            console.error("Error chequeando estado del contador:", error);
        }
    }
    // --- Llamadas de Arranque ---
    cargarSorteosVisibles();
    mostrarGanadoresAnteriores();
    chequearEstadoGlobal(); 
}
