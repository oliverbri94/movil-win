document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos del DOM según tu nuevo HTML
    const searchInput = document.getElementById('searchInput');
    const tableBody = document.getElementById('listado-tbody'); // <-- ¡CAMBIO CLAVE! Apuntamos al tbody
    const participantsContainer = document.getElementById('listado-participantes-container');
    const totalBoletosDisplay = document.getElementById('total-boletos');

    // Verificación de seguridad
    if (!tableBody || !searchInput || !participantsContainer) {
        console.error("Error: No se encontraron uno o más elementos esenciales en el HTML (searchInput, listado-tbody, listado-participantes-container).");
        return;
    }

    // --- Lógica para generar las filas de la tabla ---
    // Simularemos la carga de datos. En un caso real, aquí iría tu fetch a la base de datos.
    // Hacemos visible el contenedor de participantes (quitamos la clase 'oculto')
    participantsContainer.classList.remove('oculto');
    console.log("Mostrando contenedor de participantes. Empezando a generar la tabla...");

    const fragment = document.createDocumentFragment();
    const totalCombinations = 100000; // Total de combinaciones a generar

    for (let i = 0; i < totalCombinations; i++) {
        const combination = i.toString().padStart(5, '0');
        const tableRow = document.createElement('tr'); // <-- Creamos una fila <tr> en lugar de <li>

        // Creamos la estructura interna de la fila con celdas <td>
        // Añadimos clases a cada celda para poder buscarlas fácilmente
        tableRow.innerHTML = `
            <td class="combinacion">${combination}</td>
            <td class="nombre">OLIVER ISMAEL BRICEÑO BARRIGA</td>
            <td class="cedula">171899...</td>
            <td></td>
        `;
        fragment.appendChild(tableRow);
    }

    // Añadimos todas las filas al tbody de una sola vez
    tableBody.appendChild(fragment);
    console.log("¡Filas de la tabla generadas y añadidas a la página!");

    // Actualizamos el contador total de boletos
    totalBoletosDisplay.textContent = `Total de boletos: ${totalCombinations}`;


    // --- Lógica de Búsqueda para la Tabla ---
    searchInput.addEventListener('keyup', () => {
        const searchTerm = searchInput.value.toUpperCase();
        const rows = tableBody.getElementsByTagName('tr'); // Obtenemos todas las filas <tr>

        for (const row of rows) {
            // Obtenemos el texto de las celdas específicas por su clase
            const nombre = row.querySelector('.nombre').textContent.toUpperCase();
            const cedula = row.querySelector('.cedula').textContent;
            const combinacion = row.querySelector('.combinacion').textContent;

            // La lógica de búsqueda es la misma: si coincide con cualquiera, se muestra la fila
            if (
                searchTerm === '' ||
                nombre.startsWith(searchTerm) ||
                cedula.startsWith(searchTerm) ||
                combinacion.startsWith(searchTerm)
            ) {
                row.style.display = ''; // Muestra la fila
            } else {
                row.style.display = 'none'; // Oculta la fila
            }
        }
    });


// En listado.js, AÑADE este bloque de código al final

document.getElementById('listado-tbody').addEventListener('click', (e) => {
    const shareButton = e.target.closest('.btn-share-ticket');
    if (!shareButton) return;

    const boleto = shareButton.dataset.boleto;
    const sorteoNombre = shareButton.dataset.sorteoNombre;
    const shareText = `¡Ya estoy participando para ganar un ${sorteoNombre} con Movil Win! Mi boleto de la suerte es el #${boleto}.`;
    const shareUrl = 'https://movilwin.com'; // Enlace a tu página principal

        // 1. Crear el modal dinámicamente
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'share-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="share-modal-content">
                <h3>¿Cómo quieres compartir?</h3>
                <div class="share-options">
                    <button class="share-option-btn whatsapp" id="share-whatsapp">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                    <button class="share-option-btn other-apps" id="share-others">
                        <i class="fas fa-share-square"></i> Otras Apps
                    </button>
                </div>
                <button class="share-modal-close" id="share-close">Cancelar</button>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        // Pequeña animación de entrada
        setTimeout(() => modalOverlay.classList.add('visible'), 10);

        // 2. Función para cerrar el modal
        const closeModal = () => {
            modalOverlay.classList.remove('visible');
            setTimeout(() => modalOverlay.remove(), 300);
        };

        // 3. Añadir listeners a los nuevos botones
        document.getElementById('share-whatsapp').addEventListener('click', () => {
            const tuNumero = '593963135510'; // Tu número de WhatsApp
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
            window.open(whatsappUrl, '_blank');
            closeModal();
        });

        document.getElementById('share-others').addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: 'Sorteo Movil Win',
                    text: shareText,
                    url: shareUrl,
                }).catch(console.error);
            } else {
                navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
                alert('¡Enlace y texto para compartir copiados al portapapeles!');
            }
            closeModal();
        });
        
        document.getElementById('share-close').addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) closeModal();
        });
        // --- FIN DE LA NUEVA LÓGICA ---

    if (navigator.share) {
        // Usa la API nativa de compartir si está disponible (ideal en móviles)
        navigator.share({
            title: 'Sorteo Movil Win',
            text: shareText,
            url: shareUrl,
        }).catch(console.error);
    } else {
        // Si no, copia el texto al portapapeles y avisa al usuario (para escritorio)
        navigator.clipboard.writeText(`${shareText} ¡Tú también puedes participar aquí! ${shareUrl}`);
        alert('¡Texto para compartir copiado al portapapeles!');
    }
});

async function cargarListaDeSorteos() {
    const listaSorteosDiv = document.getElementById('lista-de-sorteos');
    try {
        const response = await fetch(`${API_BASE_URL}/api/listable-raffles`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        if (data.sorteos.length === 0) {
            listaSorteosDiv.innerHTML = '<p>No hay sorteos activos o finalizados para mostrar.</p>';
        } else {
            // Ahora incluimos el tipo de sorteo en el enlace
            data.sorteos.forEach(sorteo => {
                const link = document.createElement('a');
                link.href = `listado.html?sorteo=${sorteo.id_sorteo}&tipo=${sorteo.tipo_sorteo}`;
                link.className = 'sorteo-selection-item';
                link.innerHTML = `<span>${sorteo.nombre_premio_display}</span> <span class="status-tag status-${sorteo.status_sorteo}">${sorteo.status_sorteo}</span>`;
                listaSorteosDiv.appendChild(link);
            });
        }
    } catch (error) {
        listaSorteosDiv.innerHTML = `<p class="error-message">${error.message}</p>`;
    } finally {
        loaderEl.style.display = 'none';
    }
}

    async function cargarListadoDeParticipantes(id, tipo) {
        const tbody = document.getElementById('listado-tbody');
        const totalBoletosEl = document.getElementById('total-boletos');
        const searchInput = document.getElementById('searchInput');
        const headerBoleto = document.getElementById('header-boleto-combinacion');

        // Determinar qué API llamar
        const endpoint = (tipo === 'tombola_interactiva') 
            ? `${API_BASE_URL}/api/public-list/tombola/${id}`
            : `${API_BASE_URL}/api/public-list/${id}`;

        try {
            const response = await fetch(endpoint);
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            tituloEl.textContent = `Listado Oficial: ${data.nombreSorteo}`;
            subtituloEl.innerHTML = `<a href="listado.html" class="back-link-small"><i class="fas fa-arrow-left"></i> Volver a la lista de sorteos</a>`;
            totalBoletosEl.textContent = `Total de registros: ${data.listado.length}`;

            let filasHTML = '';

            if (tipo === 'tombola_interactiva') {
                headerBoleto.textContent = 'Combinaciones';
                data.listado.forEach(p => {
                    const combinacionesHTML = p.numeros.map(combo => 
                        `<div class="combinacion-fila">${combo.map(n => `<span class="bola-small-listado">${n}</span>`).join('')}</div>`
                    ).join('');

                    const numerosParaBusqueda = p.numeros.flat().join('');

                    // Lógica para anonimizar nombre y cédula (igual que en la ruleta)
                    const nombreDisplay = p.nombre ? `${p.nombre.trim().split(' ')[0]} ${p.nombre.trim().split(' ').pop().charAt(0)}.` : 'Participante';
                    const cedulaDisplay = formatConfidentialId(p.id_documento);

                    const searchData = `${p.nombre || ''} ${p.id_documento || ''} ${numerosParaBusqueda}`.toLowerCase();

                    filasHTML += `<tr data-search="${searchData}">
                                    <td data-label="Combinaciones"><div class="combinacion-bolas-container">${combinacionesHTML}</div></td>
                                    <td data-label="Participante">${nombreDisplay}</td>
                                    <td data-label="Cédula">${cedulaDisplay}</td>
                                    <td data-label="Compartir">
                                        <button class="btn-share-ticket" data-sorteo-nombre="${data.nombreSorteo}" title="Compartir mi boleto">
                                            <i class="fas fa-share-alt"></i>
                                        </button>
                                    </td>
                                </tr>`;
                });
            } else {
                // Lógica para sorteos de ruleta (la que ya tenías)
                headerBoleto.textContent = '# Boleto';
                data.listado.forEach(p => {
                    const searchData = `${p.nombre_raw || ''} ${p.cedula_raw || ''}`.toLowerCase();
                    filasHTML += `<tr data-search="${searchData}">
                                    <td data-label="# Boleto">${p.boleto}</td>
                                    <td data-label="Participante">${p.nombre_display}</td>
                                    <td data-label="Cédula">${p.cedula_display}</td>
                                    <td data-label="Compartir">
                                        <button class="btn-share-ticket" data-boleto="${p.boleto}" data-sorteo-nombre="${data.nombreSorteo}" title="Compartir mi boleto">
                                            <i class="fas fa-share-alt"></i>
                                        </button>
                                    </td>
                                </tr>`;
                });
            }

            tbody.innerHTML = filasHTML;

            const searchCounter = document.getElementById('search-results-counter');
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                let resultadosEncontrados = 0;

                tbody.querySelectorAll('tr').forEach(row => {
                    const searchableText = row.dataset.search || '';
                    const isVisible = searchableText.startsWith(searchTerm);
                    row.style.display = isVisible ? '' : 'none';
                    if (isVisible) {
                        resultadosEncontrados++;
                    }
                });

                // Actualizar el texto del contador
                if (searchTerm === '') {
                    searchCounter.textContent = ''; // Limpiar si no hay búsqueda
                } else if (resultadosEncontrados === 1) {
                    searchCounter.textContent = '1 resultado encontrado';
                } else {
                    searchCounter.textContent = `${resultadosEncontrados} resultados encontrados`;
                }
            });

        } catch (error) {
            tituloEl.textContent = 'Error al Cargar el Listado';
            tbody.innerHTML = `<tr><td colspan="4" class="error-message">${error.message}</td></tr>`;
        } finally {
            loaderEl.style.display = 'none';
        }
    }
});