document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://movil-win-production.up.railway.app';
    const sorteoId = new URLSearchParams(window.location.search).get('sorteo');

    const tituloEl = document.getElementById('listado-titulo');
    const subtituloEl = document.getElementById('listado-subtitulo');
    const loaderEl = document.getElementById('loader');
    
    const seleccionContainer = document.getElementById('seleccion-sorteo-container');
    const listadoContainer = document.getElementById('listado-participantes-container');

    if (sorteoId) {
        // Si la URL tiene un ID, cargamos la lista de ese sorteo
        seleccionContainer.classList.add('oculto');
        listadoContainer.classList.remove('oculto');
        cargarListadoDeParticipantes(sorteoId);
    } else {
        // Si no hay ID, cargamos la lista de sorteos para elegir
        listadoContainer.classList.add('oculto');
        seleccionContainer.classList.remove('oculto');
        cargarListaDeSorteos();
    }
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

            if(data.sorteos.length === 0) {
                 listaSorteosDiv.innerHTML = '<p>No hay sorteos activos o finalizados para mostrar.</p>';
            } else {
                data.sorteos.forEach(sorteo => {
                    const link = document.createElement('a');
                    link.href = `listado.html?sorteo=${sorteo.id_sorteo}`;
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

    async function cargarListadoDeParticipantes(id) {
        const tbody = document.getElementById('listado-tbody');
        const totalBoletosEl = document.getElementById('total-boletos');
        const searchInput = document.getElementById('searchInput');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/public-list/${id}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            tituloEl.textContent = `Listado Oficial: ${data.nombreSorteo}`;
            subtituloEl.innerHTML = `<a href="listado.html" class="back-link-small"><i class="fas fa-arrow-left"></i> Volver a la lista de sorteos</a>`;
            totalBoletosEl.textContent = `Total de boletos registrados: ${data.listado.length}`;
            
            let filasHTML = '';
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
            tbody.innerHTML = filasHTML;

            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                tbody.querySelectorAll('tr').forEach(row => {
                    const searchableText = row.dataset.search || '';
                    row.style.display = searchableText.includes(searchTerm) ? '' : 'none';
                });
            });

        } catch (error) {
            tituloEl.textContent = 'Error al Cargar el Listado';
            tbody.innerHTML = `<tr><td colspan="3" class="error-message">${error.message}</td></tr>`;
        } finally {
            loaderEl.style.display = 'none';
        }
    }
});