document.addEventListener('DOMContentLoaded', () => {
    const copyButtons = document.querySelectorAll('.btn-copy');
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.copyTarget;
            const targetElement = document.getElementById(targetId);

            if (!targetElement) {
                alert('No se encontró el elemento a copiar.');
                return;
            }

            // Detecta si es input/textarea o texto normal
            let textToCopy = '';
            if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
                textToCopy = targetElement.value;
            } else {
                textToCopy = targetElement.textContent;
            }

            if (!textToCopy) {
                alert('No hay texto para copiar.');
                return;
            }

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showCopiedFeedback(button);
                }).catch(() => {
                    alert('No se pudo copiar el texto.');
                });
            } else {
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