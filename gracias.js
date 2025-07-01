// En gracias.js, reemplaza todo el contenido

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get('pedidoId');

    // --- LÓGICA PARA MOSTRAR EL ID DEL PEDIDO ---
    const pedidoIdSpan = document.getElementById('pedidoId');
    if (pedidoIdSpan && pedidoId) {
        pedidoIdSpan.textContent = pedidoId;
    }

    // --- INICIO DE LA NUEVA LÓGICA PARA EL BOTÓN ---
    const whatsappBtn = document.getElementById('whatsapp-btn');
    if (whatsappBtn && pedidoId) {
        const baseWhatsAppUrl = 'https://wa.me/593959687438';
        const mensaje = `Hola, quiero enviar mi comprobante de pago para el Pedido #${pedidoId}.`;
        whatsappBtn.href = `${baseWhatsAppUrl}?text=${encodeURIComponent(mensaje)}`;
    }
    // --- FIN DE LA NUEVA LÓGICA ---

    // Lógica para los botones de "Copiar" (sin cambios)
    const copyButtons = document.querySelectorAll('.btn-copy');
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.copyTarget;
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                navigator.clipboard.writeText(targetElement.innerText).then(() => {
                    const originalText = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-check"></i> Copiado';
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.classList.remove('copied');
                    }, 2000);
                }).catch(err => {
                    console.error('Error al copiar:', err);
                });
            }
        });
    });
});