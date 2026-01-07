document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('site_lang');
    if (savedLang) {
        const selector = document.getElementById('globalLanguageSelector');
        if (selector) selector.value = savedLang;
        if (savedLang !== 'id') {
            translatePage(savedLang);
        }
    }
});

async function changeLanguage(lang) {
    localStorage.setItem('site_lang', lang);
    if (lang === 'id') {
        location.reload(); // Reset ke original
    } else {
        await translatePage(lang);
    }
}

async function translatePage(targetLang) {
    // Ambil semua elemen teks yang relevan
    const elements = document.querySelectorAll('h1, h2, h3, h4, p, span, a, label, button, small, .menu-label, .breadcrumb span, th, td');
    const textsToTranslate = [];
    const elementIndices = [];

    // Filter elemen yang punya teks valid
    elements.forEach((el, index) => {
        const text = el.innerText.trim();
        if (text.length > 0 && !el.hasAttribute('data-no-translate') && !el.querySelector('input') && !el.querySelector('select')) {
            textsToTranslate.push(text);
            elementIndices.push(el);
        }
    });

    if (textsToTranslate.length === 0) return;

    // Tampilkan indikator loading
    const loadingBadge = document.createElement('div');
    loadingBadge.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#3b82f6; color:white; padding:10px 20px; border-radius:50px; z-index:9999; font-size:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);';
    loadingBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Translating Page...';
    document.body.appendChild(loadingBadge);

    try {
        // Batch request (kirim per 20 teks untuk menghindari limit body)
        const batchSize = 20;
        for (let i = 0; i < textsToTranslate.length; i += batchSize) {
            const batchTexts = textsToTranslate.slice(i, i + batchSize);
            const batchElements = elementIndices.slice(i, i + batchSize);

            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: batchTexts, targetLang })
            });

            const data = await response.json();
            
            if (data.translatedText) {
                data.translatedText.forEach((translated, idx) => {
                    if (translated) {
                        batchElements[idx].innerText = translated;
                    }
                });
            }
        }
        loadingBadge.innerHTML = '<i class="fa-solid fa-check"></i> Translated';
        setTimeout(() => loadingBadge.remove(), 2000);
    } catch (error) {
        console.error('Page translation failed', error);
        loadingBadge.style.background = '#ef4444';
        loadingBadge.innerText = 'Translation Failed';
        setTimeout(() => loadingBadge.remove(), 2000);
    }
}