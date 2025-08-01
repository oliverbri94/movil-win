// Contenido para el nuevo archivo faq.js
document.addEventListener('DOMContentLoaded', () => {
    const faqContainer = document.getElementById('faq-container');

    if (faqContainer) {
        faqContainer.addEventListener('click', function(event) {
            const questionButton = event.target.closest('.faq-question');

            if (questionButton) {
                const answerPanel = questionButton.nextElementSibling;

                // Toggle (activar/desactivar) la clase 'active'
                questionButton.classList.toggle('active');
                answerPanel.classList.toggle('active');
            }
        });
    }
});