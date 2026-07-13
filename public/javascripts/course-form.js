/**
 * Course form interactivity:
 * - Toggle generate-multiple checkbox to show/hide pattern fields
 * - Live preview of generated class names
 */

document.addEventListener('DOMContentLoaded', () => {
    const generateMultiple = document.getElementById('generateMultiple');
    const countGroup = document.getElementById('countGroup');
    const previewSection = document.getElementById('previewSection');
    const patternInput = document.getElementById('nama_kelas_pattern');
    const countInput = document.getElementById('class_count');
    const previewContent = document.getElementById('previewContent');
    const patternLabel = document.querySelector('label[for="nama_kelas_pattern"]');
    const patternHint = patternInput.nextElementSibling;

    function updateVisibility() {
        const isMultiple = generateMultiple.checked;
        countGroup.style.display = isMultiple ? '' : 'none';
        previewSection.style.display = isMultiple ? '' : 'none';

        if (isMultiple) {
            patternLabel.textContent = 'Nama Kelas Pattern';
            patternHint.innerHTML = 'Use <code class="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">{X}</code> as the placeholder for the class letter (A, B, C...).';
        } else {
            patternLabel.textContent = 'Nama Kelas';
            patternHint.textContent = 'The literal name for the single class.';
        }

        updatePreview();
    }

    function updatePreview() {
        if (!generateMultiple.checked) {
            previewContent.innerHTML = '';
            return;
        }

        const pattern = patternInput.value.trim();
        const count = Math.min(Math.max(parseInt(countInput.value) || 0, 0), 26);

        if (!pattern || count === 0) {
            previewContent.innerHTML = '<span class="text-sm text-slate-500 italic">Start typing to see the preview...</span>';
            return;
        }

        const names = [];
        for (let i = 0; i < count; i++) {
            const letter = String.fromCharCode(65 + i);
            const name = pattern.replace(/\{X\}/g, letter);
            names.push(name);
        }

        previewContent.innerHTML = names.map((name, idx) =>
            `<span class="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                   style="animation: fadeInUp 0.3s ease-out ${idx * 0.03}s both">
                ${escapeHtml(name)}
            </span>`
        ).join('');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Event listeners
    generateMultiple.addEventListener('change', updateVisibility);
    patternInput.addEventListener('input', updatePreview);
    countInput.addEventListener('input', updatePreview);

    // Initial state
    updateVisibility();
});
