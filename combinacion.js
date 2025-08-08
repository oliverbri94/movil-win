// combinacion.js
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const pedidoId = params.get('id');

    const cardEl = document.getElementById('boleto-card');
    const loaderEl = document.getElementById('loader-boleto');

    if (!pedidoId) {
        loaderEl.textContent = "Error: No se encontró un ID de pedido.";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/combinacion-details/${pedidoId}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message);
        }

        const data = result.data;
        const nombreParticipante = data.nombre_cliente.trim().split(' ')[0];

        // Rellenar los datos en la tarjeta
        document.getElementById('premio-imagen').src = data.imagen_url || 'images/logo.png';
        document.getElementById('premio-nombre').textContent = data.nombre_premio_display;
        document.getElementById('participante-nombre').textContent = `La Combinación de la Suerte de ${nombreParticipante}`;

        const combinacionesContainer = document.getElementById('combinaciones-container');
        if (data.numeros_elegidos && data.numeros_elegidos.length > 0) {
            const combinacionesHTML = data.numeros_elegidos.map(combo => 
                `<div class="combinacion-fila">${combo.map(n => `<span class="bola-small-listado">${n}</span>`).join('')}</div>`
            ).join('');
            combinacionesContainer.innerHTML = combinacionesHTML;
        } else {
            combinacionesContainer.textContent = "No se eligieron números para este boleto.";
        }

        // Configurar botón de compartir
        const shareText = `¡Mira mi combinación de la suerte para ganar un ${data.nombre_premio_display} con Movil Win! Tú también puedes participar.`;
        const shareUrl = `https://movilwin.com/combinacion.html?id=${pedidoId}`;
        document.getElementById('share-whatsapp').href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;

        // Mostrar la tarjeta y ocultar el loader
        loaderEl.style.display = 'none';
        cardEl.style.display = 'block';

    } catch (error) {
        loaderEl.innerHTML = `Error al cargar tu combinación: <br/>${error.message}`;
    }
});