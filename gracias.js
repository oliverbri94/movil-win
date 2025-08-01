// REEMPLAZA TODO EL CONTENIDO DE gracias.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica para mostrar los números elegidos ---
    const params = new URLSearchParams(window.location.search);
    const numerosJSON = params.get('numeros');
    const resumenContainer = document.getElementById('numeros-elegidos-resumen');

    if (numerosJSON && resumenContainer) {
        try {
            const numeros = JSON.parse(decodeURIComponent(numerosJSON));
            if (numeros.length > 0 && numeros[0] !== null) {
                const bolasHTML = numeros.map(combo => {
                    const comboHTML = combo.map(n => `<div class="bola-small">${n}</div>`).join('');
                    return `<div class="bolas-container">${comboHTML}</div>`;
                }).join('');
                resumenContainer.innerHTML = bolasHTML;
            } else {
                 resumenContainer.innerHTML = `<p>${numeros.length} boleto(s) para ruleta.</p>`;
            }
        } catch (e) {
            console.error('Error al parsear números:', e);
        }
    }

    // --- Lógica del Temporizador ---
    const timerDiv = document.getElementById('countdown-timer');
    if (timerDiv) {
        let tiempoRestante = 30 * 60; // 15 minutos en segundos
        const timerInterval = setInterval(() => {
            const minutos = Math.floor(tiempoRestante / 60);
            const segundos = tiempoRestante % 60;

            timerDiv.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

            if (--tiempoRestante < 0) {
                clearInterval(timerInterval);
                timerDiv.textContent = "Expirado";
            }
        }, 1000);
    }

    // --- Lógica Mejorada para Copiar ---
    const copyButtons = document.querySelectorAll('.btn-copy');
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.copyTarget;
            const targetElement = document.getElementById(targetId);
            if (!targetElement) return;

            const textToCopy = targetElement.textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                showCopiedFeedback(button);
                // Añadimos el flash al elemento padre (el <li>)
                targetElement.closest('.lista-datos-pago li').classList.add('highlight-flash');
                setTimeout(() => {
                    targetElement.closest('.lista-datos-pago li').classList.remove('highlight-flash');
                }, 700);
            });
        });
    });

    function showCopiedFeedback(button) {
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.classList.add('copied');
        setTimeout(() => {
            button.innerHTML = originalIcon;
            button.classList.remove('copied');
        }, 2000);
    }
});