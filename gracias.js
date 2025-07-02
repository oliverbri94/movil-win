document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get('pedidoId');

    // Muestra el ID del pedido en el título
    const pedidoIdSpan = document.getElementById('pedidoId');
    if (pedidoIdSpan && pedidoId) {
        pedidoIdSpan.textContent = pedidoId;
    }

    // Actualiza el enlace de WhatsApp con el ID del pedido
    const whatsappBtn = document.getElementById('whatsapp-btn');
    if (whatsappBtn && pedidoId) {
        const baseWhatsAppUrl = 'https://wa.me/593959687438';
        const mensaje = `Hola, quiero enviar mi comprobante de pago para el Pedido #${pedidoId}.`;
        whatsappBtn.href = `${baseWhatsAppUrl}?text=${encodeURIComponent(mensaje)}`;
    }

    // Lógica para todos los botones de "Copiar"
    const copyButtons = document.querySelectorAll('.btn-copy');
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.copyTarget;
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                const textToCopy = targetElement.innerText || targetElement.value || '';
                if (!navigator.clipboard) {
                    // Fallback para navegadores antiguos
                    const textarea = document.createElement('textarea');
                    textarea.value = textToCopy;
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        showCopiedFeedback(button);
                    } catch (err) {
                        alert('No se pudo copiar el texto.');
                    }
                    document.body.removeChild(textarea);
                } else {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        showCopiedFeedback(button);
                    }).catch(err => {
                        alert('No se pudo copiar el texto.');
                    });
                }
            }
        });
    });

    function showCopiedFeedback(button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copiado';
        button.classList.add('copied');
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('copied');
        }, 2000);
    }
});